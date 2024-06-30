from django.conf import settings
from django.urls import include, path

from downloader import views

urlpatterns = [
    path("", views.download_repo_view, name="download_repo"),
    path(
        "download/result/<str:username>/<str:repo_name>/",
        views.download_result_view,
        name="download_result",
    ),
    path("newdl/", views.new_downloader_view, name="new_download"),
]

if settings.DEBUG:
    urlpatterns += [
        path("__debug__/", include("debug_toolbar.urls")),
    ]
