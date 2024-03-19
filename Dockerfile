# Stage 1: Build stage for Node.js
FROM node:20 AS node-build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# Stage 2: Final stage
FROM python:3.11-slim-bookworm

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# for uv
ENV VIRTUAL_ENV /usr/local/

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /code

COPY . /code/

# Copy the built files from the node-build stage
COPY --from=node-build /app/staticfiles /code/staticfiles

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && . $HOME/.cargo/env \
    && cd /code \
    && uv pip compile requirements.in -o requirements.txt \
    && uv pip sync requirements.txt \
    && uv pip install gunicorn uvicorn

EXPOSE 8000

CMD ["gunicorn", \
     "gh_repo_download.asgi:application", \
     "--workers 4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000" \
 ]
