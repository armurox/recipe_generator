# PantryChef Backend

Django + Django Ninja REST API for the PantryChef recipe generator app.

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| Framework | Django + Django Ninja | 6.0 / 1.3 |
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

All authenticated endpoints require `Authorization: Bearer <supabase_jwt>`.
Swagger docs available at http://localhost:8000/api/v1/docs.

### Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | No | Health check |
| GET | `/api/v1/me` | Yes | Get current user profile |
| PATCH | `/api/v1/me` | Yes | Update profile |
| POST | `/api/v1/receipts/scan` | Yes | OCR-extract items from receipt image |
| GET | `/api/v1/receipts/` | Yes | List receipt scans (paginated) |
| GET | `/api/v1/receipts/{id}` | Yes | Get scan detail with items |
| POST | `/api/v1/receipts/{id}/confirm` | Yes | Confirm items → add to pantry |
| DELETE | `/api/v1/receipts/{id}` | Yes | Delete scan and its items |
| GET | `/api/v1/pantry/` | Yes | List pantry items (paginated, filterable) |
| GET | `/api/v1/pantry/expiring` | Yes | Items expiring within N days |
| GET | `/api/v1/pantry/summary` | Yes | Category-level dashboard summary |
| POST | `/api/v1/pantry/` | Yes | Add item manually (upserts if exists) |
| PATCH | `/api/v1/pantry/{id}` | Yes | Update item fields |
| DELETE | `/api/v1/pantry/{id}` | Yes | Delete item |
| POST | `/api/v1/pantry/{id}/use` | Yes | Mark item as partially/fully used |

---

### Users — `/api/v1/me`

**GET /me** → `UserOut`
```json
{ "id": "uuid", "email": "...", "display_name": "...", "dietary_prefs": [], "household_size": 1 }
```

**PATCH /me** — partial update (display_name, dietary_prefs, household_size)

---

### Receipt Scanning — `/api/v1/receipts`

**Scan flow:**
1. Frontend uploads image to Supabase Storage
2. `POST /receipts/scan` with `{"image_url": "..."}` → Claude Vision extracts items
3. User reviews extracted items in the response
4. `POST /receipts/{id}/confirm` with selected items → adds to pantry

**POST /receipts/scan** → `ReceiptScanDetailOut`

Request:
```json
{ "image_url": "https://supabase.co/.../receipt.jpg" }
```

Response (200):
```json
{
  "id": "uuid",
  "image_url": "...",
  "store_name": "Test Grocery",
  "scanned_at": "2026-02-25T...",
  "status": "completed",
  "items": [
    {
      "id": 1,
      "raw_text": "ORGANIC BANANAS",
      "ingredient_id": 5,
      "ingredient_name": "banana",
      "quantity": "1.00",
      "unit": "bunch",
      "price": "2.49",
      "is_food": true
    },
    {
      "id": 2,
      "raw_text": "TAX",
      "ingredient_id": null,
      "ingredient_name": null,
      "quantity": null,
      "unit": null,
      "price": "0.87",
      "is_food": false
    }
  ]
}
```

**GET /receipts/** → paginated `list[ReceiptScanOut]`

Query params: `?page=1` (page_size=20). Returns `{ "items": [...], "count": N }`.

Each item includes `item_count` (number of extracted lines) for summary display.

**GET /receipts/{id}** → `ReceiptScanDetailOut` (same shape as scan response)

**POST /receipts/{id}/confirm** → `ConfirmReceiptOut`

Confirms selected items and adds them to the user's pantry. Supports overriding OCR values. If the user already has an available pantry item for the same ingredient, quantities are merged (upsert).

Request:
```json
{
  "items": [
    {
      "receipt_item_id": 1,
      "ingredient_name": null,
      "quantity": null,
      "unit": null,
      "expiry_date": "2026-03-01"
    }
  ]
}
```

All fields except `receipt_item_id` are optional overrides:
- `ingredient_name` — correct the OCR-detected name
- `quantity` / `unit` — adjust quantity or unit
- `expiry_date` — override auto-calculated expiry (based on category shelf life)

Response (200):
```json
{
  "pantry_items_created": 1,
  "pantry_items_updated": 0,
  "items": [
    {
      "id": "uuid",
      "ingredient": { "id": 5, "name": "banana", "category_name": "Fresh Fruits", "category_icon": "🍎" },
      "quantity": "1.00",
      "unit": "bunch",
      "added_date": "2026-02-25",
      "expiry_date": "2026-03-01",
      "source": "receipt_scan",
      "status": "available",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

**DELETE /receipts/{id}** → 204 (cascades to receipt items)

---

### Pantry — `/api/v1/pantry`

**GET /pantry/** → paginated `list[PantryItemOut]`

Query params:
- `?status=available` — filter by status (`available`, `expired`, `used_up`)
- `?expiring_within=3` — items expiring within N days (only available items)
- `?category=5` — filter by ingredient category ID
- `?page=1` (page_size=20)

Response `PantryItemOut`:
```json
{
  "id": "uuid",
  "ingredient": {
    "id": 5,
    "name": "banana",
    "category_name": "Fresh Fruits",
    "category_icon": "🍎"
  },
  "quantity": "3.00",
  "unit": "piece",
  "added_date": "2026-02-25",
  "expiry_date": "2026-03-02",
  "source": "receipt_scan",
  "status": "available",
  "created_at": "...",
  "updated_at": "..."
}
```

**GET /pantry/expiring?days=3** → `list[PantryItemOut]`

Unpaginated convenience endpoint for dashboard/notifications. Returns available items with expiry dates within N days (default 3).

**GET /pantry/summary** → `PantrySummaryOut`

Category-level aggregation for the dashboard:
```json
{
  "total_items": 15,
  "total_available": 10,
  "total_expired": 2,
  "total_expiring_soon": 3,
  "categories": [
    {
      "category_id": 1,
      "category_name": "Fresh Fruits",
      "category_icon": "🍎",
      "available_count": 5,
      "expired_count": 1,
      "used_up_count": 2,
      "expiring_soon_count": 2,
      "total_count": 8
    }
  ]
}
```

**POST /pantry/** → `PantryItemCreateOut` (201 new, 200 upsert)

If the user already has an available item for the same ingredient, quantities are merged and returns 200. New items return 201.

Request:
```json
{
  "ingredient_name": "chicken breast",
  "quantity": "1.5",
  "unit": "lb",
  "expiry_date": "2026-02-28",
  "category_hint": "Poultry"
}
```

Response:
```json
{
  "item": { "...PantryItemOut..." },
  "created": true
}
```

**PATCH /pantry/{id}** → `PantryItemOut`

Partial update — only provided fields are changed:
```json
{ "quantity": "2.00", "expiry_date": "2026-03-05", "status": "expired" }
```

**DELETE /pantry/{id}** → 204

**POST /pantry/{id}/use** → `PantryItemOut`

Mark an item as partially or fully used. Only works on `available` items.

- No body or `{}` → marks as `used_up`, sets quantity to 0
- `{"quantity": "0.5"}` → decrements quantity, keeps `available` if remainder > 0, marks `used_up` if remainder <= 0
- Returns 400 if trying to use more than available quantity

---

### Pagination

All paginated endpoints (`/receipts/`, `/pantry/`) return:
```json
{ "items": [...], "count": 142 }
```
Query with `?page=1` (page_size=20).

---

### Error Responses

All errors use a consistent `ErrorOut` schema:
```json
{ "detail": "Human-readable error message" }
```

Common status codes: 400 (validation), 401 (unauthenticated), 404 (not found), 502 (OCR provider failure).

## Management Commands

| Command | Description |
|---------|-------------|
| `uv run python manage.py seed_categories` | Seed 25 ingredient categories with shelf life data (idempotent) |
| `uv run python manage.py gen_test_token` | Generate a test JWT for Swagger / curl authentication |
| `uv run python manage.py test_scan [image_path]` | Serve a local image via HTTP for testing the scan endpoint (default: `/tmp/test_receipt.jpg`) |

### Local testing workflow

```bash
# Terminal 1: serve a receipt image
uv run python manage.py test_scan /tmp/test_receipt.jpg

# Terminal 2: start the dev server
uv run python manage.py runserver

# Terminal 3 (or use Swagger UI):
# 1. Generate a token
uv run python manage.py gen_test_token
# 2. Paste token into Swagger Authorize at http://localhost:8000/api/v1/docs
# 3. POST /api/v1/receipts/scan with {"image_url": "http://localhost:9999/test_receipt.jpg"}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DJANGO_SECRET_KEY` | Yes | Django secret key |
| `DATABASE_URL` | Yes | Pooled Supabase Postgres connection (port 6543) |
| `DIRECT_URL` | Yes | Direct Supabase Postgres connection (port 5432, for migrations) |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret from Supabase dashboard > Settings > API |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude Vision OCR |
| `ANTHROPIC_MODEL` | No | Claude model override (default: `claude-sonnet-4-20250514`) |
| `ALLOWED_HOSTS` | Prod | Comma-separated production domain(s) |
| `CORS_ALLOWED_ORIGINS` | Prod | Frontend URL for CORS |
