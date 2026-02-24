# PantryChef Backend

Django + Django Ninja REST API for the PantryChef recipe generator app.

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager

## Setup

```bash
cd backend

# Install dependencies
uv sync

# Copy env file and fill in your values
cp .env.example .env

# Run migrations (use direct connection to bypass PgBouncer)
DATABASE_URL=$DIRECT_URL uv run python manage.py migrate
```

## Running

```bash
uv run python manage.py runserver
```

- API: http://localhost:8000/api/v1/
- Docs (Swagger): http://localhost:8000/api/v1/docs
- Health check: http://localhost:8000/api/v1/health

## Tests

```bash
uv run pytest tests/ -v
```

Tests use in-memory SQLite with hardcoded secrets — no `.env` needed.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | No | Health check |
| GET | `/api/v1/me` | Yes | Get current user profile |
| PATCH | `/api/v1/me` | Yes | Update profile |

All authenticated endpoints require `Authorization: Bearer <supabase_jwt>`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Django secret key |
| `DATABASE_URL` | Pooled Supabase Postgres connection (port 6543) |
| `DIRECT_URL` | Direct Supabase Postgres connection (port 5432, for migrations) |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase dashboard > Settings > API |
