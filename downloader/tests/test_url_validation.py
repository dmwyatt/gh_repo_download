import pytest
from django.core.exceptions import ValidationError

from downloader.forms import validate_repo_url


# A happy path test
def test_validate_repo_url_valid():
    url = "https://github.com/username/repository"
    assert validate_repo_url(url) is None


# A failure case
def test_validate_repo_url_invalid():
    url = "https://notgithub.com/username/repository"
    with pytest.raises(ValidationError) as exc:
        validate_repo_url(url)
    assert str(exc.value.messages[0]) == "Please provide a valid GitHub repository URL"


@pytest.mark.parametrize(
    "url, exception_msg",
    [
        ("https://github.com", "Please provide a valid GitHub repository URL"),
        (
            "github.com/username/repository",
            "Please provide a valid GitHub repository URL",
        ),
        ("", "Please provide a valid GitHub repository URL"),
        (
            "https://otherurl.com/username/repository",
            "Please provide a valid GitHub repository URL",
        ),
        (
            "ftp://github.com/username/repository",
            "Please provide a valid GitHub repository URL",
        ),
    ],
)
def test_validate_repo_url_edgecases(url, exception_msg):
    with pytest.raises(ValidationError) as exc:
        validate_repo_url(url)
    assert str(exc.value.messages[0]) == exception_msg
