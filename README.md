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

- **Backend:** Django + Django Ninja, ASGI via uvicorn
- **Frontend:** Next.js 16 PWA, Tailwind + shadcn/ui
- **Auth:** Supabase Auth (Google OAuth), backend validates JWT
- **Database:** Supabase Postgres
- **OCR:** Claude Vision
- **Recipes:** Spoonacular API
