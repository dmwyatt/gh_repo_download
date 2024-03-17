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
    async with (httpx.AsyncClient(follow_redirects=True) as client):
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
            except zipfile.BadZipFile as e:
                logger.error(f"Invalid zip file content from {url}")
                logger.debug(f"Content: {content}")
                raise RepositoryDownloadError(
                    f"Invalid zip file content from {url}"
                ) from e
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
