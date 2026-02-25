# PantryChef Frontend

Next.js 16 PWA with Tailwind CSS + shadcn/ui. Mobile-first recipe generator app.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React Compiler)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Auth:** Supabase Auth (Google OAuth + email/password)
- **Data fetching:** TanStack Query v5
- **Forms:** React Hook Form + Zod
- **Icons:** Lucide React
- **Toasts:** Sonner

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8000/api/v1`) |

## Implemented Routes

| Route | Status | Description |
|-------|--------|-------------|
| `/login` | Done | Email/password + Google OAuth login |
| `/register` | Done | Account registration |
| `/dashboard` | Done | Pantry summary stats, expiring items, recipe suggestions (infinite scroll, popular fallback) |
| `/pantry` | Done | Pantry inventory grouped by category, search, filters, tap-to-edit quantity, single + bulk delete |
| `/scan` | Done | Receipt upload (camera/gallery), image compression, recent scans with status badges |
| `/scan/[scanId]` | Done | Review extracted items, edit name/qty/unit, confirm or discard. Read-only view for confirmed scans |
| `/recipes` | Done | Recipe suggestions (For You), search with filter tabs (Quick Meals, Healthy, Vegetarian), infinite scroll on all tabs, 3-layer merge search |
| `/recipes/[recipeId]` | Done | Recipe detail with hero image, nutrition grid, ingredients checklist, step-by-step instructions, save/unsave/cook/share actions |
| `/recipes/saved` | Done | Saved recipes list |
| `/settings` | Placeholder | User settings |

## Architecture

### Core libraries
- `src/lib/supabase.ts` — Supabase browser client
- `src/lib/auth-context.tsx` — Auth state via React Context
- `src/lib/api.ts` — Typed fetch wrapper with auth headers
- `src/lib/query-client.ts` — TanStack Query config (global 401 → sign out)
- `src/lib/providers.tsx` — Combined providers (Auth + Query + Toaster)
- `src/lib/upload.ts` — Supabase Storage upload with image compression

### Types & hooks
- `src/types/api.ts` — TypeScript types mirroring backend schemas
- `src/hooks/use-pantry.ts` — Pantry queries + mutations (summary, items, expiring, update, delete, bulk-delete)
- `src/hooks/use-receipts.ts` — Receipt queries + mutations (scans, scan detail, scan receipt, confirm, delete)
- `src/hooks/use-recipes.ts` — Recipe queries + mutations (suggestions, infinite search, detail, save/unsave, cooking log, tab prefetching)
- `src/hooks/use-user.ts` — Current user profile

### Shared components
- `src/components/bottom-nav.tsx` — 5-tab bottom navigation with raised scan FAB
- `src/components/recipe-card.tsx` — Recipe card with image, title, ingredient pills, "X/N in pantry" badge, save heart
- `src/components/expiry-badge.tsx` — Expiry status text ("Expired", "Expiring in N days")

### Route structure
- `src/app/(auth)/` — Public routes (login, register) — redirects to dashboard if authenticated
- `src/app/(app)/` — Authenticated routes with bottom nav — redirects to login if not authenticated

## Key Patterns

- **Optimistic updates:** `useUpdatePantryItem` uses `onMutate`/`onError`/`onSettled` to update UI immediately and roll back on failure
- **Cache invalidation:** Pantry mutations invalidate `["recipes", "suggest"]` with `refetchType: "all"` so dashboard stays fresh
- **Infinite scroll:** All recipe tabs use callback-ref `IntersectionObserver` with 1200px rootMargin for seamless prefetching (~5 items ahead)
- **Popular fallback:** When pantry is empty, suggestions show popular Spoonacular recipes with ingredient data (bulk-fetched) and adjusted messaging
- **3-layer merge search:** Client-side filter from cached suggestions → merge with server search results → smart loading states for instant feedback
- **Tab prefetching:** On recipes page load, first page of Quick Meals, Healthy, and Vegetarian tabs are prefetched for instant switching
- **HTML sanitization:** Recipe descriptions from Spoonacular are sanitized via DOMPurify and rendered with styled inline HTML (bold, links)
