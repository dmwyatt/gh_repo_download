FROM python:3.11-slim-bookworm

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# for uv
ENV VIRTUAL_ENV /usr/local/

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl

WORKDIR /code

COPY . /code/

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && . $HOME/.cargo/env \
    && uv pip compile requirements.in -o requirements.txt \
    && uv pip sync requirements.txt

EXPOSE 8000

CMD ["gunicorn", \
     "template_streaming_shadow_dom.asgi:application", \
     "--workers 4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000" \
 ]
