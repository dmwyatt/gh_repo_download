import logging
from urllib.parse import quote

from django.conf import settings
from django.shortcuts import redirect, render

from .file_utils import extract_text_files
from .forms import RepositoryForm
from .repo_utils import (
    RepositoryDownloadError,
    RepositorySizeExceededError,
    download_repo,
)

logger = logging.getLogger(__name__)


async def download_repo_view(request):
    if request.method == "POST":
        form = RepositoryForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data["username"]
            repo_name = form.cleaned_data["repo_name"]
            return redirect("download_result", username=username, repo_name=repo_name)
    else:
        form = RepositoryForm()
        error_message = request.session.pop("error_message", None)
        context = {
            "form": form,
            "error_message": error_message,
            "MAX_REPO_SIZE": settings.MAX_REPO_SIZE,
            "MAX_FILE_COUNT": settings.MAX_FILE_COUNT,
            "MAX_TEXT_SIZE": settings.MAX_TEXT_SIZE,
        }

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
    )
    rendered_text = extraction.render_template(repo_name, "repo_template.txt")
    context = {
        "repo_name": repo_name,
        "encoded_file_content": quote(rendered_text),
        "download_file_size": len(rendered_text),
        "concatenated_file_count": len(extraction.text_files),
        "total_file_count": extraction.total_files_count,
        "zip_file_size": result.download_size,
        "total_uncompressed_size": result.uncompressed_size,
    }

    return render(request, "download.html", context)
