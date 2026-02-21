# Railway n8n + Postgres Connection Diagnosis

**Date:** 2026-02-20
**Status:** Root cause identified — n8n service has broken private networking

---

## Root Cause: Corrupted Service Network Identity

The n8n service on Railway cannot establish ANY TCP connection to the Postgres service via private networking. This was confirmed by:
- Raw TCP socket tests (not through any ORM/driver) — ECONNREFUSED
- Both IPv4 (`10.253.236.101:5432`) and IPv6 (`fd12:9e18:cb72:1:2000:72:2f7d:ec65:5432`) — REFUSED
- 17 different configuration approaches over 2 sessions — all failed
- The linkie-claw (Next.js) service in the same project/environment connects fine

**Conclusion:** The n8n service has a broken Wireguard mesh peer configuration. The service was created by Gemini (Antigravity IDE) via the Railway MCP, which may have caused a platform-level misconfiguration.

**Fix:** Delete the n8n service from Railway dashboard and create a fresh one.

---

## Key Research Findings

### 1. The Next.js App Uses Plain TCP (No SSL)

```typescript
// src/lib/db/index.ts
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
```

The `pg` library defaults to `ssl: false`. The app connects via plain TCP to `postgres.railway.internal:5432`. No SSL negotiation occurs. This works because Railway's private network is already encrypted by Wireguard.

**Source:** [node-postgres defaults.js](https://github.com/brianc/node-postgres/blob/master/packages/pg/lib/defaults.js) — `ssl: false`

### 2. The postgres-ssl Image Accepts Non-SSL Connections

Railway's `postgres-ssl:17` image has `pg_hba.conf` with BOTH `hostssl` and `host` entries. SSL is optional on the private network — non-SSL connections work fine.

**Source:** [railwayapp-templates/postgres-ssl](https://github.com/railwayapp-templates/postgres-ssl)

### 3. n8n SSL Configuration Is Buggy (But Irrelevant Here)

n8n has known bugs with SSL certificate handling:
- Issue #17723: Ignores system trust store and custom CA certificates
- `DB_POSTGRESDB_SSL_ENABLED=true` creates `ssl: { rejectUnauthorized: false }` but node-postgres may not respect this properly
- `PGSSLMODE=no-verify` ≠ `{ ssl: { rejectUnauthorized: false } }` — they behave differently

**However, SSL is irrelevant** because the connection fails at the TCP level (ECONNREFUSED), before any SSL handshake can occur.

**Sources:**
- [n8n Issue #17723](https://github.com/n8n-io/n8n/issues/17723)
- [node-postgres Issue #2607](https://github.com/brianc/node-postgres/issues/2607)

### 4. Railway Private Networking Can Fail Per-Service

Railway's Wireguard mesh is per-environment, but individual services can have different access levels due to:
- Corrupted Wireguard peer configuration
- IPv4 vs IPv6 socket binding mismatches
- Alpine image networking issues
- Startup timing race conditions

When a service is deleted and recreated, Wireguard peer configurations are regenerated.

**Sources:**
- [Railway Private Networking Guide](https://docs.railway.com/guides/private-networking)
- [Railway Private Networking Deep Dive](https://docs.railway.com/networking/private-networking/how-it-works)
- Multiple Railway Help Station threads on per-service networking failures

### 5. Public Proxy ECONNRESET — Likely Separate Issue

The public TCP proxy (`turntable.proxy.rlwy.net:36195`) gives `ECONNRESET` instead of `ECONNREFUSED`. This is a different failure mode:
- TCP connection IS established (unlike private networking)
- Connection is then reset by the remote side
- This could be SSL negotiation failure, Railway proxy issue, or Postgres rejecting the client

---

## What Was Tried (17 Approaches)

| # | Approach | Path | Error |
|---|----------|------|-------|
| 1-4 | Various Dockerfiles, IPv4/IPv6 configs | Private | ECONNREFUSED |
| 5-6 | Public proxy +/- SSL | Public | ECONNRESET |
| 7 | Raw TCP socket diagnostic | Private | ECONNREFUSED |
| 8-9 | Match official Railway template | Private | ECONNREFUSED |
| 10-13 | Research + template deploy + cross-DB test | Various | Various failures |
| 14-15 | Railpack builder + startup delay | Private | ECONNREFUSED |
| 16-17 | Public proxy +/- SSL (Railpack) | Public | ECONNRESET |
| 18 | Enable SSL on private networking | Private | ECONNREFUSED |
| 19 | Public proxy with SSL enabled | Public | ECONNRESET |

---

## Recommended Fix

### Step 1: Delete and Recreate n8n Service
1. Delete the current n8n service from Railway dashboard
2. Create a new n8n service in the same project
3. Configure it with the same environment variables (see below)
4. Point it to the same GitHub repo + `/n8n` root directory

### Step 2: Configure New Service
```env
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres.railway.internal
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=railway
DB_POSTGRESDB_USER=postgres
DB_POSTGRESDB_PASSWORD=(from Postgres service)
DB_POSTGRESDB_SSL_ENABLED=false
N8N_LISTEN_ADDRESS=::
N8N_PORT=5678
N8N_HOST=(new Railway domain)
N8N_PROTOCOL=https
N8N_ENCRYPTION_KEY=(generate new)
WEBHOOK_URL=https://(new Railway domain)/
INTERNAL_API_SECRET=(matching linkie-claw)
N8N_CALLBACK_SECRET=linkie-claw-n8n-callback-secret-2026
APP_URL=https://app.linkyai.dev
CRON_SECRET=b0e6537036164d43a5bc05ad10feb713
```

### Step 3: Verify
1. Check deploy logs for successful DB initialization (no ECONNREFUSED/ECONNRESET)
2. Access n8n web UI
3. Import and activate LinkedIn publishing workflow

### Fallback: External n8n Deployment
If recreating the service doesn't fix it, deploy n8n on Render or Fly.io and connect to Railway Postgres via the public TCP proxy with SSL.
