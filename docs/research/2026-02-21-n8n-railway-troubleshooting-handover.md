# n8n Railway Deployment — Troubleshooting Handover

**Date:** 2026-02-21
**Status:** BLOCKED — Postgres service is running n8n instead of PostgreSQL
**Handover reason:** Context window exhausted after extensive debugging session

---

## The Goal

Get n8n running on Railway, connected to PostgreSQL, with the LinkedIn publishing workflow imported and active.

## What Was Accomplished

### 1. Root Directory Fix (DONE)
- The new n8n service `bubbly-strength` (ID: `46d5523f-d5d2-4980-b0f1-76e43c35ff29`) was building from the repo root (Next.js) instead of `/n8n`
- **Fix:** Used Railway GraphQL API `serviceInstanceUpdate` mutation to set `rootDirectory: "/n8n"`
- **API call:** `POST https://backboard.railway.com/graphql/v2` with mutation `serviceInstanceUpdate(serviceId: "46d5523f...", environmentId: "60de66df...", input: { rootDirectory: "/n8n" })`
- Confirmed working: subsequent deploys show `rootDirectory: "/n8n"` and `nodeRuntime: "node"` (not "next")

### 2. Dockerfile Updated (DONE)
- Changed from Railpack builder to Docker builder using `n8nio/n8n:latest`
- `n8n/railway.toml`: `builder = "DOCKERFILE"`, `dockerfilePath = "Dockerfile"`
- `n8n/Dockerfile`: Uses `FROM n8nio/n8n`, copies `startup.sh` diagnostic script, overrides entrypoint
- `n8n/Dockerfile.disabled` was renamed to `n8n/Dockerfile`

### 3. Environment Variables (DONE)
All env vars set on `bubbly-strength` service. Current state (last set for public proxy attempt):
```
DB_POSTGRESDB_HOST=turntable.proxy.rlwy.net
DB_POSTGRESDB_PORT=36195
DB_POSTGRESDB_SSL_ENABLED=true
DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false
NODE_TLS_REJECT_UNAUTHORIZED=0
PGSSLMODE=no-verify
```
These need to be reverted to private networking once Postgres is fixed:
```
DB_POSTGRESDB_HOST=postgres.railway.internal
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_SSL_ENABLED=false
```
And the unnecessary vars removed: `NODE_TLS_REJECT_UNAUTHORIZED`, `PGSSLMODE`, `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED`

### 4. Workflow File Verified (DONE)
- `n8n/workflows/linkedin-publish-prod.json` already uses `.first().json` everywhere — no `.item.json` bugs to fix
- Workflow is ready to import as-is

### 5. Domain Already Set (DONE)
- `bubbly-strength` already has a public domain: `bubbly-strength-production-7976.up.railway.app`
- `N8N_HOST` and `WEBHOOK_URL` already configured to match
- `linkie-claw` service's `N8N_WEBHOOK_URL` still points to the OLD n8n domain (`n8n-production-d322.up.railway.app`) — needs updating

---

## The Blocker: Postgres Service Running n8n

### Discovery
During diagnostics, the "Postgres" service's deploy logs revealed:
- Build log: `FROM docker.io/n8nio/n8n:latest` — it built from the n8n Docker image
- Deploy log: `n8n ready on ::, port 5678` and `Editor is now accessible via: http://localhost:5678`
- The service was redeployed on **2026-02-19** and has been running n8n instead of PostgreSQL ever since

### Evidence
- Postgres service (ID: `771ef4e0-4329-4c14-92c1-2314fadf0d07`) build logs show `FROM docker.io/n8nio/n8n:latest`
- Deploy logs filtered for "ready" return: `n8n ready on ::, port 5678`
- No PostgreSQL "database system is ready to accept connections" message exists
- The public proxy (`turntable.proxy.rlwy.net:36195`) ECONNRESET verified from local machine too

### Impact
- ALL connection attempts from ANY service to `postgres.railway.internal:5432` fail with ECONNREFUSED (nothing listens on 5432)
- ALL connection attempts via public proxy fail with ECONNRESET (proxy forwards to 5432 but n8n is on 5678)
- The linkie-claw app appears to work (login page loads) only because JWT sessions don't require DB. Any data query fails.

### Root Cause Theory
The Postgres service's source was likely changed from the postgres-ssl template to the GitHub repo. When a deploy was triggered, Railway detected `n8n/Dockerfile` and built from it, replacing PostgreSQL with n8n.

---

## Required Fix (Manual — Railway Dashboard)

### Option A: Restore Postgres Service
1. Go to Railway dashboard → Postgres service → Settings → Source
2. Disconnect from GitHub repo (if connected)
3. Redeploy from the original image: `ghcr.io/railwayapp-templates/postgres-ssl:17`
4. The volume at `/var/lib/postgresql/data` should still contain the original data
5. Verify PostgreSQL starts and accepts connections on port 5432

### Option B: Fresh Postgres (if data is corrupted)
1. Delete the current Postgres service
2. Deploy a new Postgres from Railway's postgres-ssl template
3. Update all services with new credentials
4. Re-run database migrations from linkie-claw

### After Postgres is Restored
1. Switch `bubbly-strength` env vars back to private networking:
   ```
   DB_POSTGRESDB_HOST=postgres.railway.internal
   DB_POSTGRESDB_PORT=5432
   DB_POSTGRESDB_SSL_ENABLED=false
   ```
2. Remove debug vars: `NODE_TLS_REJECT_UNAUTHORIZED`, `PGSSLMODE`, `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED`
3. Simplify `n8n/Dockerfile` back to original (remove diagnostic startup.sh, restore original entrypoint)
4. Deploy and verify n8n connects to Postgres
5. Set up n8n owner account: POST to `/rest/owner/setup` (admin@linky.com)
6. Import workflow from `n8n/workflows/linkedin-publish-prod.json`
7. Update `linkie-claw` service's `N8N_WEBHOOK_URL` to `https://bubbly-strength-production-7976.up.railway.app/webhook/linkedin-post`

---

## Approaches Tried (This Session)

| # | Approach | Result |
|---|----------|--------|
| 1 | GraphQL API to set rootDirectory="/n8n" | SUCCESS — root dir fixed |
| 2 | Railpack build + private networking | ECONNREFUSED (IPv6) |
| 3 | Railpack build + public proxy + SSL | ECONNRESET |
| 4 | Railpack build + public proxy + NODE_TLS_REJECT_UNAUTHORIZED=0 | ECONNRESET |
| 5 | Docker image (n8nio/n8n) + private networking (Alpine) | ECONNREFUSED (IPv4) |
| 6 | Docker image + public proxy + SSL | ECONNRESET |
| 7 | Docker image + diagnostic startup.sh (entrypoint issue) | CMD not found |
| 8 | Docker image + USER root for chmod | Build success, diagnostics ran |
| 9 | PostgreSQL SSLRequest handshake test | ECONNRESET after SSLRequest |
| 10 | TLS-first connection test | ECONNRESET |
| 11 | Local machine pg library test | ECONNRESET — confirmed proxy broken |
| 12 | Check Postgres service logs | **FOUND: running n8n, not PostgreSQL** |

---

## Key Service IDs

| Service | ID | Status |
|---------|-----|--------|
| bubbly-strength (n8n) | `46d5523f-d5d2-4980-b0f1-76e43c35ff29` | Deployed, waiting for Postgres |
| Postgres | `771ef4e0-4329-4c14-92c1-2314fadf0d07` | BROKEN — running n8n |
| linkie-claw | `ee58d0c7-278b-4d84-92c5-a9ab3fe23130` | Running (no DB access) |
| Environment | `60de66df-14cd-4e4e-becf-1d382097e162` | production |
| Project | `082335f8-9f79-4ba0-bbf9-60c9e2cf5de9` | dazzling-caring |

## Key File Changes (Uncommitted)

- `n8n/Dockerfile` — now exists (was `Dockerfile.disabled`), uses `FROM n8nio/n8n` with diagnostic startup script
- `n8n/railway.toml` — changed from `RAILPACK` to `DOCKERFILE` builder
- `n8n/startup.sh` — diagnostic script (can be simplified after Postgres is fixed)

## Ghost Services to Delete (Dashboard)
- `postgres` (lowercase, ID: `97aece3b`) — empty, never deployed
- `n8n-lOge` (ID: `74cc9438`) — never deployed
