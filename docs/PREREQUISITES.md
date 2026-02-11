# Linkie Claw — Prerequisites Checklist

Everything you need to set up **before** Kimi starts executing the roadmap.
Items are listed in the order they'll be needed (by phase).

---

## STILL NEED TO GATHER

> **Quick reference:** These are the credentials/accounts you still need to obtain.
> Items marked with `(self-generate)` can be created locally with a command.
> Items marked with `(account required)` need you to create an account or configure a service.

### Phase 1 — Authentication

- [ ] `AUTH_SECRET` `(self-generate)` — Run `npx auth secret`
- [ ] `AUTH_GOOGLE_ID` `(account required)` — Google Cloud Console → Create OAuth 2.0 Client (localhost redirect URI)
- [ ] `AUTH_GOOGLE_SECRET` `(account required)` — Same as above
- [ ] `AUTH_GITHUB_ID` `(account required)` — GitHub → Settings → Developer settings → OAuth Apps → New (localhost redirect URI)
- [ ] `AUTH_GITHUB_SECRET` `(account required)` — Same as above

### Phase 6 — Node.js Scheduler

- [ ] `CRON_SECRET` `(self-generate)` — Run `openssl rand -hex 32`

### Phase 7 Tier 2 — LinkedIn Analytics (Optional)

- [ ] **LinkedIn Community Management API approval** `(account required)` — Apply during Phase 1, needed before Phase 7 Tier 2
- [ ] `LINKEDIN_CLIENT_ID` `(account required)` — May already exist if LinkedIn app created, otherwise create new app
- [ ] `LINKEDIN_CLIENT_SECRET` `(account required)` — Same as above
- [ ] `ENCRYPTION_KEY` `(self-generate)` — Run `openssl rand -base64 32` (may already exist)

### Phase 10 — Production Deployment

- [ ] **Hosting platform account** `(account required)` — TBD: Railway, Vercel, Render, Fly.io, etc.
- [ ] **PostgreSQL database** `(account required)` — Provision via hosting platform
- [ ] `DATABASE_URL` `(account required)` — PostgreSQL connection string from hosting platform
- [ ] **Production domain** `(account required)` — From hosting platform or custom domain
- [ ] All environment variables reconfigured for production (rotate all API keys)

---

## SECURITY — Do This First

> **CRITICAL:** Your local `.env` file contains real API keys (Anthropic, Gemini, Replicate, LinkedIn OAuth, etc.). These are **not** pushed to remote (`.gitignore` covers `.env`), but you should **rotate all exposed keys** before deploying to production. Phase 10 handles key rotation.

---

## Accounts to Create

| # | Service | URL | Needed By | Free Tier | Notes |
|---|---------|-----|-----------|-----------|-------|
| 1 | **Google Cloud** (OAuth) | console.cloud.google.com | Phase 1 | Free | For Google sign-in (localhost redirect URI) |
| 2 | **GitHub** (OAuth App) | github.com/settings/developers | Phase 1 | Free | For GitHub sign-in (localhost redirect URI) |
| 3 | **LinkedIn Developer** | linkedin.com/developers | Phase 1 (apply) / Phase 7 Tier 2 (use) | Free | Community Management API approval can take days — apply early |
| 4 | **Hosting Platform** | TBD | Phase 10 | Varies | TBD: Railway, Vercel, Render, etc. Decision made in Phase 10 |
| 5 | **n8n** (self-hosted) | n8n.io | Phase 10 (production deploy only) | Free (local Docker) | **EXISTING WORKING SYSTEM.** The workflow at `n8n/workflows/linkedin-publish.json` was functional on the previous machine. Runs locally via Docker Compose during dev; Phase 10 migrates to persistent hosting (re-imports same workflow, no modifications). If posting fails, it's a credentials/setup issue — not a code problem. |

**Note:** Phase 1 uses **localhost** redirect URIs for OAuth. Phase 10 will add **production** redirect URIs.

---

## Environment Variables by Phase

### Phase 1 — Authentication

Local development only. Auth credentials configured for localhost.

| Variable | Status | How to Get It | Where to Set |
|----------|--------|--------------|--------------|
| `DATABASE_URL` | **Have** (SQLite) | Already set to `file:./local.db` | `.env.local` |
| `AUTH_SECRET` | **Need** | Run `npx auth secret` | `.env.local` |
| `AUTH_GOOGLE_ID` | **Need** | Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client | `.env.local` |
| `AUTH_GOOGLE_SECRET` | **Need** | Same as above | `.env.local` |
| `AUTH_GITHUB_ID` | **Need** | GitHub → Settings → Developer settings → OAuth Apps → New | `.env.local` |
| `AUTH_GITHUB_SECRET` | **Need** | Same as above | `.env.local` |
| `NEXT_PUBLIC_APP_URL` | **Have** | Set to `http://localhost:3000` for local dev | `.env.local` |
| `ANTHROPIC_API_KEY` | **Have** | Already in `.env` | `.env.local` |
| `GEMINI_API_KEY` | **Have** | Already in `.env` | `.env.local` |
| `REPLICATE_API_TOKEN` | **Have** | Already in `.env` | `.env.local` |
| `IMAGE_PROVIDER` | **Have** | Already set to `"gemini"` | `.env.local` |

**OAuth Redirect URIs for Phase 1:**
- Google: `http://localhost:3000/api/auth/callback/google`
- GitHub: `http://localhost:3000/api/auth/callback/github`

### Phase 2-5 — No New Prerequisites

These phases build features using existing credentials.

### Phase 6 — Node.js Scheduler

| Variable | Status | How to Get It | Where to Set |
|----------|--------|--------------|--------------|
| `CRON_SECRET` | **Need** | Run `openssl rand -hex 32` | `.env.local` |
| `N8N_CALLBACK_SECRET` | **Have** | Already in `.env` | `.env.local` |
| `N8N_WEBHOOK_URL` | **Have** | Already in `.env` (localhost n8n URL) | `.env.local` |

### Phase 7 Tier 2 — LinkedIn Analytics (Optional)

**Prerequisites:**
- LinkedIn Community Management API access approved (apply during Phase 1)
- LinkedIn Developer App created (may already exist)

| Variable | Status | How to Get It | Where to Set |
|----------|--------|--------------|--------------|
| `LINKEDIN_CLIENT_ID` | **Have** or **Need** | LinkedIn Developer Portal → Your App → Auth | `.env.local` |
| `LINKEDIN_CLIENT_SECRET` | **Have** or **Need** | Same as above | `.env.local` |
| `ENCRYPTION_KEY` | **Have** or **Need** | Run `openssl rand -base64 32` | `.env.local` |

**OAuth Redirect URI for Phase 7 Tier 2:**
- LinkedIn: `http://localhost:3000/api/linkedin/callback`

### Phase 8 — No New Prerequisites

Analytics UI uses credentials from Phase 7.

### Phase 9 — No New Prerequisites

Final polish phase — no new services or credentials needed.

### Phase 10 — Production Deployment

**Prerequisites:**
- Hosting platform account created (Railway, Vercel, Render, etc.)
- PostgreSQL database provisioned
- Production domain obtained

| Variable | Status | How to Get It | Where to Set |
|----------|--------|--------------|--------------|
| `DATABASE_URL` | **Need new** (PostgreSQL) | Hosting platform → Create PostgreSQL database → copy connection string | Platform env vars |
| `AUTH_SECRET` | **Rotate** | Run `npx auth secret` again for production | Platform env vars |
| `AUTH_GOOGLE_ID` | **Reconfigure** | Add production redirect URI to existing Google OAuth app | Platform env vars |
| `AUTH_GOOGLE_SECRET` | **Reconfigure** | Same as above | Platform env vars |
| `AUTH_GITHUB_ID` | **Reconfigure** | Add production redirect URI to existing GitHub OAuth app | Platform env vars |
| `AUTH_GITHUB_SECRET` | **Reconfigure** | Same as above | Platform env vars |
| `NEXT_PUBLIC_APP_URL` | **Need** | Production URL (e.g., `https://linkie-claw.example.com`) | Platform env vars |
| `ANTHROPIC_API_KEY` | **Rotate** | Generate new key at console.anthropic.com | Platform env vars |
| `GEMINI_API_KEY` | **Rotate** | Generate new key at aistudio.google.com | Platform env vars |
| `REPLICATE_API_TOKEN` | **Rotate** | Generate new token at replicate.com | Platform env vars |
| `IMAGE_PROVIDER` | **Copy** | Same as local (`"gemini"` or `"replicate"`) | Platform env vars |
| `LINKEDIN_CLIENT_ID` | **Reconfigure** | Add production redirect URI to existing LinkedIn app | Platform env vars |
| `LINKEDIN_CLIENT_SECRET` | **Copy** | Same as local | Platform env vars |
| `ENCRYPTION_KEY` | **Rotate** | Run `openssl rand -base64 32` again for production | Platform env vars |
| `N8N_WEBHOOK_URL` | **Need new** | Production n8n instance HTTPS URL | Platform env vars |
| `N8N_CALLBACK_SECRET` | **Rotate** | Run `openssl rand -hex 32` again for production | Platform env vars |
| `CRON_SECRET` | **Rotate** | Run `openssl rand -hex 32` again for production | Platform env vars |

**OAuth Redirect URIs for Phase 10:**
- Google: `https://{PRODUCTION_URL}/api/auth/callback/google`
- GitHub: `https://{PRODUCTION_URL}/api/auth/callback/github`
- LinkedIn (if Tier 2): `https://{PRODUCTION_URL}/api/linkedin/callback`

---

## Infrastructure to Provision

### Phase 1-5 — Local Development Only

- [ ] SQLite database (already exists at `./local.db`)
- [ ] n8n running locally (Docker) at `http://localhost:5678` — **Do NOT modify the n8n workflow.** If posting to LinkedIn fails, it's a credentials/setup issue. See troubleshooting in `AGENTS.md` and `docs/roadmap/00-overview.md`.

### Phase 6 — Node.js Scheduler

No external infrastructure — scheduler runs as part of Next.js app.

### Phase 10 — Production Deployment

- [ ] Hosting platform account created (Railway, Vercel, Render, etc.)
- [ ] Next.js app deployed to platform
- [ ] PostgreSQL database provisioned
- [ ] n8n deployed to persistent hosting with:
  - [ ] Persistent storage (workflows survive restarts)
  - [ ] Public HTTPS URL (reachable from Next.js app and LinkedIn OAuth)
  - [ ] **Same working workflow** re-imported from `n8n/workflows/linkedin-publish.json` (no modifications)
  - [ ] LinkedIn OAuth2 credentials configured in n8n UI
  - [ ] Webhook URL in production `.env` matches the n8n webhook path
- [ ] Platform cron configured to call `/api/cron/publish-scheduled` every 60 seconds

---

## NPM Packages to Add (by phase)

| Phase | Install | Uninstall |
|-------|---------|-----------|
| 1 | `next-auth@beta`, `@auth/drizzle-adapter` | — |
| 10 | `@neondatabase/serverless` (or `pg` for standard PostgreSQL) | `better-sqlite3`, `@types/better-sqlite3` |

---

## LinkedIn Developer App — Special Notes

### Community Management API Access

LinkedIn app approval can take **several days**. Start this early.

**When to apply:** During Phase 1 (so approval is ready by Phase 7 Tier 2).

**Required OAuth scopes:**
- `openid` — OpenID Connect
- `profile` — Basic profile info
- `email` — Email address
- `w_member_social` — Post to LinkedIn (required for publishing)

**Phase 7 Tier 2 adds (requires Community Management API approval):**
- `r_basicprofile` — Extended profile data
- `r_organization_social` — Read analytics data
- `rw_organization_admin` — Read follower demographics

**Note:** Personal LinkedIn accounts may have limited access to analytics APIs. Phase 7 Tier 1 works without LinkedIn API approval (uses mock data). Phase 7 Tier 2 requires Community Management API access.

---

## Manual Steps That Cannot Be Automated

1. **Create accounts** at Google Cloud, GitHub, LinkedIn Developer
2. **Configure OAuth apps** with correct redirect URIs (localhost for dev, production URL for Phase 10)
3. **Apply for LinkedIn Community Management API** (if implementing Phase 7 Tier 2)
4. **Choose deployment platform** (decision made in Phase 10)
5. **Provision PostgreSQL database** (Phase 10)
6. **Deploy n8n** to persistent hosting (Phase 10)
7. **Rotate all API keys** from development before production deployment (Phase 10)
8. **Set all environment variables** in production platform dashboard/CLI (Phase 10)

---

## Estimated Monthly Costs

| Service | Free Tier | Paid Estimate |
|---------|-----------|---------------|
| Hosting Platform (TBD) | Varies | $0-30/mo |
| PostgreSQL Database | Varies | $0-20/mo |
| n8n Hosting (VPS/cloud) | No free tier | $5-20/mo |
| Google/GitHub OAuth | Free | $0 |
| LinkedIn API | Free | $0 |
| AI APIs (Anthropic, Gemini/Replicate) | Limited free credits | Variable by usage |
| **Total** | | **~$5-70/mo** |

**For 2 users with ~100 posts/month, expect costs at the lower end of this range.**

---

## Currently Existing Variables (Already in .env)

These keys already exist locally and will be used in development:

### Actively used in codebase today

- `ANTHROPIC_API_KEY` — Claude text generation
- `GEMINI_API_KEY` — Gemini image generation (code also checks `GOOGLE_GEMINI_API_KEY` as fallback)
- `REPLICATE_API_TOKEN` — FLUX image generation
- `IMAGE_PROVIDER` — `"gemini"` (current) or `"replicate"`
- `N8N_CALLBACK_SECRET` — Webhook signature validation
- `N8N_WEBHOOK_URL` — n8n webhook endpoint (currently localhost)
- `ENCRYPTION_KEY` — Token encryption (if implemented)
- `DATABASE_URL` — Currently `file:./local.db` (SQLite)

### In .env, ready for future phases

- `LINKEDIN_CLIENT_ID` — LinkedIn OAuth (Phase 7 Tier 2)
- `LINKEDIN_CLIENT_SECRET` — LinkedIn OAuth (Phase 7 Tier 2)

### Optional / undocumented variables used in code

- `FLUX_MODEL_TIER` — Selects Replicate FLUX model tier: `schnell` (default), `dev`, or `pro`

### In .env but NOT used by Linkie Claw (inherited from ADW tooling)

These can be ignored for Linkie Claw development:

- `OPENAI_API_KEY` — Not referenced in Linkie Claw codebase
- `GITHUB_PAT` — For ADW GitHub integration
- `CLAUDE_CODE_PATH` — ADW agent config
- `E2B_API_KEY` — ADW cloud sandbox
- `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` — ADW agent config
- `CLOUDFLARED_TUNNEL_TOKEN` — Cloudflare tunnel (ADW)
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare R2 (ADW screenshots)
- `CLOUDFLARE_R2_ACCESS_KEY_ID` — Cloudflare R2 (ADW)
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` — Cloudflare R2 (ADW)
- `CLOUDFLARE_R2_BUCKET_NAME` — Cloudflare R2 (ADW)
- `CLOUDFLARE_R2_PUBLIC_DOMAIN` — Cloudflare R2 (ADW)
- `FIRECRAWL_API_KEY` — Firecrawl web scraping (ADW)

---

## New Variables Introduced by the Roadmap

- `AUTH_SECRET` — Auth.js session signing (Phase 1)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth (Phase 1)
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth (Phase 1)
- `NEXT_PUBLIC_APP_URL` — Public app URL (Phase 1 for local, Phase 10 for production)
- `CRON_SECRET` — Cron endpoint authentication (Phase 6)
- `DATABASE_URL` — PostgreSQL connection string (Phase 10, replaces SQLite)

---

## Removed from Roadmap

The following are **NOT** needed:

- **Vercel in Phase 1** — Local development only until Phase 10
- **QStash / Upstash for scheduling** — Replaced by Node.js scheduler in Phase 6
- **Separate PostgreSQL for scheduler job store** — Scheduler uses main app database
- **INTERNAL_API_SECRET** — Not needed with Node.js scheduler (old Python scheduler API auth)
