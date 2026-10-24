import os
import random
import zipfile
import uuid
from pathlib import Path

import pytest
from playwright.async_api import Page, expect


@pytest.mark.asyncio
async def test_repo_download_invalid_url_server_side_validation(
    page: Page, live_server
):
    await page.goto(live_server.url)

    # Remove the pattern attribute from the input field
    await page.evaluate(
        "document.querySelector('input[name=\"repo_url\"]').removeAttribute('pattern');"
    )
    await page.fill('input[name="repo_url"]', "https://not-a-real-url.com")

    # Press Enter to submit the form
    await page.press('input[name="repo_url"]', "Enter")

    # wait for a ul with a li containing the error message
    locator = page.locator("div[data-test-id='repo-url-server-errors'] > ul > li")
    await expect(locator).to_contain_text(
        "Please provide a valid GitHub repository URL"
    )
    await page.pause()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_url",
    [
        "https://example.com/user/repo",
        "http://github.com/user/repo",
        "https://github.com/user",
        "github.com/user/repo",
        "https://github.com/user/repo/",
    ],
)
async def test_repo_url_field_rejects_invalid_urls(
    page: Page, live_server, invalid_url
):
    await page.goto(live_server.url)

    # Selector for the repo_url input field
    repo_url_selector = 'input[name="repo_url"]'

    # Fill the input with an invalid URL and submit the form
    await page.fill(repo_url_selector, invalid_url)
    await page.click("button#submit-github-url")

    # Check for validation message
    locator = page.locator(repo_url_selector)
    await expect(locator).to_be_visible()

    validation_message = await page.evaluate(
        "document.querySelector(\"input[name='repo_url']\").validationMessage"
    )

    assert validation_message
    assert not await page.evaluate(
        "document.querySelector(\"input[name='repo_url']\").checkValidity()"
    )


@pytest.fixture(scope="session")
def zip_file_fixture(tmpdir_factory):
    # Create a temporary directory for the zip file
    zip_dir = tmpdir_factory.mktemp("zip")

    zip_file_name = f"test-{uuid.uuid4()}.zip"

    zip_path = zip_dir.join(zip_file_name)

    # Define the file paths and contents
    file_contents = {
        "file1.txt": "Content of file1.txt",
        "dir1/file2.txt": "Content of file2.txt",
        "dir1/file3.txt": "Content of file3.txt",
        "dir2/file4.txt": "Content of file4.txt",
    }

    # Generate random binary data for binary files
    binary_data1 = bytes(random.getrandbits(8) for _ in range(1024))
    binary_data2 = bytes(random.getrandbits(8) for _ in range(2048))

    # Add binary file paths and contents to the dictionary
    file_contents["binary1.bin"] = binary_data1
    file_contents["dir3/binary2.bin"] = binary_data2

    # Create the file structure inside the zip file
    with zipfile.ZipFile(zip_path, "w") as zip_file:
        for file_path, content in file_contents.items():
            zip_file.writestr(file_path, content)

    # Return the path to the created zip file and the file contents dictionary
    yield str(zip_path), file_contents, zip_file_name

    # Clean up the temporary directory
    os.remove(zip_path)


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="ZIP upload temporarily removed, will come back in the future."
)
async def test_zip_file_upload_works(page: Page, zip_file_fixture, live_server):
    zip_file_path, file_contents, zip_file_name = zip_file_fixture

    await page.goto(live_server.url)
    file_input = page.locator('input[name="zip_file"]')

    await file_input.set_input_files(zip_file_path)

    await page.click('button[data-test-id="zip-file-submit"]')
    await expect(page).to_have_title(f"Download - {zip_file_name}")


@pytest.fixture(scope="session")
def binary_file(tmp_path_factory):
    binary_file_path: Path = tmp_path_factory.mktemp("binary") / "binary.bin"
    binary_data = bytes(random.getrandbits(8) for _ in range(128))
    binary_file_path.write_bytes(binary_data)
    yield binary_file_path
    os.remove(binary_file_path)


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="ZIP upload temporarily removed, will come back in the future."
)
async def test_zip_file_upload_invalid_zip_client_side_validation(
    page: Page, binary_file, live_server
):
    await page.goto(live_server.url)

    file_input = page.locator('input[name="zip_file"]')

    await file_input.set_input_files(binary_file)

    error_locator = page.locator("div#zipFileError")
    await expect(error_locator).to_have_text(
        "This file does not appear to be a valid ZIP file."
    )


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="ZIP upload temporarily removed, will come back in the future."
)
async def test_zip_file_upload_too_big_client_side_validation(
    page: Page, zip_file_fixture, live_server, settings
):
    settings.MAX_REPO_SIZE = 1  # 1 byte!
    await page.goto(live_server.url)
    zip_file_path, file_contents, zip_file_name = zip_file_fixture
    file_input = page.locator('input[name="zip_file"]')
    await file_input.set_input_files(zip_file_path)
    error_locator = page.locator("div#zipFileError")
    await expect(error_locator).to_have_text("This file is too large to process here.")


# async def test_zip_file_upload_too_big_server_side_validation(
#     page: Page, zip_file_fixture, live_server, settings
# ):
#     settings.MAX_REPO_SIZE = 1  # 1 byte!
#     await page.goto(live_server.url)
#     zip_file_path, file_contents, zip_file_name = zip_file_fixture
#     file_input = page.locator('input[name="zip_file"]')
#     await file_input.set_input_files(zip_file_path)
#     await page.click('button[data-test-id="zip-file-submit"]')
#     await page.pause()


@pytest.mark.asyncio
@pytest.mark.skip(reason="This test is for testing test environment configuration.")
async def test_static_file_access(page: Page, live_server):
    """
    Add the following element somewhere to `downloader.html` or whatever the
    template served at / is.

    <img src="{% static 'downloader/dummy.txt' %}" alt="Dummy File">
    """
    await page.goto(live_server.url)

    # Get the static file URL
    static_file_url = await page.evaluate(
        "document.querySelector('img[src$=\"static/downloader/dummy.txt\"]').src"
    )

    # Navigate to the static file URL
    response = await page.goto(static_file_url)

    # Check the status of the static file response
    assert response.status in [
        200,
        304,
    ], f"Static file request failed with status {response.status}"
