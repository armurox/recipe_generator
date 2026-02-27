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
- Run tests manually before committing/pushing: `cd backend && uv run pytest tests/ -v`

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
- Use `@paginate(PageNumberPagination, page_size=20)` on list endpoints — returns `{ items: [...], count: N }` format automatically
- For Spoonacular-proxied endpoints (suggest, search), use manual `page`/`page_size` params with `offset = (page - 1) * page_size` — Spoonacular provides `totalResults` for proper client-side pagination

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
- **Spoonacular boolean params** — always pass as string `"true"`/`"false"`, not Python `True`/`False`. `httpx` serializes Python booleans with capital first letter (`"True"`) which Spoonacular doesn't reliably accept

## Logging
- Use Python's standard `logging` module — one logger per module: `logger = logging.getLogger(__name__)`
- **Scope every log message** with `[function_name]` prefix for traceability: `logger.info("[scan_receipt] scan=%s completed", scan.id)`
- Use appropriate levels: `DEBUG` for internal details (ingredient creation), `INFO` for request lifecycle (start, complete, counts), `WARNING` for recoverable issues, `ERROR` for failures
- **Use `logger.exception()` in except blocks** — captures full stack trace automatically. Never use `logger.error("...: %s", exc)` to log caught exceptions
- Include relevant identifiers (user ID, scan ID, item counts) as structured key=value pairs after the function prefix
- Do not log sensitive data (tokens, passwords, full image data)
- Log at `WARNING` level for expected-but-notable failures (auth failures, 404s). Reserve `ERROR`/`exception` for unexpected failures (API errors, download failures)

## Frontend Tooling
- **Package manager:** npm
- **Linting:** ESLint (Next.js default config)
- **Formatting:** Prettier
- **Testing:** Vitest + React Testing Library for components/hooks, Playwright for e2e
- **Pre-commit hooks:** eslint + prettier run on every commit
- **CI:** GitHub Actions runs lint + unit tests + E2E tests on PRs to `main` and pushes to `main`
- Run tests manually before committing/pushing: `cd frontend && npm test && npm run test:e2e`
- **Bundle analysis:** `@next/bundle-analyzer` — run with `ANALYZE=true npm run build`

## Frontend Code Style
- **Path aliases** — use `@/` for all imports: `import { Button } from "@/components/ui/button"`, never relative `../../`
- **Named exports** — prefer named exports for components. Default exports only for Next.js page/layout/error files (required by convention)
- **Collocate components** — page-specific components go in `_components/` next to the page. Shared components go in `src/components/`
- **TypeScript strict mode** — no `any`. Use `unknown` + type narrowing when the type is genuinely uncertain. Mirror backend API schemas as TS types in `src/types/`

## Next.js App Router Patterns
- **Server Components are the default** — only add `"use client"` when the component needs browser APIs (`useState`, `useEffect`, event handlers) or client-side libraries (TanStack Query, React Hook Form)
- **Push `"use client"` down the tree** — page layouts, headings, and static shells should remain Server Components. Only interactive leaf components (data lists, forms, buttons) need `"use client"`
- **Auth-aware architecture** — since Supabase Auth manages tokens client-side, the authenticated layout is a Client Component. Pages within it can still be Server Components that render Suspense boundaries around client data-fetching components
- **Suspense boundaries per data source** — wrap each independent data-fetching component in `<Suspense fallback={<Skeleton />}>` so they stream independently
- **`dynamic = "force-dynamic"`** — set on authenticated pages to prevent static caching of user-specific content
- **React Compiler** — enable `experimental.reactCompiler` in `next.config.ts`. This eliminates the need for manual `React.memo`, `useMemo`, and `useCallback` in most cases. Write code without manual memoization first; add it only if profiling shows the compiler missed an optimization

## Data Fetching & Caching
Use **TanStack Query v5** for all client-side data fetching (not SWR):
- Better mutation lifecycle, optimistic updates, and devtools
- `useSuspenseQuery` for Suspense-compatible fetching

### API client
Thin `fetch` wrapper in `lib/api.ts` — reads Supabase session token, sets `Authorization: Bearer` header, throws typed `ApiError` on non-2xx. No Axios needed.

### Query key conventions
Hierarchical keys for targeted invalidation:
- `["pantry", "items"]` — pantry list
- `["pantry", "items", { status: "available" }]` — filtered pantry list
- `["pantry", "expiring"]` — expiring items
- `["pantry", "summary"]` — dashboard summary
- `["recipes", "suggest", { pageSize }]` — single-page suggestions (dashboard)
- `["recipes", "suggest", "infinite", { pageSize }]` — infinite scroll suggestions (recipes page)
- `["recipes", "search", "infinite", { q, diet, pageSize, maxReadyTime }]` — infinite search
- `["recipes", "detail", id]`
- `["recipes", "saved"]`, `["recipes", "history"]`
- `["user", "me"]` — current user profile

### staleTime guidelines
| Data type | staleTime | Rationale |
|-----------|-----------|-----------|
| User profile | `Infinity` | Rarely changes; invalidate manually on edit |
| Pantry items | 2 min | Changes on scan/edit; keep reasonably fresh |
| Recipe search/suggest | 5 min | External API, results stable per query |
| Recipe detail | 30 min | Static content once cached |
| Saved recipes | 2 min | User-driven changes |
| Receipt scans | `Infinity` | Immutable once created |

### Mutations
- **Invalidate related queries** in `onSuccess` — e.g., pantry mutation invalidates `["pantry"]` (all pantry queries)
- **Optimistic updates** for pantry use/delete — user sees immediate feedback, rolls back on error
- **Optimistic save/unsave** — `useSaveRecipe`/`useUnsaveRecipe` snapshot all `["recipes"]` caches, toggle `is_saved` via `updateIsSavedInCache` helper across detail/suggest/search/saved caches, restore from snapshot on error
- **Global `onError`** on `QueryClient` catches 401s and triggers sign-out

## State Management
**TanStack Query + React Context + component state** — no Zustand needed:
| State type | Solution |
|------------|----------|
| Server state (pantry, recipes, user) | TanStack Query |
| Auth state (session, user, token) | React Context wrapping Supabase Auth |
| Local UI state (form inputs, modals, tabs) | `useState` / `useReducer` |
| Cross-cutting UI (toasts, global loading) | Sonner (via shadcn/ui `<Toaster>`) |

Only add Zustand if a future feature requires complex cross-component UI state not covered by the above.

## Form Handling
Use **React Hook Form + Zod** for all forms (consistency over using different tools per form):
- `useFieldArray` for dynamic lists (receipt review with 10+ editable items)
- `zodResolver` for schema validation matching backend expectations
- shadcn/ui `<Form>` / `<FormField>` / `<FormMessage>` components are built on React Hook Form — use them for accessible labels and inline error display

## Frontend Performance
- **`next/image`** for all images — configure `remotePatterns` for `img.spoonacular.com` and Supabase Storage domain. Use `sizes` attribute for responsive loading. Use `priority` on above-the-fold images only
- **Dynamic imports** (`next/dynamic`) for heavy components not needed on initial paint: camera/scanner (`ssr: false`), recipe detail modals, charts. Show `<Skeleton>` as loading fallback
- **Prefetching** — Next.js prefetches `<Link>` routes by default. Disable with `prefetch={false}` for rarely-visited routes (settings) to save bandwidth on mobile
- **Infinite scroll** — use callback ref pattern (`useCallback` as ref) with `IntersectionObserver`, not `useEffect` + `useRef`. Callback refs fire at the exact moment the DOM node appears/disappears, eliminating timing gaps between early-return loading states and sentinel rendering. Use 1200px `rootMargin` for prefetching ~5 items ahead
- **Tab prefetching** — use `queryClient.prefetchInfiniteQuery` on page mount to warm the cache for tabs the user hasn't visited yet
- **HTML sanitization** — third-party HTML content (e.g. Spoonacular descriptions) must be sanitized via DOMPurify before rendering with `dangerouslySetInnerHTML`. Only allow safe formatting tags (`b`, `strong`, `i`, `em`, `a`)

## Frontend Modals & Sheets
- **Width constraint** — all dialogs and bottom sheets must use `max-w-md` (or narrower like `w-64`) to stay within the app container. The app layout uses `max-w-md mx-auto`, so fixed/absolute overlays that don't constrain width will overflow on desktop
- **Bottom sheets** — use shadcn `Sheet` with `side="bottom"` and `mx-auto max-w-md` on `SheetContent`. Cap height with `max-h-[70vh] overflow-y-auto`
- **Dialog sizing for PWA** — prefer narrow, tall card proportions (e.g. `w-64`) with stacked full-width buttons. Side-by-side buttons look cramped on mobile
- **Form state sync** — use key-based remount (`key={item.id}`) instead of `useEffect` + `setState` to sync form state with prop changes (React Compiler lint rule: `react-hooks/set-state-in-effect`)
- **Popup dialogs** — prefer centered popup (`w-64`, `items-center justify-center`) over bottom sheets for compact forms (cook rating, add item, delete confirm). Bottom sheets can be clipped by the bottom nav in the PWA context

## API Client Trailing Slashes
Django's `APPEND_SLASH` setting cannot redirect POST/PATCH/DELETE requests. All mutation URLs in the API client must include a trailing slash (e.g. `/pantry/`, not `/pantry`). GET requests work without trailing slashes because Django can redirect them.

## Frontend Error Handling
Layered strategy:
1. **TanStack Query `onError` per mutation** — user-facing toast via Sonner for specific actions ("Failed to remove item")
2. **Global mutation `onError` on QueryClient** — catch 401 → sign out and redirect to login
3. **`error.tsx` per route segment** — catches unexpected rendering errors, shows retry button
4. **`global-error.tsx` at root** — catastrophic fallback for root layout errors
5. **`not-found.tsx`** — custom 404 page

## Frontend Testing
- **Component/hook tests (Vitest + Testing Library):** custom hooks (`usePantryItems`, `useAuth`) with `renderHook` + mocked QueryClient. Form components (receipt review validation, submission). API client error handling
- **E2E tests (Playwright):** login flow, receipt scan → review → confirm → pantry, recipe search + save, pantry CRUD. Run against dev server with MSW mocking external APIs
- **API mocking:** MSW (Mock Service Worker) for both local dev and tests — intercepts `fetch` calls to the backend, returns fixture data. Shared between Vitest and Playwright

## PWA Setup
Use **`@serwist/next`** (not `next-pwa`, which is unmaintained and incompatible with App Router):
- Manifest via `src/app/manifest.ts` (Next.js Metadata API)
- Service worker in `src/sw.ts` — precache static assets, runtime cache for API responses
- **Cache strategy:** cache-first for static assets, network-first for API calls (show stale data if offline), stale-while-revalidate for Spoonacular recipe images
- **v1 scope:** installable + offline read of cached pantry/recipes. No offline writes or background sync. Show offline indicator and disable mutating actions when offline

## Library Documentation
- **Always use Context7** (via the `mcp__context7` tools) to look up documentation and code examples for any library or framework used in this project (Django, Django Ninja, Next.js, TanStack Query, Supabase, Tailwind, shadcn/ui, Playwright, Vitest, etc.)
- Call `resolve-library-id` first to get the Context7-compatible library ID, then `query-docs` with a specific question
- Prefer Context7 over web search or training knowledge for library usage — it returns up-to-date docs and real code examples

## Deployment

### Branching Strategy
- **`v1`** — active development branch (PR #1 targets `staging`)
- **`staging`** — merge here to trigger beta deploys (Railway + Vercel preview)
- **`main`** — merge here to trigger production deploys (Railway + Vercel production)

### Vercel (Frontend)
- **Project:** `armuroxs-projects/frontend` (prj_YlPOY5L28D2TD9WHsNL4A2YQJA7w)
- **Root directory:** `frontend/`
- **Production branch:** `main`, **Preview branch:** `staging`
- **Ignored branches:** all others (ignore command skips non-main/staging builds)
- **MCP tools:** use `mcp__vercel__list_deployments`, `mcp__vercel__get_deployment`, `mcp__vercel__get_deployment_build_logs`, `mcp__vercel__get_runtime_logs` to monitor
- **Env vars:** 3 per environment (SUPABASE_URL, SUPABASE_ANON_KEY, API_URL) — production and preview scoped separately

### Railway (Backend)
- **Project:** `courteous-wonder`
- **Service:** `recipe_generator` (root directory: `backend/`)
- **Environments:** `beta` (branch: `staging`), `production` (branch: `main`, not yet configured)
- **Domain:** `recipegenerator-beta.up.railway.app`
- **CLI commands:**
  - `railway status` — current project/environment/service info
  - `railway logs` — live deploy logs
  - `railway logs --deployment <id>` — logs for a specific deployment
  - `railway deployment list` — recent deployments with status
  - `railway variables` — list environment variables (redacted)
  - `railway variables set KEY=VALUE` — set/update an env var
- **Build:** Dockerfile-based (`railway.toml` → `builder = "DOCKERFILE"`)
- **Release command:** auto-runs `python manage.py migrate --no-input` using direct DB connection on every deploy
- **Health check:** `/api/v1/health`

### Supabase Projects
- **Production:** `jyubxcugxmtdsemfjucq` (ap-southeast-1)
- **Beta:** `lxgkzjeheppcpnbdruws` (ap-southeast-1)
- **MCP tools:** use `mcp__supabase__execute_sql`, `mcp__supabase__get_logs`, `mcp__supabase__get_advisors` to monitor
- **RLS:** deny-all enabled on all 18 public tables (Django bypasses as superuser)

### Deployment Checklist
Full guide at `docs/deployment-checklist.md` covering Supabase, SMTP, Railway, Vercel, Google OAuth setup.

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
