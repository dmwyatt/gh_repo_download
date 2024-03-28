import pytest

from downloader.forms import RepositoryURLForm


def test_form_with_valid_input():
    # Arrange
    repo_url = "https://github.com/username/repo_name"
    form = RepositoryURLForm({"repo_url": repo_url})
    expected_username = "username"
    expected_repo_name = "repo_name"

    # Act
    is_valid = form.is_valid()

    # Assert
    assert is_valid is True, f"Error in form validation: {form.errors}"
    assert form.cleaned_data["repo_url"] == (
        repo_url,
        expected_username,
        expected_repo_name,
    )


def test_form_with_invalid_input():
    # Arrange
    form = RepositoryURLForm({"repo_url": "Not a valid URL"})

    # Act
    is_valid = form.is_valid()

    # Assert
    assert is_valid is False
    assert "repo_url" in form.errors


def test_form_without_input():
    # Arrange
    form = RepositoryURLForm({})

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
    form = RepositoryURLForm({"repo_url": repo_url})

    # Act
    is_valid = form.is_valid()

    # Assert
    assert is_valid is True, f"Error in form validation: {form.errors}"
    assert form.cleaned_data["repo_url"] == (repo_url, username, repo_name)
