from playwright.sync_api import Page


def test_repo_download(page: Page, live_server):
    page.goto(live_server.url)
    page.fill('input[name="repo_url"]', "https://not-a-real-url.com")
    # Press Enter to submit the form
    page.press('input[name="repo_url"]', "Enter")
