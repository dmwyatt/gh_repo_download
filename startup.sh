#!/bin/bash

# Run Django collectstatic
python manage.py collectstatic --noinput

# Start Gunicorn
exec gunicorn gh_repo_download.asgi:application \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000
