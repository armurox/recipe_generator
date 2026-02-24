# PantryChef Backend

Django + Django Ninja REST API for the PantryChef recipe generator app.

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| Framework | Django + Django Ninja | 5.1 / 1.3 |
| Language | Python | 3.12+ |
| Package manager | uv | latest |
| Database | Supabase Postgres (via psycopg) | — |
| Auth | Supabase JWT (PyJWT, HS256) | — |
| ASGI server | uvicorn | 0.34 |
| HTTP client | httpx | 0.28 |
| OCR | Anthropic Claude Vision | — |
| Linting | ruff | 0.9 |
| Type checking | ty | 0.0.x (early-stage) |
| Testing | pytest + pytest-django + factory_boy | — |
| Pre-commit | pre-commit (via ruff-pre-commit + local ty hook) | 4.x |
| CI | GitHub Actions (ubuntu-latest, Python 3.12) | — |

## Data Models

| App | Models |
|-----|--------|
| `core` | `AbstractTimestampModel`, `AbstractIdTimestampModel`, `AbstractUUIDTimestampModel` (abstract bases) |
| `users` | `User` (Supabase UUID PK, email, dietary_prefs, household_size) |
| `ingredients` | `IngredientCategory`, `Ingredient` |
| `receipts` | `ReceiptScan`, `ReceiptItem` |
| `pantry` | `PantryItem` (tracks quantity, expiry, source) |
| `recipes` | `Recipe`, `SavedRecipe`, `CookingLog` |

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager

## Setup

```bash
cd backend

# Install all dependencies (including dev tools)
uv sync

# Copy env file and fill in your values
cp .env.example .env

# Run migrations (use direct connection to bypass PgBouncer)
DATABASE_URL=$DIRECT_URL uv run python manage.py migrate

# Seed ingredient categories (25 categories, idempotent)
uv run python manage.py seed_categories
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

Tests use in-memory SQLite with hardcoded secrets — no `.env` needed. Run tests before pushing.

## Linting & Type Checking

```bash
# Lint (with auto-fix)
uv run ruff check --fix

# Format
uv run ruff format

# Type check
uv run ty check
```

## Pre-commit Hooks

Pre-commit runs automatically on every `git commit`:

| Hook | Tool | What it does |
|------|------|--------------|
| `ruff` | [ruff-pre-commit](https://github.com/astral-sh/ruff-pre-commit) v0.9.10 | Lint check with `--fix` |
| `ruff-format` | [ruff-pre-commit](https://github.com/astral-sh/ruff-pre-commit) v0.9.10 | Code formatting |
| `ty` | Local hook via `uv run ty check` | Type checking (runs in `backend/`) |

To install hooks after cloning:

```bash
uv run pre-commit install
```

To run hooks manually on all files:

```bash
uv run pre-commit run --all-files
```

Tests are **not** in pre-commit — run them manually before pushing.

## CI (GitHub Actions)

CI runs on PRs to `main` and pushes to `main` (`.github/workflows/ci.yml`):

| Job | Steps |
|-----|-------|
| **Lint & Type Check** | `ruff check` → `ruff format --check` → `ty check` |
| **Tests** | `pytest tests/ -v` (SQLite in-memory, no secrets) |

Both jobs run on `ubuntu-latest` with Python 3.12, using `astral-sh/setup-uv` for dependency management.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | No | Health check |
| GET | `/api/v1/me` | Yes | Get current user profile |
| PATCH | `/api/v1/me` | Yes | Update profile |

All authenticated endpoints require `Authorization: Bearer <supabase_jwt>`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DJANGO_SECRET_KEY` | Yes | Django secret key |
| `DATABASE_URL` | Yes | Pooled Supabase Postgres connection (port 6543) |
| `DIRECT_URL` | Yes | Direct Supabase Postgres connection (port 5432, for migrations) |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret from Supabase dashboard > Settings > API |
| `ALLOWED_HOSTS` | Prod | Comma-separated production domain(s) |
| `CORS_ALLOWED_ORIGINS` | Prod | Frontend URL for CORS |
