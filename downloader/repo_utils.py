import asyncio
import io
import logging
import os
import zipfile

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


class RepositorySizeExceededError(Exception):
    pass


class RepositoryDownloadError(Exception):
    pass


async def download_repo(repo_url: str):
    """
    Asynchronously downloads and extracts a repository from a given URL.

    This function is primarily used to download a repository from a given URL,
    conduct checks on it, and make it ready for further processing. It returns a
    `zipfile.ZipFile` object of the downloaded repository.

    Args:
        repo_url (str): The URL of the repository.

    Returns:
        zipfile.ZipFile: An object representing the downloaded repository.

    Raises:
        RepositoryDownloadError: If there are issues with the repository download
            process.
        RepositorySizeExceededError: If the repository size exceeds the set limit.


    Notes:
        - Consider checking your repository URL before passing it to this function to
            ensure it's valid.
        - Repository size limitation and other policies related to the download
            process are managed by the settings in the application environment.

    """
    async with httpx.AsyncClient(follow_redirects=True) as client:
        url = repo_url + "/archive/master.zip"
        logger.info(f"Downloading repository from URL: {url}")

        async with client.stream("GET", url) as response:
            if response.status_code == 404:
                raise RepositoryDownloadError(f"Repository not found at {url}")
            response.raise_for_status()

            content_length_header = response.headers.get("Content-Length")
            max_repo_size = settings.MAX_REPO_SIZE
            if content_length_header and int(content_length_header) > max_repo_size:
                raise RepositorySizeExceededError(
                        f"Repository size exceeds the maximum allowed size: {content_length_header} bytes"
                )

            content = bytearray()
            async for chunk in response.aiter_bytes():
                content.extend(chunk)
                if len(content) > max_repo_size:
                    raise RepositorySizeExceededError(
                            f"Downloaded size exceeds the maximum allowed size: {len(content)} bytes"
                    )

            logger.info(f"Downloaded {len(content)} bytes from {url}")

        # After successful download, proceed with file processing
        try:
            zip_file = zipfile.ZipFile(io.BytesIO(content))
            logger.info(f"Successfully extracted zip file from {url}")
            return zip_file
        except zipfile.BadZipFile:
            logger.error(f"Invalid zip file content from {url}")
            raise RepositoryDownloadError(f"Invalid zip file content from {url}")
