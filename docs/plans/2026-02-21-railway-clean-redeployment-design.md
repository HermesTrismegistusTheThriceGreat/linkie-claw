# Railway Clean Redeployment — Design Document

**Date:** 2026-02-21
**Status:** Approved
**Goal:** Delete the broken `dazzling-caring` Railway project and deploy fresh with 3 clean services: PostgreSQL, linkie-claw (Next.js), and n8n.

---

## Background

The previous Railway project accumulated 3 sessions of debugging cruft: ghost services, a Postgres service accidentally running n8n, diagnostic Dockerfiles, and scattered debug environment variables. Rather than patch it further, we're starting clean.

**What's NOT changing:** The codebase. All code is production-ready. Schema is PostgreSQL, workflow JSON uses `.first().json`, middleware allows required paths. Only the Railway infrastructure is being rebuilt.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Railway Project: linkie-claw                   │
│                                                 │
│  ┌──────────┐  private   ┌──────────────────┐   │
│  │ Postgres │◄──────────│  linkie-claw     │   │
│  │ (template)│  :5432    │  (Next.js)       │   │
│  │ NO GitHub│           │  GitHub: /       │   │
│  └──────────┘           │  app.linkyai.dev │   │
│       ▲                  └──────────────────┘   │
│       │ private                    ▲            │
│       │ :5432                      │ webhook    │
│  ┌──────────┐                      │            │
│  │   n8n    │──────────────────────┘            │
│  │ GitHub:  │  calls /api/internal/*            │
│  │   /n8n   │  and /api/webhooks/*              │
│  └──────────┘                                   │
└─────────────────────────────────────────────────┘
```

- All services communicate over Railway private networking (Wireguard-encrypted, no SSL needed)
- n8n calls linkie-claw via public domain for webhook callbacks
- PostgreSQL is deployed from Railway's template — NEVER connected to GitHub

---

## Critical Rule

**PostgreSQL must NEVER be connected to the GitHub repo.** This is what caused the previous failure — Railway detected `n8n/Dockerfile` and rebuilt the Postgres service as n8n. The Postgres service uses Railway's `postgres-ssl` template only.

---

## Step 0: Code Cleanup (Before touching Railway)

Clean up n8n files that accumulated debugging cruft:

### n8n/Dockerfile — Strip to essentials
```dockerfile
FROM n8nio/n8n

ENV ENABLE_ALPINE_PRIVATE_NETWORKING=true

EXPOSE 5678
```

No startup.sh, no USER root, no custom entrypoint. Base image handles everything.

### n8n/startup.sh — Delete entirely
Diagnostic tool from debugging sessions. No longer needed.

### n8n/railway.toml — Keep as-is
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
```

### Commit and push
These changes must be committed before creating the Railway project so the first deploy pulls clean code.

---

## Step 1: Delete Old Project

- Delete `dazzling-caring` from Railway dashboard
- Removes all ghost services, corrupted configs, debug env vars

---

## Step 2: Create New Railway Project

- Name: `linkie-claw`
- Connect to GitHub repo: `seage/linkie-claw` (or whatever the repo is)

---

## Step 3: PostgreSQL

**Source:** Railway `postgres-ssl` template (NOT GitHub)

**What Railway provides automatically:**
- `DATABASE_URL`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`, `PGPORT`
- Private hostname: `postgres.railway.internal:5432`
- Public proxy: `{generated}.proxy.rlwy.net:{port}`

### VERIFY GATE
- [ ] Service shows "PostgreSQL" in Railway dashboard
- [ ] Deploy logs show `database system is ready to accept connections`
- [ ] Can connect from local machine via public proxy

**DO NOT PROCEED until all checks pass.**

---

## Step 4: linkie-claw (Next.js)

**Source:** GitHub repo, root directory `/` (default)
**Builder:** Auto-detected (Railpack for Next.js)
**Custom domain:** `app.linkyai.dev`

### Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway reference variable |
| `AUTH_SECRET` | Generate fresh | `openssl rand -base64 32` |
| `AUTH_URL` | `https://app.linkyai.dev` | |
| `AUTH_TRUST_HOST` | `true` | Required behind proxy |
| `GOOGLE_CLIENT_ID` | From `.env.local` | Update OAuth redirect URI |
| `GOOGLE_CLIENT_SECRET` | From `.env.local` | |
| `GITHUB_CLIENT_ID` | From `.env.local` | Update OAuth redirect URI |
| `GITHUB_CLIENT_SECRET` | From `.env.local` | |
| `ANTHROPIC_API_KEY` | From `.env.local` | |
| `GEMINI_API_KEY` | From `.env.local` | |
| `REPLICATE_API_TOKEN` | From `.env.local` | |
| `IMAGE_PROVIDER` | `gemini` | |
| `LINKEDIN_CLIENT_ID` | From `.env.local` | |
| `LINKEDIN_CLIENT_SECRET` | From `.env.local` | |
| `ENCRYPTION_KEY` | From `.env.local` | |
| `N8N_WEBHOOK_URL` | Set AFTER Step 5 | Placeholder until n8n deployed |
| `N8N_CALLBACK_SECRET` | Generate fresh | `openssl rand -base64 32` |
| `CRON_SECRET` | Generate fresh | `openssl rand -hex 32` |
| `INTERNAL_API_SECRET` | Generate fresh | `openssl rand -hex 32` |
| `R2_ACCOUNT_ID` | From `.env.local` | |
| `R2_ACCESS_KEY_ID` | From `.env.local` | |
| `R2_SECRET_ACCESS_KEY` | From `.env.local` | |
| `R2_BUCKET_NAME` | `deltaagents` | |
| `R2_PUBLIC_URL` | `https://storage.deltaagents.dev` | |
| `NEXT_PUBLIC_APP_URL` | `https://app.linkyai.dev` | |

### Post-Deploy Actions
1. Assign custom domain `app.linkyai.dev`
2. DB schema push happens automatically via Railway build (or run manually via CLI)
3. Update Google OAuth redirect URI: `https://app.linkyai.dev/api/auth/callback/google`
4. Update GitHub OAuth redirect URI: `https://app.linkyai.dev/api/auth/callback/github`

### VERIFY GATE
- [ ] Build succeeds in Railway logs
- [ ] Login page loads at `https://app.linkyai.dev/login`
- [ ] Can sign in with Google OAuth
- [ ] Dashboard loads (empty, no errors)

**DO NOT PROCEED until all checks pass.**

---

## Step 5: n8n

**Source:** GitHub repo, root directory `/n8n`, Dockerfile builder
**Custom domain:** `n8n.linkyai.dev` (recommended) or Railway-generated domain

**CRITICAL:** Set root directory to `/n8n` immediately after creating the service, before first deploy.

### Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `DB_TYPE` | `postgresdb` | |
| `DB_POSTGRESDB_HOST` | `postgres.railway.internal` | Private networking |
| `DB_POSTGRESDB_PORT` | `5432` | Standard Postgres port |
| `DB_POSTGRESDB_DATABASE` | `railway` | Railway default |
| `DB_POSTGRESDB_USER` | `${{Postgres.PGUSER}}` | Reference variable |
| `DB_POSTGRESDB_PASSWORD` | `${{Postgres.PGPASSWORD}}` | Reference variable |
| `DB_POSTGRESDB_SSL_ENABLED` | `false` | Private network, no SSL |
| `N8N_HOST` | `n8n.linkyai.dev` | Public hostname |
| `N8N_PORT` | `5678` | n8n default |
| `N8N_PROTOCOL` | `https` | |
| `N8N_LISTEN_ADDRESS` | `::` | IPv6 for Railway |
| `WEBHOOK_URL` | `https://n8n.linkyai.dev/` | Trailing slash |
| `N8N_ENCRYPTION_KEY` | Generate fresh | Credential storage |
| `APP_URL` | `https://app.linkyai.dev` | Workflow callback target |
| `CRON_SECRET` | Same as linkie-claw | Shared secret |
| `N8N_CALLBACK_SECRET` | Same as linkie-claw | Shared secret |

### VERIFY GATE
- [ ] Build log shows `FROM n8nio/n8n` (not Next.js)
- [ ] Deploy log shows `n8n ready on ::, port 5678`
- [ ] Deploy log shows successful DB connection (no ECONNREFUSED)
- [ ] n8n UI accessible at public URL

**DO NOT PROCEED until all checks pass.**

---

## Step 6: n8n Post-Setup

1. **Set up owner account** — POST to `https://n8n.linkyai.dev/rest/owner/setup`:
   ```json
   {
     "email": "admin@linky.com",
     "firstName": "Linkie",
     "lastName": "Admin",
     "password": "<generate-secure-password>"
   }
   ```

2. **Import workflow** — POST `n8n/workflows/linkedin-publish-prod.json` via n8n REST API

3. **Activate workflow** — Deactivate/activate cycle via API

4. **Configure LinkedIn OAuth credential** — In n8n UI, set up LinkedIn OAuth2 credential

5. **Update linkie-claw** — Set `N8N_WEBHOOK_URL` to `https://n8n.linkyai.dev/webhook/linkedin-post`

### VERIFY GATE
- [ ] Workflow visible in n8n UI and toggled active
- [ ] Test curl to webhook endpoint returns a response
- [ ] LinkedIn OAuth credential configured

---

## Step 7: Cron Setup

Railway doesn't have built-in cron. Use an external service.

**Recommended:** cron-job.org (free tier)
- URL: `https://app.linkyai.dev/api/cron/publish-scheduled`
- Method: GET
- Header: `Authorization: Bearer {CRON_SECRET}`
- Schedule: Every 1 minute

### VERIFY GATE
- [ ] Cron service is configured and running
- [ ] Check Railway logs to confirm cron hits are arriving

---

## Step 8: End-to-End Smoke Test

- [ ] Create a post in the app
- [ ] Schedule it for 2 minutes from now
- [ ] Watch cron pick it up (check app logs)
- [ ] Watch n8n execute the workflow (check n8n execution history)
- [ ] Confirm post appears on LinkedIn
- [ ] Confirm status updates to "published" in the app

---

## Environment Variable Generation Commands

Run these locally to generate fresh secrets:

```bash
# AUTH_SECRET
openssl rand -base64 32

# N8N_CALLBACK_SECRET
openssl rand -base64 32

# CRON_SECRET
openssl rand -hex 32

# INTERNAL_API_SECRET
openssl rand -hex 32

# N8N_ENCRYPTION_KEY
openssl rand -hex 32
```

---

## What We Learned (Don't Repeat)

1. **Never connect PostgreSQL to GitHub.** Use Railway templates for database services.
2. **Verify each service is running the right software** before configuring connections.
3. **Verification gates are mandatory.** No service proceeds until the previous one is confirmed working.
4. **Port 5432 is Postgres, port 5678 is n8n.** These are standard and correct. The issue was never ports — it was the wrong software running behind the port.
5. **Keep Dockerfiles minimal.** Diagnostic scripts should be temporary and never committed.
