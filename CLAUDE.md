# PantryChef — Recipe Generator

## Project Overview
Recipe suggestion app: users photograph grocery receipts, Claude Vision extracts ingredients, app suggests recipes via Spoonacular. Tracks pantry inventory with expiry dates.

## Architecture
- **Backend:** Django + Django Ninja (REST API), ASGI via uvicorn
- **Frontend:** Next.js PWA, Tailwind + shadcn/ui, mobile-first
- **Auth:** Supabase Auth (Google OAuth), backend validates JWT
- **Database:** Supabase Postgres
- **OCR:** Claude Vision (abstracted behind OCRProvider interface)
- **Recipes:** Spoonacular API (abstracted behind RecipeProvider interface)
- **Deployment:** Vercel (frontend), Railway (backend, Dockerized)

## Architecture Plan
Full plan at `~/.claude/plans/parsed-riding-pumpkin.md`

## Backend Tooling
- **Package manager:** uv
- **Linting:** ruff (run `uv run ruff check` and `uv run ruff format` after tests)
- **Type checking:** ty
- **Testing:** pytest with Django TestCase classes and factory_boy for model factories (`tests/factories.py`)
- **Pre-commit hooks:** ruff lint/format + ty type check run on every commit
- **CI:** GitHub Actions runs lint + tests on PRs to `main` and pushes to `main`
- Run tests manually before pushing: `cd backend && uv run pytest tests/ -v`

## Code Style
- **Absolute imports only** — use `from apps.users.models import User`, never relative imports
- **Top-level imports** — avoid imports inside functions; keep all imports at the top of the file
- **Avoid ORM N+1 queries** — use `select_related()` for FK/OneToOne, `prefetch_related()` and `Prefetch` for reverse/M2M relations

## Key Patterns
- All models inherit from `AbstractTimestampModel`, `AbstractIdTimestampModel`, or `AbstractUUIDTimestampModel` (defined in `core` app)
- Receipt scanning uses async/await inline (no background task queue) — user waits for results
- `receipt_items.ingredient_id` is nullable for non-food receipt lines (TAX, BAGS, etc.)
- Service abstractions: OCRProvider and RecipeProvider interfaces for swappable implementations

## Future Considerations
- Evaluate cacheops / Redis for caching when query performance becomes a concern

## Environment Variables
Build `.env` files incrementally as each feature is implemented. Prompt the user for secrets when needed:
- Step 1 (backend scaffolding): `DJANGO_SECRET_KEY`, `DATABASE_URL`, `SUPABASE_JWT_SECRET`
- Step 3 (receipt scanning): `ANTHROPIC_API_KEY`
- Step 5 (recipe service): `SPOONACULAR_API_KEY`
- Step 6 (frontend scaffolding): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

## UI Mockups
HTML mockups in `mockups/` directory are the **source of truth for frontend UI**. When building frontend pages (steps 6-7), read the corresponding mockup HTML file to match layout, colors, components, and design patterns. Shared CSS variables and styles are in `mockups/shared.css`.

Screens: login, register, dashboard, scan, scan-review, pantry, recipes, recipe-detail, saved-recipes.

Figma file also available: PantryChef — UI Mockups.
