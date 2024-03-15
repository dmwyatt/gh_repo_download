import asyncio
import io
import logging
import os
import tempfile
import zipfile

import httpx
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import render
from django.template import loader

from .forms import RepositoryForm

logger = logging.getLogger(__name__)


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


async def concat_files(extracted_dir, repo_name):
    template = loader.get_template('repo_template.md')
    files = []
    for root, dirs, filenames in os.walk(extracted_dir):
        for filename in filenames:
            file_path = os.path.join(root, filename)
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read().strip()
                files.append({
                    'path': os.path.relpath(file_path, extracted_dir),
                    'content': content,
                })
                logger.info(f'Processing file: {file_path}')
                logger.debug(f'File content: {content}')

    context = {
        'repo_name': repo_name,
        'files': files
    }
    output_content = template.render(context)
    output_file = f'{repo_name}.md'
    output_path = os.path.join(os.path.dirname(extracted_dir), output_file)
    with open(output_path, 'w', encoding='utf-8') as outfile:
        outfile.write(output_content)
    return output_path

async def download_repo_view(request):
    if request.method == "POST":
        form = RepositoryForm(request.POST)
        if form.is_valid():
            repo_url = form.cleaned_data["repo_url"]
            repo_name = repo_url.split("/")[-1]
            logger.info(f"Processing repository: {repo_url}")

            with tempfile.TemporaryDirectory() as temp_dir:
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

                    extracted_dir = await extract_files(zip_file, temp_dir)

                    # Concatenate all files into a single .txt file
                    output_file = await concat_files(extracted_dir, repo_name)
                    logger.info(f"Concatenated files saved to {output_file}")
                    logger.info(
                        f"Size of {output_file}: {os.path.getsize(output_file)} bytes"
                    )

                    # Serve the concatenated file as a download
                    with open(output_file, "rb") as file:
                        response = HttpResponse(file.read(), content_type="text/plain")
                        response[
                            "Content-Disposition"
                        ] = f'attachment; filename="{repo_name}.txt"'
                        logger.info(
                            f"Serving concatenated file {output_file} as download"
                        )

                    # Clean up the output file
                    os.remove(output_file)
                    logger.info(f"Cleaned up output file for repository: {repo_url}")

                    return response
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
