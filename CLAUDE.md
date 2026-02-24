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

## Django 6.0+ Features
Target Django 6.0+ and prefer its newer features over legacy patterns:
- **Async ORM** — use `aget()`, `acreate()`, `afilter()`, `acount()`, etc. in async endpoints instead of `sync_to_async()` wrappers
- **`db_default` auto-refresh** — fields with `db_default` or `GeneratedField` auto-refresh after `save()` on Postgres (no `refresh_from_db()` needed)
- **`Model.NotUpdated` exception** — use `save(force_update=True)` and catch `Model.NotUpdated` for optimistic concurrency instead of generic `DatabaseError`
- **`StringAgg` universal** — works on all backends now, not just Postgres
- **Background tasks framework** — evaluate `django.tasks` for future background work (pantry expiry checks, batch operations) instead of Celery
- **`BigAutoField` default** — Django 6.0 defaults `DEFAULT_AUTO_FIELD` to `BigAutoField`, no need to set it explicitly

## Django Ninja Patterns
Follow idiomatic Django Ninja conventions throughout the API:

### Router structure
- One `Router` per app (`users`, `receipts`, `pantry`, `recipes`), composed in `config/api.py`
- Apply `SupabaseJWTAuth` globally on `NinjaAPI`, exempt public endpoints with `auth=None`
- Use `tags=["app_name"]` on routers for Swagger grouping

### Schemas
- **Separate In/Out schemas** — never expose internal fields in output; use `Schema` for inputs and `ModelSchema` for simple output
- **Multiple response codes** — declare all possible responses: `response={201: ItemOut, 404: ErrorOut, 409: ErrorOut}`
- **Return QuerySets directly** from list endpoints — Django Ninja auto-serializes `list[Schema]` responses

### Error handling
- Register global exception handlers on `NinjaAPI` for `ObjectDoesNotExist` (404), `ValidationError` (422)
- Use `HttpError(status, message)` for simple inline errors in endpoints
- Use a shared `ErrorOut` schema (`detail: str`) for consistent error responses

### Async endpoints
- Use `async def` for endpoints that call external services (Claude Vision, Spoonacular) or do multiple DB queries
- Pair with async ORM (`aget`, `acreate`, etc.) for fully non-blocking request handling under ASGI
- Sync endpoints are fine for simple CRUD that only does one or two queries

### Pagination
- Use `@paginate(PageNumberPagination, page_size=20)` on list endpoints
- Returns `{ items: [...], count: N }` format automatically

### Authentication
- `SupabaseJWTAuth(HttpBearer)` validates JWT, returns `User` as `request.auth`
- Consider async `authenticate()` method since we run under ASGI

## API Documentation
Every API endpoint module (`api.py`) should include:
- **Docstrings on each endpoint function** explaining what it does, key business logic decisions, and any non-obvious behavior
- **Decision comments** (`# Decision:`) for design choices — why a particular approach was taken, trade-offs considered
- **Schema field descriptions** using `Field(description="...")` for non-obvious fields in Swagger docs

## Key Patterns
- All models inherit from `AbstractTimestampModel`, `AbstractIdTimestampModel`, or `AbstractUUIDTimestampModel` (defined in `core` app)
- Receipt scanning uses async/await inline (no background task queue) — user waits for results
- `receipt_items.ingredient_id` is nullable for non-food receipt lines (TAX, BAGS, etc.)
- Service abstractions: OCRProvider and RecipeProvider interfaces for swappable implementations

## Logging
- Use Python's standard `logging` module — one logger per module: `logger = logging.getLogger(__name__)`
- **Scope every log message** with `[function_name]` prefix for traceability: `logger.info("[scan_receipt] scan=%s completed", scan.id)`
- Use appropriate levels: `DEBUG` for internal details (ingredient creation), `INFO` for request lifecycle (start, complete, counts), `WARNING` for recoverable issues, `ERROR` for failures
- Include relevant identifiers (user ID, scan ID, item counts) as structured key=value pairs after the function prefix
- Do not log sensitive data (tokens, passwords, full image data)

## Future Considerations
- Evaluate cacheops / Redis for caching when query performance becomes a concern
- Set up centralized logging pipeline (ELK / CloudWatch) on deployment — backend container logs piped to aggregator

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
