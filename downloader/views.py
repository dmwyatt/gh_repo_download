import datetime
import logging
import os
import random
import tempfile
from urllib.parse import quote

from django.conf import settings
from django.contrib import messages
from django.http import FileResponse
from django.shortcuts import redirect, render

from .file_utils import concat_files
from .forms import RepositoryForm
from .repo_utils import (
    RepositoryDownloadError,
    RepositorySizeExceededError,
    download_repo,
    extract_files,
)

logger = logging.getLogger(__name__)

os.makedirs(settings.GENERATED_FILES_DIR, exist_ok=True)

# Configure the cleanup settings
CLEANUP_PROBABILITY = 0.2  # Probability of performing cleanup on each view (20% chance)
CLEANUP_THRESHOLD = 10


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
            except RepositorySizeExceededError as e:
                error_message = str(e)
                logger.error(error_message)
                return render(
                    request,
                    "downloader.html",
                    {"form": form, "error_message": error_message},
                )
            except RepositoryDownloadError as e:
                print('wtf')
                error_message = str(e)
                logger.error(error_message)
                return render(
                    request,
                    "downloader.html",
                    {"form": form, "error_message": error_message},
                )

            with tempfile.TemporaryDirectory() as temp_dir:
                extracted_dir = await extract_files(zip_file, temp_dir)

                concat_data, total_file_count, concatenated_files_count = concat_files(
                    extracted_dir, repo_name
                )

                context = {
                    "repo_name": repo_name,
                    "encoded_file_content": quote(concat_data),
                    "file_size": len(concat_data),
                    "concatenated_file_count": concatenated_files_count,
                    "total_file_count": total_file_count,
                }
                return render(request, "download.html", context)

    else:
        form = RepositoryForm()
    return render(request, "downloader.html", {"form": form})


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
