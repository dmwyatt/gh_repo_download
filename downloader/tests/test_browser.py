from playwright.sync_api import Page


def test_repo_download_invalid_url(page: Page, live_server):
    page.goto(live_server.url)
    page.fill('input[name="repo_url"]', "https://not-a-real-url.com")
    # Press Enter to submit the form
    page.press('input[name="repo_url"]', "Enter")
    # wait for a ul with a li containing the error message
    page.wait_for_selector("ul.errorlist > li")
    assert (
        page.inner_text("ul.errorlist > li")
        == "Please provide a valid GitHub repository URL"
    )
