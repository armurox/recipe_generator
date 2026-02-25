# PantryChef

Recipe suggestion app: photograph grocery receipts, extract ingredients via Claude Vision, get recipe suggestions from Spoonacular. Tracks pantry inventory with expiry dates.

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env   # Fill in secrets
uv run python manage.py runserver
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/api/v1/docs`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local   # Fill in Supabase credentials
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### 3. Supabase Auth Setup

For Google OAuth to work, configure the redirect URL in your Supabase dashboard:

- Go to **Authentication > URL Configuration**
- Add `http://localhost:3000` to **Site URL**
- Add `http://localhost:3000/**` to **Redirect URLs**

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Django secret key |
| `DATABASE_URL` | Supabase Postgres connection string |
| `SUPABASE_JWT_SECRET` | JWT secret for token verification |
| `ANTHROPIC_API_KEY` | Claude API key (receipt scanning) |
| `SPOONACULAR_API_KEY` | Spoonacular API key (recipes) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Backend API URL |

## Architecture

- **Backend:** Django + Django Ninja (async), ASGI via uvicorn
- **Frontend:** Next.js 16 PWA, Tailwind v4 + shadcn/ui, TanStack Query v5
- **Auth:** Supabase Auth (Google OAuth + email/password), backend validates JWT
- **Database:** Supabase Postgres
- **OCR:** Claude Vision (abstracted behind OCRProvider interface)
- **Recipes:** Spoonacular API (abstracted behind RecipeProvider interface)

## API Endpoints

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/me` | Get current user profile |
| PATCH | `/api/v1/me` | Update profile |

### Receipt Scanning
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/receipts/scan` | Upload image URL, OCR extract items |
| GET | `/api/v1/receipts` | List user's scans (paginated) |
| GET | `/api/v1/receipts/{id}` | Get scan detail with items |
| POST | `/api/v1/receipts/{id}/confirm` | Confirm items, create pantry entries. 409 if already confirmed |
| DELETE | `/api/v1/receipts/{id}` | Delete scan. 409 if confirmed |

### Pantry
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/pantry` | List pantry items (filterable by status, expiry, category, search) |
| POST | `/api/v1/pantry` | Add item manually (upserts if existing) |
| PATCH | `/api/v1/pantry/{id}` | Update item (quantity, unit, expiry, status) |
| DELETE | `/api/v1/pantry/{id}` | Delete item |
| POST | `/api/v1/pantry/{id}/use` | Mark as used (partial or full) |
| POST | `/api/v1/pantry/bulk-delete` | Delete multiple items (max 100) |
| GET | `/api/v1/pantry/expiring` | Items expiring within N days |
| GET | `/api/v1/pantry/summary` | Category-level aggregation for dashboard |

### Recipes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/recipes/suggest` | Suggest from pantry, or popular if empty. Paginated (`page`, `page_size`). Returns `{ using_pantry_ingredients, items, total_results }` |
| GET | `/api/v1/recipes/search` | Search by keyword (`q`), diet filter (`diet`), and/or max ready time (`max_ready_time`). Paginated |
| GET | `/api/v1/recipes/saved` | List saved recipes |
| GET | `/api/v1/recipes/history` | Cooking history |
| GET | `/api/v1/recipes/{id}` | Recipe detail (cache-on-first-access) |
| POST | `/api/v1/recipes/{id}/save` | Save recipe |
| DELETE | `/api/v1/recipes/{id}/save` | Unsave recipe |
| POST | `/api/v1/recipes/{id}/cooked` | Log cooking event |

## Tests

```bash
# Backend (159 tests)
cd backend && uv run pytest tests/ -v

# Frontend (build check)
cd frontend && npm run build
```
