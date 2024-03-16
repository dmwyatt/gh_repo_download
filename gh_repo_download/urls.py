from django.urls import path

from downloader.views import download_file, download_repo_view

urlpatterns = [
    path("", download_repo_view, name="download_repo"),
    path("download/<path:file_name>/", download_file, name="download_file"),
]
