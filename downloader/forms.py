from urllib.parse import urlparse

from django import forms


def validate_repo_url(value):
    # parse the url and check if it is a valid GitHub repository
    parsed = urlparse(value)
    msg = "Please provide a valid GitHub repository URL"
    if parsed.netloc != "github.com":
        raise forms.ValidationError(msg)
    # check if the path has at least 2 parts
    path_parts = parsed.path.strip("/").split("/")
    if len(path_parts) < 2:
        raise forms.ValidationError(msg)
    # must be http(s) protocol
    if parsed.scheme not in ["http", "https"]:
        raise forms.ValidationError(msg)


class RepositoryForm(forms.Form):
    repo_url = forms.URLField(
        label="GitHub Repository URL",
        validators=[validate_repo_url],
        required=True,
        widget=forms.URLInput(
            attrs={
                "pattern": r"https?://github\.com/.+",
                "title": "Please enter a valid GitHub URL e.g. 'https://github.com/dmwyatt/gh_repo_download'",
            }
        ),
    )

    def clean(self):
        # make a "clean" url.  We only want the domain, username, and repo name
        cleaned_data = super().clean()
        repo_url = cleaned_data.get("repo_url")
        if repo_url:
            parsed = urlparse(repo_url)
            if repo_url:
                parsed = urlparse(repo_url)
                path_parts = parsed.path.strip("/").split("/")
                cleaned_data["username"] = path_parts[0]
                cleaned_data["repo_name"] = path_parts[1]
        return cleaned_data
