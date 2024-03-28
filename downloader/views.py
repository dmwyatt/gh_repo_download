import logging
from urllib.parse import quote

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render

from .file_utils import ExtractionResult, extract_text_files
from .forms import RepositoryURLForm, ZipFileForm
from .repo_utils import (
    DownloadResult,
    RepositoryDownloadError,
    RepositorySizeExceededError,
    download_repo,
)

logger = logging.getLogger(__name__)


async def download_repo_view(request: HttpRequest) -> HttpResponse:
    context = {
        "repo_url_form": RepositoryURLForm(),
        "zip_file_form": ZipFileForm(),
        "MAX_REPO_SIZE": settings.MAX_REPO_SIZE,
    }

    if request.method == "POST":
        if "repo_url" in request.POST:
            return _handle_repo_url_form(request, context)
        elif "zip_file" in request.FILES:
            return await _handle_zip_file_form(request, context)
        else:
            return redirect("download_repo")
    else:
        error_message = request.session.pop("error_message", None)
        context["error_message"] = error_message
        return render(request, "downloader.html", context)


def _handle_repo_url_form(request: HttpRequest, context):
    repo_url_form = RepositoryURLForm(request.POST)
    if repo_url_form.is_valid():
        _, username, repo_name = repo_url_form.cleaned_data["repo_url"]
        return redirect("download_result", username=username, repo_name=repo_name)
    else:
        context["repo_url_form"] = repo_url_form
        return render(request, "downloader.html", context)


async def _handle_zip_file_form(request: HttpRequest, context):
    zip_file_form = ZipFileForm(request.POST, request.FILES)
    if zip_file_form.is_valid():
        file, name, size, uncompressed_size = zip_file_form.cleaned_data["zip_file"]
        extraction = await extract_text_files(file)
        # when the user uploads a zip file, we don't redirect to another page with
        # the results, we render the results template on the same url.
        return render(
            request,
            "download.html",
            _get_extraction_context(
                extraction, name, DownloadResult(file, size, uncompressed_size)
            ),
        )
    else:
        context["zip_file_form"] = zip_file_form
        return render(request, "downloader.html", context)


async def download_result_view(request, username, repo_name):
    repo_url = f"https://github.com/{username}/{repo_name}"

    try:
        # Download and extract the repository
        result = await download_repo(repo_url)
    except RepositorySizeExceededError as e:
        error_message = str(e)
        logger.error(error_message)
        request.session["error_message"] = error_message
        return redirect("download_repo")
    except RepositoryDownloadError as e:
        error_message = str(e)
        logger.error(error_message)
        request.session["error_message"] = error_message
        return redirect("download_repo")

    # Process the downloaded repository

    extraction = await extract_text_files(
        result.zip_file,
        max_files=settings.MAX_FILE_COUNT,
        max_total_size=settings.MAX_TEXT_SIZE,
        # this file is excluded from the text extraction on our home repo because
        # it's a little weird to include its contents in the download. People
        # won't understand why it's there, LLMs will be confused, it will take up
        # token limits, etc.  See
        # `downloader.tests.test_repo_download.test_invalid_repository_url` for
        # its real purpose.
        exclude_files=["downloader/tests/data/gh_repo_dl_test.txt"]
        if username == "dmwyatt" and repo_name == "gh_repo_download"
        else [],
    )

    return render(
        request, "download.html", _get_extraction_context(extraction, repo_name, result)
    )


def _get_extraction_context(
    extraction: ExtractionResult, repo_name: str, result: DownloadResult
):
    rendered_text = extraction.render_template(repo_name, "repo_template.txt")
    return {
        "repo_name": repo_name,
        "encoded_file_content": quote(rendered_text),
        "download_file_size": len(rendered_text),
        "concatenated_file_count": len(extraction.text_files),
        "total_file_count": extraction.total_files_count,
        "zip_file_size": result.download_size,
        "total_uncompressed_size": result.uncompressed_size,
    }
