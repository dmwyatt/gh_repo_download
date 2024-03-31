from playwright.sync_api import Page


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
    page.wait_for_selector("div[data-test-id='repo-url-server-errors']")
    assert (
        page.inner_text("ul.errorlist > li")
        == "Please provide a valid GitHub repository URL"
    )


def test_repo_url_field_attributes(page: Page, live_server):
    page.goto(live_server.url)

    # Selector for the repo_url input field
    repo_url_selector = 'input[name="repo_url"]'

    # Retrieve the 'pattern' attribute from the input element
    pattern_attr = page.get_attribute(repo_url_selector, "pattern")
    # Check that the pattern attribute is correctly set
    assert (
        pattern_attr == "https://github\\.com/.+/.+"
    ), "The pattern attribute does not match the expected value."

    # Retrieve the 'title' attribute from the input element
    title_attr = page.get_attribute(repo_url_selector, "title")
    # Check that the title attribute is correctly set to guide users
    assert (
        title_attr == "Please enter a valid GitHub repository URL."
    ), "The title attribute does not match the expected value."
