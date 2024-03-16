from urllib.parse import urlparse

from django import forms

def validate_repo_url(value):
    # parse the url and check if it is a valid GitHub repository
    parsed = urlparse(value)
    if parsed.netloc != "github.com":
        raise forms.ValidationError("Invalid GitHub repository URL")


class RepositoryForm(forms.Form):
    repo_url = forms.URLField(label='GitHub Repository URL', validators=[validate_repo_url])


