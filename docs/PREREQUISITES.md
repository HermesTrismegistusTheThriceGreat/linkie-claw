# Linkie Claw — Prerequisites Checklist

Everything you need to set up **before** executing the roadmap.
Items are listed in the order they'll be needed (by phase).

---

## STILL NEED TO GATHER

> **Quick reference:** These are the credentials/accounts you still need to obtain.
> Items marked with `(self-generate)` can be created locally with a command.
> Items marked with `(account required)` need you to create an account or configure a service.

### Phase 2 — Auth (COMPLETED)

- [x] `AUTH_SECRET` `(self-generate)` — Run `npx auth secret`
- [x] `GOOGLE_CLIENT_ID` `(account required)` — Google Cloud Console → Create OAuth 2.0 Client (localhost redirect URI)
- [x] `GOOGLE_CLIENT_SECRET` `(account required)` — Same as above
- [x] `GITHUB_CLIENT_ID` `(account required)` — GitHub → Settings → Developer settings → OAuth Apps → New (localhost redirect URI)
- [x] `GITHUB_CLIENT_SECRET` `(account required)` — Same as above

### Phase 7 — Node.js Scheduler (NOT YET BUILT)

- [ ] `CRON_SECRET` `(self-generate)` — Run `openssl rand -hex 32`

### Phase 8/9 Tier 2 — LinkedIn Analytics (Optional)

- [ ] **LinkedIn Community Management API approval** `(account required)` — Apply early, needed before Phase 8/9 Tier 2
- [ ] `LINKEDIN_CLIENT_ID` `(account required)` — May already exist if LinkedIn app created, otherwise create new app
- [ ] `LINKEDIN_CLIENT_SECRET` `(account required)` — Same as above
- [ ] `ENCRYPTION_KEY` `(self-generate)` — Run `openssl rand -base64 32` (may already exist)

### Phase 11 — Production Deployment (UPCOMING)

- [ ] **Hosting platform account** `(account required)` — TBD: Railway, Vercel, Render, Fly.io, etc.
- [ ] **PostgreSQL database** `(account required)` — Provision via hosting platform
- [ ] `DATABASE_URL` `(account required)` — PostgreSQL connection string from hosting platform
- [ ] **Production domain** `(account required)` — From hosting platform or custom domain
- [ ] All environment variables reconfigured for production (rotate all API keys)

---

## SECURITY — Do This First

> **CRITICAL:** Your local `.env` file contains real API keys (Anthropic, Gemini, Replicate, LinkedIn OAuth, etc.). These are **not** pushed to remote (`.gitignore` covers `.env`), but you should **rotate all exposed keys** before deploying to production. Phase 11 handles key rotation.

---

## Accounts to Create

| # | Service | URL | Needed By | Free Tier | Notes |
|---|---------|-----|-----------|-----------|-------|
| 1 | **Google Cloud** (OAuth) | console.cloud.google.com | Phase 2 (COMPLETED) | Free | For Google sign-in (localhost redirect URI) |
| 2 | **GitHub** (OAuth App) | github.com/settings/developers | Phase 2 (COMPLETED) | Free | For GitHub sign-in (localhost redirect URI) |
| 3 | **LinkedIn Developer** | linkedin.com/developers | Phase 8/9 Tier 2 (optional) | Free | Community Management API approval can take days — apply early |
| 4 | **Hosting Platform** | TBD | Phase 11 | Varies | TBD: Railway, Vercel, Render, etc. Decision made in Phase 11 |
| 5 | **n8n** (self-hosted) | n8n.io | Phase 11 (production deploy only) | Free (local Docker) | **EXISTING WORKING SYSTEM.** The workflow at `n8n/workflows/linkedin-publish.json` was functional on the previous machine. Runs locally via Docker Compose during dev; Phase 11 migrates to persistent hosting (re-imports same workflow, no modifications). If posting fails, it's a credentials/setup issue — not a code problem. |

**Note:** Phase 2 uses **localhost** redirect URIs for OAuth. Phase 11 will add **production** redirect URIs.

---

## Environment Variables by Phase

### Phase 1 — Database Schema (COMPLETED)

Schema design and setup completed. Using SQLite for local development.

### Phase 2 — Auth (COMPLETED)

Local development auth configured. Auth credentials set for localhost.

| Variable | Status | How to Get It | Where to Set |
|----------|--------|--------------|--------------|
| `DATABASE_URL` | **Have** (SQLite) | Already set to `file:./local.db` | `.env.local` |
| `AUTH_SECRET` | **Have** (COMPLETED) | Run `npx auth secret` | `.env.local` |
| `GOOGLE_CLIENT_ID` | **Have** (COMPLETED) | Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client | `.env.local` |
| `GOOGLE_CLIENT_SECRET` | **Have** (COMPLETED) | Same as above | `.env.local` |
| `GITHUB_CLIENT_ID` | **Have** (COMPLETED) | GitHub → Settings → Developer settings → OAuth Apps → New | `.env.local` |
| `GITHUB_CLIENT_SECRET` | **Have** (COMPLETED) | Same as above | `.env.local` |
| `NEXT_PUBLIC_APP_URL` | **Have** | Set to `http://localhost:3000` for local dev | `.env.local` |
| `ANTHROPIC_API_KEY` | **Have** | Already in `.env` | `.env.local` |
| `GEMINI_API_KEY` or `GOOGLE_GEMINI_API_KEY` | **Have** | Already in `.env` | `.env.local` |
| `REPLICATE_API_TOKEN` | **Have** | Already in `.env` | `.env.local` |
| `IMAGE_PROVIDER` | **Have** | Already set to `"gemini"` | `.env.local` |

**OAuth Redirect URIs for Phase 2:**
- Google: `http://localhost:3000/api/auth/callback/google`
- GitHub: `http://localhost:3000/api/auth/callback/github`

### Phase 3 — Multi-User (COMPLETED)

Multi-user support built using existing auth credentials.

### Phase 4 — OpenClaw Compatibility (COMPLETED)

API compatibility layer for OpenClaw built.

### Phase 5 — Settings Page (COMPLETED)

Settings page completed. LinkedIn Profile & Account Info features built.

### Phase 6 — Schedule Page (COMPLETED)

Schedule page with calendar and post editing completed.

### Phase 7 — Node.js Scheduler (NOT YET BUILT)

**Note:** Python FastAPI scheduler is still active. This phase will replace it with Node.js.

| Variable | Status | How to Get It | Where to Set |
|----------|--------|--------------|--------------|
| `CRON_SECRET` | **Need** | Run `openssl rand -hex 32` | `.env.local` |
| `N8N_CALLBACK_SECRET` | **Have** | Already in `.env` | `.env.local` |
| `N8N_WEBHOOK_URL` | **Have** | Already in `.env` (localhost n8n URL) | `.env.local` |

### Phase 8 — Dashboard (Tier 1 COMPLETED)

Dashboard with real data completed. Tier 2 requires LinkedIn API approval.

### Phase 9 — Analytics Page (Tier 1 COMPLETED)

Analytics page with real data completed. Tier 2 requires LinkedIn API approval.

**For Phase 8/9 Tier 2 (Optional - requires LinkedIn Community Management API):**

**Prerequisites:**
- LinkedIn Community Management API access approved (apply early)
- LinkedIn Developer App created (may already exist)

| Variable | Status | How to Get It | Where to Set |
|----------|--------|--------------|--------------|
| `LINKEDIN_CLIENT_ID` | **Have** or **Need** | LinkedIn Developer Portal → Your App → Auth | `.env.local` |
| `LINKEDIN_CLIENT_SECRET` | **Have** or **Need** | Same as above | `.env.local` |
| `ENCRYPTION_KEY` | **Have** or **Need** | Run `openssl rand -base64 32` | `.env.local` |

**OAuth Redirect URI for Phase 8/9 Tier 2:**
- LinkedIn: `http://localhost:3000/api/linkedin/callback`

### Phase 10 — Final Polish (UPCOMING)

Final polish phase — no new services or credentials needed.

### Phase 11 — Production Deployment (UPCOMING)

**Prerequisites:**
- Hosting platform account created (Railway, Vercel, Render, etc.)
- PostgreSQL database provisioned
- Production domain obtained

| Variable | Status | How to Get It | Where to Set |
|----------|--------|--------------|--------------|
| `DATABASE_URL` | **Need new** (PostgreSQL) | Hosting platform → Create PostgreSQL database → copy connection string | Platform env vars |
| `AUTH_SECRET` | **Rotate** | Run `npx auth secret` again for production | Platform env vars |
| `GOOGLE_CLIENT_ID` | **Reconfigure** | Add production redirect URI to existing Google OAuth app | Platform env vars |
| `GOOGLE_CLIENT_SECRET` | **Reconfigure** | Same as above | Platform env vars |
| `GITHUB_CLIENT_ID` | **Reconfigure** | Add production redirect URI to existing GitHub OAuth app | Platform env vars |
| `GITHUB_CLIENT_SECRET` | **Reconfigure** | Same as above | Platform env vars |
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

**OAuth Redirect URIs for Phase 11:**
- Google: `https://{PRODUCTION_URL}/api/auth/callback/google`
- GitHub: `https://{PRODUCTION_URL}/api/auth/callback/github`
- LinkedIn (if Tier 2): `https://{PRODUCTION_URL}/api/linkedin/callback`

### Phase 12 — Voice & Tones (COMPLETED)

Voice and tone customization features completed.

---

## Infrastructure to Provision

### Phase 1-6 — Local Development (COMPLETED)

- [x] SQLite database (already exists at `./local.db`)
- [x] n8n running locally (Docker) at `http://localhost:5678` — **Do NOT modify the n8n workflow.** If posting to LinkedIn fails, it's a credentials/setup issue. See troubleshooting in `docs/roadmap/00-overview.md`.

### Phase 7 — Node.js Scheduler (NOT YET BUILT)

No external infrastructure — scheduler will run as part of Next.js app when built.

### Phase 11 — Production Deployment (UPCOMING)

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
| 2 (COMPLETED) | `next-auth@beta`, `@auth/drizzle-adapter` | — |
| 11 | `@neondatabase/serverless` (or `pg` for standard PostgreSQL) | `better-sqlite3`, `@types/better-sqlite3` |

---

## LinkedIn Developer App — Special Notes

### Community Management API Access

LinkedIn app approval can take **several days**. Start this early.

**When to apply:** Early in development (so approval is ready by Phase 8/9 Tier 2 if implementing optional features).

**Required OAuth scopes:**
- `openid` — OpenID Connect
- `profile` — Basic profile info
- `email` — Email address
- `w_member_social` — Post to LinkedIn (required for publishing)

**Phase 8/9 Tier 2 adds (requires Community Management API approval):**
- `r_basicprofile` — Extended profile data
- `r_organization_social` — Read analytics data
- `rw_organization_admin` — Read follower demographics

**Note:** Personal LinkedIn accounts may have limited access to analytics APIs. Phase 8/9 Tier 1 works without LinkedIn API approval (uses mock data). Phase 8/9 Tier 2 requires Community Management API access.

---

## Manual Steps That Cannot Be Automated

1. **Create accounts** at Google Cloud, GitHub, LinkedIn Developer (Phases 2-9)
2. **Configure OAuth apps** with correct redirect URIs (localhost for dev, production URL for Phase 11)
3. **Apply for LinkedIn Community Management API** (if implementing Phase 8/9 Tier 2)
4. **Choose deployment platform** (decision made in Phase 11)
5. **Provision PostgreSQL database** (Phase 11)
6. **Deploy n8n** to persistent hosting (Phase 11)
7. **Rotate all API keys** from development before production deployment (Phase 11)
8. **Set all environment variables** in production platform dashboard/CLI (Phase 11)

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

These keys already exist locally and are used in development:

### Next.js App (src/)

- `GOOGLE_CLIENT_ID` — Google OAuth client ID (Phase 2)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (Phase 2)
- `GITHUB_CLIENT_ID` — GitHub OAuth client ID (Phase 2)
- `GITHUB_CLIENT_SECRET` — GitHub OAuth client secret (Phase 2)
- `AUTH_SECRET` — NextAuth secret (Phase 2)
- `AUTH_URL` — NextAuth callback URL (Phase 2)
- `AUTH_TRUST_HOST` — NextAuth trust host flag (Phase 2)
- `ANTHROPIC_API_KEY` — Claude text generation
- `GOOGLE_GEMINI_API_KEY` or `GEMINI_API_KEY` — Gemini image generation (code checks both)
- `REPLICATE_API_TOKEN` — FLUX image generation
- `FLUX_MODEL_TIER` — Replicate FLUX model tier: `schnell`, `dev`, or `pro`
- `IMAGE_PROVIDER` — `"gemini"` (current) or `"replicate"`
- `SCHEDULER_URL` — FastAPI scheduler URL (default localhost:8000, until Phase 7 migration)
- `N8N_CALLBACK_SECRET` — Webhook signature validation
- `DATABASE_URL` — Currently `file:./local.db` (SQLite)
- `LINKEDIN_CLIENT_ID` — LinkedIn OAuth (for Phase 8/9 Tier 2 when ready)
- `LINKEDIN_CLIENT_SECRET` — LinkedIn OAuth (for Phase 8/9 Tier 2 when ready)
- `ENCRYPTION_KEY` — Token encryption (for Phase 8/9 Tier 2 when ready)

### Python Scheduler (scheduler/) — Currently Active Until Phase 7

- `DATABASE_URL` — PostgreSQL for APScheduler job store
- `N8N_WEBHOOK_URL` — n8n webhook for publishing
- `SUNDAY_API_URL` — Next.js API base URL
- `LOG_LEVEL` — Logging level

---

## New Variables Introduced by the Roadmap

- `AUTH_SECRET` — Auth.js session signing (Phase 2, COMPLETED)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth (Phase 2, COMPLETED)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth (Phase 2, COMPLETED)
- `NEXT_PUBLIC_APP_URL` — Public app URL (Phase 2 for local, Phase 11 for production)
- `CRON_SECRET` — Cron endpoint authentication (Phase 7, NOT YET BUILT)
- `DATABASE_URL` — PostgreSQL connection string (Phase 11, will replace SQLite)

---

## Removed from Roadmap

The following are **NOT** needed:

- **Vercel in early phases** — Local development only until Phase 11
- **QStash / Upstash for scheduling** — Replaced by Node.js scheduler in Phase 7
- **Separate PostgreSQL for scheduler job store** — Scheduler will use main app database
- **INTERNAL_API_SECRET** — Not needed with Node.js scheduler (old Python scheduler API auth)
