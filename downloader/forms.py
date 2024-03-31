import logging
import io
import zipfile
from urllib.parse import urlparse

from django import forms
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from django.template.defaultfilters import filesizeformat


logger = logging.getLogger(__name__)


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


def validate_file_size(value):
    if value.size > settings.MAX_REPO_SIZE:
        raise forms.ValidationError(
            f"File size of {filesizeformat(value.size)} exceeds "
            f"maximum allowed size of {settings.MAX_REPO_SIZE} bytes."
        )


def validate_is_zip(value: UploadedFile):
    # note that is is a preliminary check. It's possible to maliciously create a file
    # that passes this check.  We won't know for sure until we later try to extract it.
    magic_bytes = b"PK\x03\x04"

    for chunk in value.chunks():
        if chunk.startswith(magic_bytes):
            return
        raise forms.ValidationError("File is not a valid ZIP file.")


class RepositoryURLForm(forms.Form):
    repo_url = forms.URLField(
        label="GitHub Repository URL",
        validators=[validate_repo_url],
        widget=forms.URLInput(
            attrs={
                "pattern": "https://github\.com/.+/.+",
                "title": "Please enter a valid GitHub repository URL.",
            }
        ),
    )

    def clean_repo_url(self):
        repo_url = self.cleaned_data["repo_url"]
        parsed = urlparse(repo_url)
        path_parts = parsed.path.strip("/").split("/")
        username = path_parts[0]
        repo_name = path_parts[1].split(".")[0]
        return repo_url, username, repo_name


class ZipFileForm(forms.Form):
    zip_file = forms.FileField(
        label="ZIP File",
        validators=[validate_file_size, validate_is_zip],
        # restrict to ZIP files
        widget=forms.FileInput(attrs={"accept": ".zip"}),
    )

    def clean_zip_file(self):
        file = self.cleaned_data["zip_file"]
        data = b"".join(chunk for chunk in file.chunks())

        try:
            zip_file = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile:
            error_message = "The uploaded file is not a valid zip file."
            raise ValidationError(error_message)

        return (
            zip_file,
            file.name,
            file.size,
            sum(file.file_size for file in zip_file.infolist()),
        )
