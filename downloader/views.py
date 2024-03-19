import logging
from urllib.parse import quote

from django.conf import settings
from django.shortcuts import render

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
            repo_url = form.cleaned_data["repo_url"]
            repo_name = repo_url.split("/")[-1]
            logger.info(f"Processing repository: {repo_url}")

            try:
                # Download and extract the repository
                zip_file = await download_repo(repo_url)
            except RepositorySizeExceededError as e:
                error_message = str(e)
                logger.error(error_message)
                return render(
                    request,
                    "downloader.html",
                    {"form": form, "error_message": error_message},
                )
            except RepositoryDownloadError as e:
                error_message = str(e)
                logger.error(error_message)
                return render(
                    request,
                    "downloader.html",
                    {"form": form, "error_message": error_message},
                )

            extraction = await extract_text_files(
                zip_file,
                max_files=settings.MAX_FILE_COUNT,
                max_total_size=settings.MAX_TEXT_SIZE,
            )
            rendered_text = extraction.render_template(repo_name, "repo_template.txt")
            context = {
                "repo_name": repo_name,
                "encoded_file_content": quote(rendered_text),
                "file_size": len(rendered_text),
                "concatenated_file_count": len(extraction.text_files),
                "total_file_count": extraction.total_files_count,
            }
            return render(request, "download.html", context)

    else:
        form = RepositoryForm()
    return render(request, "downloader.html", {"form": form})
