import pytest
from django.core.exceptions import ValidationError
from .forms import RepositoryForm, validate_repo_url


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


def test_form_with_valid_input():
    # Arrange
    form = RepositoryForm({"repo_url": "https://github.com/username/repo_name"})
    expected_username = "username"
    expected_repo_name = "repo_name"

    # Act
    is_valid = form.is_valid()

    # Assert
    assert is_valid is True, f"Error in form validation: {form.errors}"
    assert form.cleaned_data["username"] == expected_username
    assert form.cleaned_data["repo_name"] == expected_repo_name


def test_form_with_invalid_input():
    # Arrange
    form = RepositoryForm({"repo_url": "Not a valid URL"})

    # Act
    is_valid = form.is_valid()

    # Assert
    assert is_valid is False
    assert "repo_url" in form.errors


def test_form_without_input():
    # Arrange
    form = RepositoryForm({})

    # Act
    is_valid = form.is_valid()

    # Assert
    assert is_valid is False
    assert "repo_url" in form.errors


@pytest.mark.parametrize(
    "repo_url,username,repo_name",
    [
        ("https://github.com/username1/repo1", "username1", "repo1"),
        ("https://github.com/username2/repo2", "username2", "repo2"),
    ],
)
def test_form_with_multiple_valid_inputs(repo_url, username, repo_name):
    # Arrange
    form = RepositoryForm({"repo_url": repo_url})

    # Act
    is_valid = form.is_valid()

    # Assert
    assert is_valid is True, f"Error in form validation: {form.errors}"
    assert form.cleaned_data["username"] == username
    assert form.cleaned_data["repo_name"] == repo_name
