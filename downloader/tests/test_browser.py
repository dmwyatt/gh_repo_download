import os
import random
import zipfile
import uuid
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect


def test_repo_download_invalid_url_server_side_validation(page: Page, live_server):
    page.goto(live_server.url)
    # Remove the pattern attribute from the input field
    page.evaluate(
        "document.querySelector('input[name=\"repo_url\"]').removeAttribute('pattern');"
    )
    page.fill('input[name="repo_url"]', "https://not-a-real-url.com")
    # Press Enter to submit the form
    page.press('input[name="repo_url"]', "Enter")
    # wait for a ul with a li containing the error message

    locator = page.locator("div[data-test-id='repo-url-server-errors'] > ul > li")
    expect(locator).to_contain_text("Please provide a valid GitHub repository URL")


def test_repo_url_field_attributes(page: Page, live_server):
    page.goto(live_server.url)

    # Selector for the repo_url input field
    repo_url_selector = 'input[name="repo_url"]'

    locator = page.locator(repo_url_selector)
    expect(locator).to_be_visible()
    expect(locator).to_have_attribute("pattern", "https://github\\.com/.+/.+")
    expect(locator).to_have_attribute(
        "title", "Please enter a valid GitHub repository URL."
    )


def test_repo_url_this_sites_repo(page: Page, live_server):
    page.goto(live_server.url)
    # click button with "Test it out with this site's repo!" text
    page.click('text="Test it out with this site\'s repo!"')
    # wait for the form to be filled
    expected_url = "https://github.com/dmwyatt/gh_repo_download"

    locator = page.locator('input[name="repo_url"]')

    expect(locator).to_have_value(expected_url)


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


def test_zip_file_upload_works(page: Page, zip_file_fixture, live_server):
    zip_file_path, file_contents, zip_file_name = zip_file_fixture

    page.goto(live_server.url)
    file_input = page.locator('input[name="zip_file"]')

    file_input.set_input_files(zip_file_path)

    page.click('button[data-test-id="zip-file-submit"]')
    expect(page).to_have_title(f"Download - {zip_file_name}")


@pytest.fixture(scope="session")
def binary_file(tmp_path_factory):
    binary_file_path: Path = tmp_path_factory.mktemp("binary") / "binary.bin"
    binary_data = bytes(random.getrandbits(8) for _ in range(1024))
    binary_file_path.write_bytes(binary_data)
    yield binary_file_path
    os.remove(binary_file_path)


def test_zip_file_upload_invalid_zip_client_side_validation(
    page: Page, binary_file, live_server
):
    page.goto(live_server.url)
    file_input = page.locator('input[name="zip_file"]')
    file_input.set_input_files(binary_file)

    error_locator = page.locator("div#zipFileError")
    expect(error_locator).to_have_text(
        "This file does not appear to be a valid ZIP file."
    )

    # page.pause()
    # page.click('button[data-test-id="zip-file-submit"]')
    # locator = page.locator("div[data-test-id='zip-file-server-errors'] > ul > li")
    # expect(locator).to_have_text("File is not a valid ZIP file.")
    # page.pause()
