from .base import *

DEBUG = False
DJANGO_VITE["default"]["dev_mode"] = DEBUG

# remove whitenoise middleware
MIDDLEWARE = [
    middleware
    for middleware in MIDDLEWARE
    if "whitenoise.middleware.WhiteNoiseMiddleware" not in middleware
]
