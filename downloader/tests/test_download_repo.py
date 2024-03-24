import io
import zipfile

import pytest
from pytest_httpx import HTTPXMock

from downloader.repo_utils import (
    DownloadResult,
    RepositoryDownloadError,
    RepositorySizeExceededError,
    download_repo,
)


@pytest.mark.asyncio
async def test_download_repo_success(httpx_mock: HTTPXMock):
    repo_url = "https://example.com/repo"

    # Create a valid zip file content
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w") as zip_file:
        zip_file.writestr("file.txt", "Dummy file content")
    zip_content = zip_buffer.getvalue()

    httpx_mock.add_response(url=f"{repo_url}/archive/master.zip", content=zip_content)

    result = await download_repo(repo_url)

    assert isinstance(result, DownloadResult)
    assert result.download_size == len(zip_content)
    assert "file.txt" in result.zip_file.namelist()


@pytest.mark.asyncio
async def test_download_repo_not_found(httpx_mock: HTTPXMock):
    repo_url = "https://example.com/repo"

    httpx_mock.add_response(url=f"{repo_url}/archive/master.zip", status_code=404)

    with pytest.raises(RepositoryDownloadError):
        await download_repo(repo_url)


@pytest.mark.asyncio
async def test_download_repo_size_exceeded(httpx_mock: HTTPXMock, settings):
    repo_url = "https://example.com/repo"
    max_repo_size = 1024

    settings.MAX_REPO_SIZE = max_repo_size

    httpx_mock.add_response(
        url=f"{repo_url}/archive/master.zip",
        content=b"a" * (max_repo_size + 1),
        headers={"Content-Length": str(max_repo_size + 1)},
    )

    with pytest.raises(RepositorySizeExceededError):
        await download_repo(repo_url)


@pytest.mark.asyncio
async def test_download_repo_invalid_zip(httpx_mock: HTTPXMock):
    repo_url = "https://example.com/repo"
    invalid_zip_content = b"Invalid zip content"

    httpx_mock.add_response(
        url=f"{repo_url}/archive/master.zip", content=invalid_zip_content
    )

    with pytest.raises(RepositoryDownloadError):
        await download_repo(repo_url)


@pytest.mark.asyncio
async def test_download_repo_failed_request(httpx_mock: HTTPXMock):
    repo_url = "https://example.com/repo"

    httpx_mock.add_response(url=f"{repo_url}/archive/master.zip", status_code=500)

    with pytest.raises(RepositoryDownloadError):
        await download_repo(repo_url)


@pytest.mark.asyncio
async def test_download_repo_with_empty_repository(httpx_mock: HTTPXMock):
    repo_url = "https://example.com/repo"

    # Create a valid zip file content
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w") as zip_file:
        pass
    zip_content = zip_buffer.getvalue()

    httpx_mock.add_response(url=f"{repo_url}/archive/master.zip", content=zip_content)

    result = await download_repo(repo_url)

    assert isinstance(result, DownloadResult)
    assert result.download_size == len(zip_content)
