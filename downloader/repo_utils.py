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


async def download_repo(repo_url):
    async with httpx.AsyncClient(follow_redirects=True) as client:
        url = repo_url + "/archive/master.zip"
        logger.info(f"Downloading repository from URL: {url}")

        # Use .stream() as a context manager for streaming the response
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


async def extract_files(zip_file, temp_dir):
    loop = asyncio.get_event_loop()
    extracted_dir = await loop.run_in_executor(
        None, lambda: zip_file.namelist()[0].split("/")[0]
    )
    extraction_path = os.path.join(temp_dir, extracted_dir)
    await loop.run_in_executor(None, lambda: zip_file.extractall(path=temp_dir))
    return extraction_path
