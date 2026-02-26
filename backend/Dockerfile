# Stage 1: Install dependencies
FROM python:3.12-slim AS deps

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files only (for layer caching)
COPY pyproject.toml uv.lock ./

# Install production dependencies (no dev group)
RUN uv sync --frozen --no-dev --no-install-project

# Stage 2: Application
FROM python:3.12-slim AS app

WORKDIR /app

# Copy virtualenv from deps stage
COPY --from=deps /app/.venv /app/.venv

# Ensure virtualenv binaries are on PATH
ENV PATH="/app/.venv/bin:$PATH"

# Copy application source
COPY . .

# Collect static files (Django Ninja docs UI, admin, whitenoise)
# Production settings require env vars for fail-fast validation,
# so we provide placeholders just for the collectstatic build step.
RUN DJANGO_SETTINGS_MODULE=config.settings.production \
    DJANGO_SECRET_KEY=collectstatic-placeholder \
    DATABASE_URL=sqlite:///tmp/placeholder.db \
    ALLOWED_HOSTS=localhost \
    CORS_ALLOWED_ORIGINS=http://localhost \
    SUPABASE_JWT_SECRET=placeholder \
    SUPABASE_URL=https://placeholder.supabase.co \
    python manage.py collectstatic --noinput

# Default port (Railway sets $PORT)
ENV PORT=8000

EXPOSE $PORT

# Gunicorn with Uvicorn workers for ASGI
# Shell form needed for $PORT env var expansion at runtime
CMD gunicorn config.asgi:application \
    -k uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT}" \
    --workers 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
