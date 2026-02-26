# PantryChef Deployment Checklist

Complete guide for deploying PantryChef to beta and production environments.

---

## Table of Contents

1. [Supabase Project Setup](#1-supabase-project-setup)
2. [SMTP Provider Setup (Resend)](#2-smtp-provider-setup-resend)
3. [Supabase Email Template Customization](#3-supabase-email-template-customization)
4. [Database Migrations](#4-database-migrations)
5. [Backend Deployment (Railway)](#5-backend-deployment-railway)
6. [Frontend Deployment (Vercel)](#6-frontend-deployment-vercel)
7. [Google OAuth Configuration](#7-google-oauth-configuration)
8. [Post-Deployment Verification](#8-post-deployment-verification)

---

## 1. Supabase Project Setup

### Beta Environment

- **Project ID:** `lxgkzjeheppcpnbdruws`
- **URL:** `https://lxgkzjeheppcpnbdruws.supabase.co`
- **Region:** ap-southeast-1

### Production Environment

- **Project ID:** `jyubxcugxmtdsemfjucq`
- **URL:** `https://jyubxcugxmtdsemfjucq.supabase.co`
- **Region:** ap-southeast-1

### For Each Environment

- [ ] Confirm project is active (not paused) in Supabase dashboard
- [ ] Note the JWT secret: Dashboard → Settings → API → JWT Settings → JWT Secret
- [ ] Note the anon key: Dashboard → Settings → API → Project API Keys
- [ ] Note the database password: Dashboard → Settings → Database → Connection String
- [ ] Configure Site URL: Dashboard → Authentication → URL Configuration → Site URL
  - Beta: `https://beta.pantrychef.app` (or Vercel preview URL)
  - Production: `https://pantrychef.app`
- [ ] Add redirect URLs: Dashboard → Authentication → URL Configuration → Redirect URLs
  - Add both the frontend URL and `localhost:3000` for local dev

---

## 2. SMTP Provider Setup (Resend)

### Provider Comparison

| Provider   | Free Tier                      | Permanent? | Setup Complexity | Recommendation     |
|-----------|-------------------------------|------------|------------------|--------------------|
| **Resend** | 100 emails/day, 3,000/month  | Yes        | Low              | **Recommended**    |
| SendGrid   | 100 emails/day (60-day trial) | No — trial only, then $19.95/mo | Medium | Not recommended |
| Mailgun    | 100 emails/day, ~3,000/month  | Yes        | Medium           | Good alternative   |

### Why Resend?

- **Permanent free tier** — SendGrid eliminated its free plan (May 2025), leaving only a 60-day trial
- **Native Supabase integration** — one-click setup via Supabase Integrations page
- **Simple SMTP config** — minimal DNS setup compared to Mailgun
- **Modern developer UX** — clean dashboard, good API docs, built by ex-SendGrid team
- 100 emails/day is plenty for a beta/MVP auth flow (confirmation + password reset)

### Setup Steps

#### Step 1: Create Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your email address

#### Step 2: Add & Verify Domain

1. Go to Resend dashboard → Domains → Add Domain
2. Enter your domain (e.g., `pantrychef.app`)
3. Resend provides DNS records to add:
   - **DKIM** (TXT records) — email authentication
   - **SPF** (TXT record) — sender authorization
   - **DMARC** (TXT record) — email policy
4. Add these DNS records at your domain registrar (Cloudflare, Namecheap, etc.)
5. Click "Verify" in Resend — may take a few minutes to hours

> **Tip:** For beta testing before domain verification, Resend allows sending from `onboarding@resend.dev` on the free tier.

#### Step 3: Get SMTP Credentials

From Resend dashboard → SMTP:
- **Host:** `smtp.resend.com`
- **Port:** `465` (SSL) or `587` (STARTTLS)
- **Username:** `resend`
- **Password:** Your Resend API key (starts with `re_`)

#### Step 4: Configure in Supabase

**Option A: Native Integration (Easier)**
1. Supabase Dashboard → Integrations → Find "Resend"
2. Click Connect and follow the OAuth flow
3. Select your verified domain
4. Done — Supabase configures SMTP automatically

**Option B: Manual SMTP Configuration**
1. Supabase Dashboard → Project Settings → Authentication
2. Scroll to "SMTP Settings" section
3. Toggle "Enable Custom SMTP" ON
4. Fill in:
   - **Sender email:** `no-reply@pantrychef.app`
   - **Sender name:** `PantryChef`
   - **Host:** `smtp.resend.com`
   - **Port:** `587`
   - **Username:** `resend`
   - **Password:** Your Resend API key
5. Click Save

#### Step 5: Adjust Rate Limits

After enabling custom SMTP, Supabase imposes a default rate limit of 30 emails/hour.

1. Dashboard → Authentication → Rate Limits
2. Adjust based on expected traffic:
   - Beta: 30/hour is fine
   - Production: increase if needed (e.g., 100/hour)

### Checklist

- [ ] Resend account created
- [ ] Domain added and DNS records configured
- [ ] Domain verified in Resend
- [ ] SMTP configured in **beta** Supabase project
- [ ] SMTP configured in **production** Supabase project
- [ ] Test email sent successfully (try signing up a test user)
- [ ] Rate limits reviewed

---

## 3. Supabase Email Template Customization

### Template Types

Supabase provides these auth email templates:

| Template             | Trigger                          | Key Variable              |
|---------------------|----------------------------------|---------------------------|
| Confirm Sign Up      | New user registration            | `{{ .ConfirmationURL }}`  |
| Reset Password       | User requests password reset     | `{{ .ConfirmationURL }}`  |
| Magic Link           | Passwordless login               | `{{ .ConfirmationURL }}`  |
| Change Email         | User changes email address       | `{{ .ConfirmationURL }}`  |
| Invite User          | Admin invites a new user         | `{{ .ConfirmationURL }}`  |

### Available Template Variables

| Variable                | Description                              |
|------------------------|------------------------------------------|
| `{{ .ConfirmationURL }}`| Full confirmation/action URL             |
| `{{ .Token }}`          | 6-digit OTP code                         |
| `{{ .TokenHash }}`      | Hashed token for custom email links      |
| `{{ .SiteURL }}`        | Your app's Site URL setting              |
| `{{ .RedirectTo }}`     | Redirect URL from auth call              |
| `{{ .Email }}`          | User's email address                     |
| `{{ .NewEmail }}`       | New email (for change email flow)        |
| `{{ .Data }}`           | User metadata from signup                |

### How to Customize Templates

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Select the template to edit (e.g., "Confirm Sign Up")
3. Edit the HTML content in the editor
4. Use Go template syntax for variables: `{{ .ConfirmationURL }}`
5. Click Save

### Recommended Customizations

**For PantryChef, customize at minimum:**

1. **Confirm Sign Up** — brand with PantryChef name/logo, friendly welcome message
2. **Reset Password** — clear instructions, PantryChef branding

**Example Confirm Sign Up template:**

```html
<h2>Welcome to PantryChef!</h2>
<p>Thanks for signing up. Please confirm your email address by clicking the button below:</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="background-color: #16a34a; color: white; padding: 12px 24px;
            text-decoration: none; border-radius: 6px; display: inline-block;">
    Confirm Email
  </a>
</p>
<p>Or copy this link: {{ .ConfirmationURL }}</p>
<p style="color: #6b7280; font-size: 14px;">
  If you didn't create a PantryChef account, you can safely ignore this email.
</p>
```

### Important Notes

- **Email prefetching:** Some email providers (Microsoft Outlook/Defender) auto-click links in emails, consuming the confirmation token. Consider providing both a link and a 6-digit OTP (`{{ .Token }}`) as a fallback.
- **Disable email tracking:** If using Resend or another provider, disable click/open tracking to prevent link rewriting that breaks confirmation URLs.
- Templates use **Go template syntax** (not Handlebars/Mustache).

### Checklist

- [ ] Confirm Sign Up template customized for beta
- [ ] Reset Password template customized for beta
- [ ] Templates tested with a test signup
- [ ] Same templates applied to production when ready

---

## 4. Database Migrations

### Connection String Format

Supabase database connection strings follow this pattern:

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:[PORT]/postgres
```

- **Port 6543** — Pooled connection (via PgBouncer) for normal queries
- **Port 5432** — Direct connection for migrations

### Running Migrations Against Beta

**Step 1: Get the beta database connection string**

1. Supabase Dashboard → Project `lxgkzjeheppcpnbdruws` → Settings → Database
2. Copy the "Direct connection" string (port 5432)
3. It will look like:
   ```
   postgresql://postgres.lxgkzjeheppcpnbdruws:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

**Step 2: Run migrations**

```bash
cd backend

# Set the DATABASE_URL to the DIRECT connection (port 5432, not 6543)
DATABASE_URL="postgresql://postgres.lxgkzjeheppcpnbdruws:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" \
  uv run python manage.py migrate
```

> **Important:** Always use the direct connection (port 5432) for migrations. PgBouncer (port 6543) uses transaction pooling which doesn't support DDL statements reliably.

**Step 3: Verify**

```bash
DATABASE_URL="postgresql://postgres.lxgkzjeheppcpnbdruws:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" \
  uv run python manage.py showmigrations
```

All migrations should show `[X]` (applied).

### Current Migrations

The following apps have migrations that need to be applied:

- `users` — 0001_initial (custom User model with Supabase UUID PK)
- `ingredients` — 0001_initial
- `receipts` — 0001_initial, 0002_add_confirmed_status
- `pantry` — 0001_initial
- `recipes` — 0001_initial
- Django built-in apps (auth, contenttypes, sessions, admin)

### Checklist

- [ ] Beta DB password obtained from Supabase dashboard
- [ ] Migrations run against beta database (direct connection, port 5432)
- [ ] All migrations verified as applied (`showmigrations`)
- [ ] Production DB migrations verified (should already be done)

---

## 5. Backend Deployment (Railway)

### Architecture

Two Railway services from one GitHub repo:
- **Beta service** — deploys from `staging` branch → beta Supabase (`lxgkzjeheppcpnbdruws`)
- **Production service** — deploys from `main` branch → prod Supabase (`jyubxcugxmtdsemfjucq`)

Both use the same `backend/Dockerfile` and `railway.toml` config.

### Step-by-Step: Railway Dashboard Setup

**Step 1: Create Railway Project**

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select the `recipe_generator` repository
4. Railway creates a project with one default service

**Step 2: Configure Beta Service**

1. Click on the service → Settings
2. Set **Root Directory** to `backend/`
3. Set **Watch Paths** to `backend/**` (only redeploy on backend changes)
4. Set **Branch** to `staging`
5. Set **Build Config**: Railway auto-detects Dockerfile from `railway.toml`
6. Under **Deploy** → confirm health check path is `/api/v1/health`

**Step 3: Set Beta Environment Variables**

In the service → Variables tab, add:

| Variable                | Value                                                                |
|------------------------|----------------------------------------------------------------------|
| `DJANGO_SETTINGS_MODULE` | `config.settings.production`                                      |
| `DJANGO_SECRET_KEY`     | Generate: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DATABASE_URL`          | `postgresql://postgres.lxgkzjeheppcpnbdruws:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` |
| `DIRECT_URL`            | `postgresql://postgres.lxgkzjeheppcpnbdruws:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| `SUPABASE_JWT_SECRET`   | (from beta Supabase → Settings → API → JWT Secret)                  |
| `SUPABASE_URL`          | `https://lxgkzjeheppcpnbdruws.supabase.co`                         |
| `ALLOWED_HOSTS`         | `<beta-service>.up.railway.app` (Railway assigns this after first deploy) |
| `CORS_ALLOWED_ORIGINS`  | `https://<beta-frontend>.vercel.app` (set after Vercel deploy)      |
| `ANTHROPIC_API_KEY`     | `sk-ant-...` (your Anthropic key)                                    |
| `SPOONACULAR_API_KEY`   | (your Spoonacular key)                                               |

> **Note:** `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` need the actual Railway/Vercel domains. Deploy once first, note the assigned domain, then update these and redeploy.

**Step 4: Automatic Migrations on Deploy**

The `railway.toml` includes a release command that runs migrations automatically on every deploy using the direct database connection:

```toml
[deploy]
releaseCommand = "DATABASE_URL=$DIRECT_URL python manage.py migrate --no-input"
```

This ensures the schema is always up-to-date after each deployment.

**Step 5: Create Production Service**

1. In the same Railway project, click "New Service" → "GitHub Repo" → same repo
2. Configure identically to beta, but:
   - **Branch:** `main`
   - **Environment variables:** point to prod Supabase (`jyubxcugxmtdsemfjucq`)
   - Generate a **different** `DJANGO_SECRET_KEY`

**Step 6: Initial Deploy + Seed Data**

After first successful deploy of beta:

1. Open Railway → beta service → click "Railway Shell" (or use Railway CLI)
2. Run seed command:
   ```bash
   DATABASE_URL=$DIRECT_URL python manage.py seed_categories
   ```
3. Verify health: `curl https://<beta-service>.up.railway.app/api/v1/health`

### Custom Domain (Optional)

1. Railway service → Settings → Custom Domain
2. Add your domain (e.g., `api.pantrychef.app`)
3. Configure DNS CNAME record pointing to Railway
4. Update `ALLOWED_HOSTS` to include the custom domain

### Checklist

- [ ] Railway project created and connected to GitHub repo
- [ ] **Beta service** configured (branch: `staging`, root: `backend/`)
- [ ] Beta environment variables set
- [ ] Beta first deploy successful
- [ ] Beta health check passes: `GET /api/v1/health`
- [ ] Beta migrations applied (automatic via release command)
- [ ] Beta ingredient categories seeded (`seed_categories`)
- [ ] Note beta Railway URL: `__________________________`
- [ ] `ALLOWED_HOSTS` updated with actual Railway domain
- [ ] `CORS_ALLOWED_ORIGINS` updated with Vercel frontend URL
- [ ] **Production service** configured (branch: `main`)
- [ ] Production environment variables set (different secrets!)
- [ ] Production deploy successful + health check passes
- [ ] Note production Railway URL: `__________________________`

---

## 6. Frontend Deployment (Vercel)

### Environment Variables

| Variable                        | Description               | Beta Value                                   |
|--------------------------------|---------------------------|----------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`     | Supabase project URL      | `https://lxgkzjeheppcpnbdruws.supabase.co`  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Supabase anon key         | (from Supabase dashboard)                    |
| `NEXT_PUBLIC_API_URL`          | Backend API base URL      | `https://your-beta-backend.up.railway.app/api/v1` |

### Deploy Steps

1. Connect Vercel to the GitHub repo
2. Set the root directory to `frontend/`
3. Framework preset: Next.js (auto-detected)
4. Set environment variables
5. Deploy

### Checklist

- [ ] Vercel project created and connected to repo
- [ ] Environment variables set for beta
- [ ] Build succeeds
- [ ] Production deployment configured separately (when ready)

---

## 7. Google OAuth Configuration

### Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or select existing)
3. Enable "Google Identity" API
4. Go to APIs & Services → Credentials → Create OAuth 2.0 Client
5. Set authorized redirect URIs:
   - Beta: `https://lxgkzjeheppcpnbdruws.supabase.co/auth/v1/callback`
   - Production: `https://jyubxcugxmtdsemfjucq.supabase.co/auth/v1/callback`
   - Local dev: `http://localhost:54321/auth/v1/callback`
6. Note the Client ID and Client Secret

### Supabase Configuration

1. Dashboard → Authentication → Providers → Google
2. Toggle Google provider ON
3. Enter Client ID and Client Secret
4. Save

### Checklist

- [ ] Google OAuth credentials created
- [ ] Redirect URIs configured for all environments
- [ ] Google provider enabled in beta Supabase project
- [ ] Google provider enabled in production Supabase project
- [ ] OAuth consent screen configured (app name, logo, authorized domains)
- [ ] Test Google login flow end-to-end

---

## 8. Post-Deployment Verification

### Beta Environment Smoke Tests

- [ ] **Auth:** Sign up with email → receive confirmation email → confirm → login
- [ ] **Auth:** Google OAuth login works
- [ ] **Auth:** Password reset email sends and works
- [ ] **API:** Health endpoint returns 200: `GET /api/v1/health`
- [ ] **API:** Protected endpoint returns 401 without token
- [ ] **API:** Protected endpoint returns 200 with valid JWT
- [ ] **Receipt scan:** Upload receipt image → Claude Vision extracts items
- [ ] **Pantry:** Items appear in pantry after receipt confirmation
- [ ] **Recipes:** Recipe suggestions load from Spoonacular
- [ ] **PWA:** App is installable on mobile
- [ ] **HTTPS:** All requests served over HTTPS
- [ ] **CORS:** Frontend can call backend without errors

### Security Checks

- [ ] `DJANGO_SECRET_KEY` is unique per environment (not shared)
- [ ] `DEBUG=False` in production settings
- [ ] HSTS headers present
- [ ] No API docs exposed in production (`NINJA_DOCS_URL = None`)
- [ ] Rate limiting active on receipt scan endpoint
- [ ] No sensitive data in logs

### Monitoring

- [ ] Railway logs accessible for backend errors
- [ ] Vercel logs accessible for frontend build/runtime errors
- [ ] Supabase dashboard → Logs for auth/database issues
- [ ] Resend dashboard → email delivery monitoring

---

## Quick Reference: Environment URLs

| Component       | Beta                                                  | Production                                            |
|----------------|-------------------------------------------------------|-------------------------------------------------------|
| Supabase       | `https://lxgkzjeheppcpnbdruws.supabase.co`           | `https://jyubxcugxmtdsemfjucq.supabase.co`           |
| Backend (Railway) | TBD                                                | TBD                                                   |
| Frontend (Vercel) | TBD                                                | TBD                                                   |
| Resend SMTP    | `smtp.resend.com:587`                                 | `smtp.resend.com:587`                                 |
