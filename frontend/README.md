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
| `/dashboard` | Placeholder | Home screen |
| `/pantry` | Placeholder | Pantry inventory |
| `/scan` | Placeholder | Receipt scanning |
| `/recipes` | Placeholder | Recipe search/suggestions |
| `/settings` | Placeholder | User settings |

## Architecture

- `src/lib/supabase.ts` — Supabase browser client
- `src/lib/auth-context.tsx` — Auth state via React Context
- `src/lib/api.ts` — Typed fetch wrapper with auth headers
- `src/lib/query-client.ts` — TanStack Query config
- `src/lib/providers.tsx` — Combined providers (Auth + Query + Toaster)
- `src/types/api.ts` — TypeScript types mirroring backend schemas
- `src/components/bottom-nav.tsx` — 5-tab bottom navigation
- `src/app/(auth)/` — Public routes (login, register)
- `src/app/(app)/` — Authenticated routes with bottom nav
