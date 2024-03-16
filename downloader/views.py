import asyncio
import datetime
import io
import logging
import mimetypes
import os
import random
import re
import tempfile
import uuid
import zipfile
import platform

import httpx
from django.conf import settings
from django.contrib import messages
from django.http import FileResponse
from django.shortcuts import redirect, render
from django.template import loader
import filetype

# if not on windows import python-magic
if platform.system() != "Windows":
    import magic

    have_magic = True
else:
    have_magic = False


from .forms import RepositoryForm

logger = logging.getLogger(__name__)

os.makedirs(settings.GENERATED_FILES_DIR, exist_ok=True)

# Configure the cleanup settings
CLEANUP_PROBABILITY = 0.2  # Probability of performing cleanup on each view (20% chance)
CLEANUP_THRESHOLD = 10


def is_text_file(file_path):
    # Check file type using python-magic
    if have_magic:
        mime_type = magic.from_file(file_path, mime=True)
        if not mime_type.startswith("text/"):
            return False

    # Check file type using filetype library
    file_type = filetype.guess(file_path)
    if file_type is None or not file_type.mime.startswith("text/"):
        return False

    # Check MIME type using mimetypes
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type is None or not mime_type.startswith("text/"):
        return False

    # Check the number of lines in the text file
    with open(file_path, "r", encoding="utf-8") as file:
        num_lines = sum(1 for _ in file)
        if num_lines > settings.MAX_TEXT_FILE_LINES:
            return False

    return True


def is_safe_filename(filename):
    # Allowed characters in the filename
    allowed_chars = re.compile(r"^[a-zA-Z0-9_\-.]+$")

    # Check if the filename is empty
    if not filename:
        return False

    # Check if the filename exceeds the maximum length
    if len(filename) > settings.MAX_FILENAME_LENGTH:
        return False

    # Check if the filename contains only allowed characters
    if not allowed_chars.match(filename):
        return False

    # Check if the filename starts with a dot or hyphen
    if filename.startswith(".") or filename.startswith("-"):
        return False

    # Check if the filename contains consecutive dots or hyphens
    if ".." in filename or "--" in filename:
        return False

    # Check if the filename ends with a dot or hyphen
    if filename.endswith(".") or filename.endswith("-"):
        return False

    # Additional checks for specific file extensions
    # Example: Restrict certain file extensions
    restricted_extensions = settings.RESTRICTED_FILE_EXTENSIONS
    _, extension = os.path.splitext(filename)
    if extension.lower() in restricted_extensions:
        return False

    return True


class RepositorySizeExceededError(Exception):
    pass


async def download_repo(repo_url):
    async with httpx.AsyncClient(follow_redirects=True) as client:
        url = repo_url + "/archive/master.zip"
        logger.info(f"Downloading repository from URL: {url}")
        try:
            response = await client.get(url, headers={"Accept-Encoding": "identity"})
            response.raise_for_status()

            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > settings.MAX_REPO_SIZE:
                raise RepositorySizeExceededError(
                    f"Repository size exceeds the maximum allowed size: {content_length} bytes"
                )

            content = bytearray()
            async for chunk in response.aiter_bytes():
                content.extend(chunk)
                if len(content) > settings.MAX_REPO_SIZE:
                    raise RepositorySizeExceededError(
                        f"Repository size exceeds the maximum allowed size: {len(content)} bytes"
                    )

            logger.info(f"Downloaded {len(content)} bytes from {url}")
            try:
                zip_file = zipfile.ZipFile(io.BytesIO(content))
                logger.info(f"Successfully extracted zip file from {url}")
                return zip_file
            except zipfile.BadZipFile:
                logger.error(f"Invalid zip file content from {url}")
                logger.debug(f"Content: {content}")
                return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error occurred while downloading from {url}: {str(e)}")
            raise


async def extract_files(zip_file, temp_dir):
    loop = asyncio.get_event_loop()
    extracted_dir = await loop.run_in_executor(
        None, lambda: zip_file.namelist()[0].split("/")[0]
    )
    extraction_path = os.path.join(temp_dir, extracted_dir)
    await loop.run_in_executor(None, lambda: zip_file.extractall(path=temp_dir))
    return extraction_path


def concat_files(extracted_dir, repo_name, output_file_path):
    template = loader.get_template("repo_template.md")
    files = []
    for root, dirs, filenames in os.walk(extracted_dir):
        for filename in filenames:
            file_path = os.path.join(root, filename)
            if not is_safe_filename(filename):
                logger.warning(f"Skipping file with unsafe filename: {file_path}")
                continue
            if is_text_file(file_path):
                with open(file_path, "r", encoding="utf-8") as file:
                    content = file.read().strip()
                    files.append(
                        {
                            "path": os.path.relpath(file_path, extracted_dir),
                            "content": content,
                        }
                    )
                    logger.info(f"Processing file: {file_path}")
                    logger.debug(f"File content: {content}")
            else:
                logger.warning(f"Skipping non-text file: {file_path}")

    context = {"repo_name": repo_name, "files": files}
    output_content = template.render(context)
    with open(output_file_path, "w", encoding="utf-8") as outfile:
        outfile.write(output_content)


async def download_repo_view(request):
    if random.random() < CLEANUP_PROBABILITY:
        cleanup_generated_files()

    if request.method == "POST":
        form = RepositoryForm(request.POST)
        if form.is_valid():
            repo_url = form.cleaned_data["repo_url"]
            repo_name = repo_url.split("/")[-1]
            logger.info(f"Processing repository: {repo_url}")

            try:
                # Download and extract the repository
                zip_file = await download_repo(repo_url)
                if zip_file is None:
                    error_message = "Invalid GitHub repository URL or failed to download the repository."
                    logger.error(error_message)
                    return render(
                        request,
                        "downloader.html",
                        {"form": form, "error_message": error_message},
                    )

                with tempfile.TemporaryDirectory() as temp_dir:
                    extracted_dir = await extract_files(zip_file, temp_dir)

                    # Generate a unique filename for the output file
                    output_filename = f"{repo_name}_{uuid.uuid4().hex}.md"
                    output_file = os.path.join(
                        settings.GENERATED_FILES_DIR, output_filename
                    )

                    # Concatenate all files into a single .md file
                    concat_files(extracted_dir, repo_name, output_file)
                    file_size = os.path.getsize(output_file)
                    file_count = sum(
                        len(files) for _, _, files in os.walk(extracted_dir)
                    )

                    # Render the download page with repository information
                    context = {
                        "repo_name": repo_name,
                        "output_file": output_filename,
                        "file_size": file_size,
                        "file_count": file_count,
                        # Add any other interesting information
                    }
                    return render(request, "download.html", context)

            except RepositorySizeExceededError as e:
                error_message = str(e)
                logger.error(error_message)
                return render(
                    request,
                    "downloader.html",
                    {"form": form, "error_message": error_message},
                )
    else:
        form = RepositoryForm()
    return render(request, "downloader.html", {"form": form})


def download_file(request, file_name):
    file_path = os.path.join(settings.GENERATED_FILES_DIR, file_name)
    if os.path.exists(file_path):
        response = FileResponse(
            open(file_path, "rb"), content_type="application/octet-stream"
        )
        response["Content-Disposition"] = f'attachment; filename="{file_name}"'
        return response
    else:
        # Handle the case when the file is not found
        error_message = "The requested file has expired. Please generate a new file."
        messages.error(request, error_message)
        return redirect("download_repo")


def cleanup_generated_files():
    logger.info(
        "Performing cleanup of generated files in %s", settings.GENERATED_FILES_DIR
    )
    now = datetime.datetime.now()
    threshold = now - datetime.timedelta(minutes=CLEANUP_THRESHOLD)

    for filename in os.listdir(settings.GENERATED_FILES_DIR):
        logger.info(f"Checking file: {filename}")
        file_path = os.path.join(settings.GENERATED_FILES_DIR, filename)
        if os.path.isfile(file_path):
            modified_time = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
            logger.info(
                f"File: {filename}, Modified: {modified_time}, Threshold: {threshold}"
            )
            if modified_time < threshold:
                os.remove(file_path)
                logger.info(f"Removed generated file: {filename}")
