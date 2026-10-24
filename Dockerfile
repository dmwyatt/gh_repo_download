# Stage 1: Build stage for Node.js
FROM node:20 AS node-build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# outputs to /app/downloader/vite_assets_dist/
RUN npm run build


# Stage 2: Final stage
FROM python:3.12-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /uvx /bin/

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/code/.venv/bin:$PATH"

WORKDIR /code

# Install dependencies before copying the source so this layer stays cached
# until pyproject.toml or uv.lock changes.
COPY pyproject.toml uv.lock .python-version /code/
RUN uv sync --locked --no-dev

COPY . /code/

# Copy the built files from the node-build stage
COPY --from=node-build /app/downloader/vite_assets_dist/ /code/downloader/vite_assets_dist/

EXPOSE 8000

COPY startup.sh /code/

RUN chmod +x /code/startup.sh

CMD ["/code/startup.sh"]
