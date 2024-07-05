import os
import urllib

import pytest
from django.urls import reverse


@pytest.fixture
def expected_content():
    expected_content_file = os.path.join(
        os.path.dirname(__file__), "data", "gh_repo_dl_test.txt"
    )
    with open(expected_content_file, "r") as f:
        return f.read()


@pytest.mark.asyncio
async def test_repository_downloader_integration(async_client, expected_content):
    url = reverse("download_repo")
    test_repo_url = "https://github.com/dmwyatt/gh_repo_dl_test"

    # Send a POST request to the view with the test repository URL
    response = await async_client.post(url, {"repo_url": test_repo_url}, follow=True)

    # Check that the response is successful
    assert response.status_code == 200

    # Check that the response contains the expected template
    assert "download.html" in [t.name for t in response.templates]

    # Extract the data URI from the response content
    data_uri = (
        response.content.decode("utf-8")
        .split("data:text/plain;charset=utf-8,")[1]
        .split('"')[0]
    )

    # Decode the URL-encoded content
    decoded_content = urllib.parse.unquote(data_uri)

    # Compare the decoded content with the expected content
    assert decoded_content == expected_content


@pytest.mark.asyncio
async def test_invalid_repository_url(async_client):
    url = reverse("download_repo")
    invalid_url = "https://github.com/invalid/repo"

    # Send a POST request with an invalid repository URL
    response = await async_client.post(url, {"repo_url": invalid_url})

    # Check that the response redirects to the download result page
    assert response.status_code == 302
    assert response.url == reverse(
        "download_result", kwargs={"username": "invalid", "repo_name": "repo"}
    )

    # Follow the redirect
    response = await async_client.post(url, {"repo_url": invalid_url}, follow=True)

    # Check that the response is successful after following the redirects
    assert response.status_code == 200

    # Check that the response contains the form page template
    assert "downloader_new.html" in [t.name for t in response.templates]

    # Check that the error message is displayed on the form page
    assert "error_message" in response.context
    assert (
        response.context["error_message"]
        == "Repository not found at https://github.com/invalid/repo/archive/master.zip"
    )
