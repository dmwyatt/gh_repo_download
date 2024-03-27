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
        required=False,
        widget=forms.URLInput(
            attrs={
                "pattern": r"https?://github\.com/.+",
                "title": "Please enter a valid GitHub URL e.g. 'https://github.com/username/repo'",
            }
        ),
        assume_scheme="https",
    )
    zip_file = forms.FileField(
        label="ZIP File",
        required=False,
        widget=forms.ClearableFileInput(attrs={"accept": ".zip"}),
    )

    def clean(self):
        cleaned_data = super().clean()
        repo_url = cleaned_data.get("repo_url")
        zip_file = cleaned_data.get("zip_file")

        if not repo_url and not zip_file:
            raise forms.ValidationError(
                "Please provide either a GitHub repository " "URL or a ZIP file."
            )

        if repo_url and zip_file:
            raise forms.ValidationError(
                "Please provide either a GitHub repository "
                "URL or a ZIP file, not both."
            )
        if repo_url:
            if repo_url:
                parsed = urlparse(repo_url)
                path_parts = parsed.path.strip("/").split("/")
                cleaned_data["username"] = path_parts[0]
                cleaned_data["repo_name"] = path_parts[1]
        return cleaned_data
