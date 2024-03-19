from urllib.parse import urlparse

from django import forms


def validate_repo_url(value):
    # parse the url and check if it is a valid GitHub repository
    parsed = urlparse(value)
    if parsed.netloc != "github.com":
        raise forms.ValidationError("Please provide a valid GitHub repository URL")


class RepositoryForm(forms.Form):
    repo_url = forms.URLField(
        label="GitHub Repository URL", validators=[validate_repo_url]
    )

    def clean(self):
        # make a "clean" url.  We only want the domain, username, and repo name
        cleaned_data = super().clean()
        repo_url = cleaned_data.get("repo_url")
        if repo_url:
            parsed = urlparse(repo_url)
            # only domain and first two parts of the path
            # the user might have pasted a path "deeper" in the repo
            # so we want to truncate it to the first two parts
            path = parsed.path
            path = parsed.path.split("/")
            fixed_up_path = "/".join(path[1:3])
            cleaned_data["repo_url"] = f"https://{parsed.netloc}/{fixed_up_path}"
        return cleaned_data
