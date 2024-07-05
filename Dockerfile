# Stage 1: Build stage for Node.js
FROM node:20 AS node-build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# outputs to /app/downloader/vite_assets_dist/
RUN npm run build


# Stage 2: Final stage
FROM python:3.12-slim-bookworm

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /code

COPY . /code/

# Copy the built files from the node-build stage
COPY --from=node-build /app/downloader/vite_assets_dist/ /code/downloader/vite_assets_dist/

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && . $HOME/.cargo/env \
    && cd /code \
    && uv pip compile requirements.in -o requirements.txt \
    && uv pip install --system -r requirements.txt \
    && uv pip install --system gunicorn uvicorn

EXPOSE 8000

COPY startup.sh /code/

RUN chmod +x /code/startup.sh

CMD ["/code/startup.sh"]
