import pytest
from django.contrib.sessions.backends.signed_cookies import SessionStore
from django.urls import reverse
from django.test import AsyncClient
from unittest.mock import AsyncMock, patch

from downloader.repo_utils import (
    DownloadResult,
    RepositoryDownloadError,
    RepositorySizeExceededError,
)
from downloader.file_utils import ExtractionResult


def test_download_repo_view_get(client):
    url = reverse("download_repo")
    response = client.get(url)
    assert response.status_code == 200
    assert "downloader.html" in [t.name for t in response.templates]
    assert "repo_url_form" in response.context
    assert "zip_file_form" in response.context


def test_download_repo_view_post_valid_form(client):
    url = reverse("download_repo")
    data = {"repo_url": "https://github.com/username/repo"}
    response = client.post(url, data)
    assert response.status_code == 302
    assert response.url == reverse(
        "download_result", kwargs={"username": "username", "repo_name": "repo"}
    )


def test_download_repo_view_post_invalid_form(client):
    url = reverse("download_repo")
    data = {"repo_url": "invalid_url"}
    response = client.post(url, data)
    assert response.status_code == 200
    assert "repo_url_form" in response.context
    assert response.context["repo_url_form"].errors


@pytest.mark.asyncio
@patch("downloader.views.download_repo", new_callable=AsyncMock)
@patch("downloader.views.extract_text_files", new_callable=AsyncMock)
async def test_download_result_view_success(
    mock_extract_text_files, mock_download_repo, client, settings
):
    mock_download_repo.return_value = DownloadResult(None, 1000, 5000)
    mock_extract_text_files.return_value = ExtractionResult(
        {"file1.txt": "File 1 content"}, False, False, 1
    )

    url = reverse(
        "download_result", kwargs={"username": "username", "repo_name": "repo"}
    )

    # Use AsyncClient instead of Client
    async_client = AsyncClient()
    response = await async_client.get(url)

    assert response.status_code == 200
    assert "download.html" in [t.name for t in response.templates]
    assert response.context["repo_name"] == "repo"
    assert response.context["encoded_file_content"]
    assert response.context["download_file_size"]
    assert response.context["concatenated_file_count"] == 1
    assert response.context["total_file_count"] == 1
    assert response.context["zip_file_size"] == 1000
    assert response.context["total_uncompressed_size"] == 5000

    mock_download_repo.assert_called_once_with("https://github.com/username/repo")
    mock_extract_text_files.assert_called_once_with(
        None,
        max_files=settings.MAX_FILE_COUNT,
        max_total_size=settings.MAX_TEXT_SIZE,
        exclude_files=[],
    )


@pytest.mark.asyncio
@patch("downloader.views.download_repo", new_callable=AsyncMock)
async def test_download_result_view_repo_size_exceeded(mock_download_repo):
    mock_download_repo.side_effect = RepositorySizeExceededError(
        "Repository size exceeded"
    )

    async_client = AsyncClient()
    url = reverse(
        "download_result", kwargs={"username": "username", "repo_name": "repo"}
    )
    response = await async_client.get(url)

    assert response.status_code == 302
    assert response.url == reverse("download_repo")

    session = SessionStore(response.cookies["sessionid"].value)
    assert "error_message" in session
    assert session["error_message"] == "Repository size exceeded"


@pytest.mark.asyncio
@patch("downloader.views.download_repo", new_callable=AsyncMock)
async def test_download_result_view_repo_download_error(mock_download_repo):
    mock_download_repo.side_effect = RepositoryDownloadError(
        "Failed to download repository"
    )

    async_client = AsyncClient()
    url = reverse(
        "download_result", kwargs={"username": "username", "repo_name": "repo"}
    )
    response = await async_client.get(url)

    assert response.status_code == 302
    assert response.url == reverse("download_repo")

    session = SessionStore(response.cookies["sessionid"].value)
    assert "error_message" in session
    assert session["error_message"] == "Failed to download repository"
