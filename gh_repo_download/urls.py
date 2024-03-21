from django.urls import path

from downloader import views

urlpatterns = [
    path('', views.download_repo_view, name='download_repo'),
    path('download/result/<str:username>/<str:repo_name>/', views.download_result_view, name='download_result'),
]
