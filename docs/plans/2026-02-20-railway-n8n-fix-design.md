# Design: Railway n8n Deployment Fix (Revised)

**Date:** 2026-02-20
**Status:** Revised after SSL fix attempt failed
**Goal:** Get n8n connected to Postgres on Railway and the full publishing pipeline working.

---

## Root Cause Analysis (Corrected)

### What We Initially Thought (Wrong)
The Postgres service runs `postgres-ssl:17` which we assumed required SSL. We thought n8n's `DB_POSTGRESDB_SSL_ENABLED=false` was causing ECONNRESET.

### What We Actually Found
After dispatching 4 research agents to gather documentation:

1. **The postgres-ssl image accepts BOTH SSL and non-SSL connections.** Its `pg_hba.conf` has both `hostssl` and `host` entries. SSL is optional on the private network.

2. **The Next.js app connects via plain TCP (no SSL).** The `pg` library defaults to `ssl: false`. No SSL negotiation occurs. It works because Railway's private network is Wireguard-encrypted.

3. **The ECONNREFUSED is a network-layer failure.** Raw TCP socket tests (bypassing all ORMs/drivers) also got ECONNREFUSED. No application-level configuration can fix a network-layer problem.

4. **Railway private networking CAN fail per-service.** Services can have broken Wireguard mesh peer configurations, especially if created through unusual means (like MCP automation).

### The Actual Root Cause
**The n8n service has a corrupted Wireguard network identity.** It was created by Gemini via the Railway MCP, which may have caused a platform-level misconfiguration. The service cannot establish ANY TCP connection to the Postgres IP address — not IPv4, not IPv6, not with SSL, not without.

### Evidence
- 17 approaches tried over 2 sessions, all failed
- Raw TCP socket test (approach #7) confirmed network-level failure
- Both IPv4 (`10.253.236.101`) and IPv6 (`fd12:...`) ECONNREFUSED
- linkie-claw (same project, same environment) connects fine via plain TCP
- SSL enable/disable makes no difference — TCP can't even be established

---

## Revised Fix Plan

### Phase 1: Delete and Recreate n8n Service (Manual — Railway Dashboard)

**This is the critical step.** The MCP cannot delete services — this must be done manually.

1. Go to Railway dashboard
2. Delete the current n8n service (`e69cf1c5`)
3. Create a new n8n service in the same project
4. Connect it to the GitHub repo with root directory `/n8n`
5. Generate a public domain for it

### Phase 2: Configure New n8n Service Variables

```env
# Database (plain TCP — SSL not needed on private network)
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres.railway.internal
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=railway
DB_POSTGRESDB_USER=postgres
DB_POSTGRESDB_PASSWORD=EvhJwmXFyOgaVmZZUdOFYNZjRMGSlIhu
DB_POSTGRESDB_SSL_ENABLED=false

# n8n Server
N8N_LISTEN_ADDRESS=::
N8N_PORT=5678
N8N_HOST=(new Railway domain)
N8N_PROTOCOL=https
N8N_ENCRYPTION_KEY=(generate new secure key)
WEBHOOK_URL=https://(new Railway domain)/

# Integration
INTERNAL_API_SECRET=6eceadec90a9c4e2faaec9dc217c9b7408034a32e044d93fd62fa09194073f8c
N8N_CALLBACK_SECRET=linkie-claw-n8n-callback-secret-2026
APP_URL=https://app.linkyai.dev
CRON_SECRET=b0e6537036164d43a5bc05ad10feb713

# Alpine networking (if using Docker image)
ENABLE_ALPINE_PRIVATE_NETWORKING=true
```

### Phase 3: Update linkie-claw Service

- Ensure `INTERNAL_API_SECRET` is set (already done: `6eceadec...`)
- Update any hardcoded n8n URLs to point to the new domain

### Phase 4: Ghost Service Cleanup (manual — Railway dashboard)

- Delete `postgres` (lowercase, `97aece3b`) — empty, never deployed
- Delete `n8n-lOge` (`74cc9438`) — never deployed

### Phase 5: Verification

1. Check n8n deploy logs for successful Postgres connection
2. Verify n8n web UI loads at the new domain
3. Set up n8n owner account
4. Import LinkedIn publishing workflow
5. Activate workflow and test webhook

### Phase 6: Fallback — External Deployment

If recreating the service doesn't fix private networking:
1. Deploy n8n on Render or Fly.io
2. Connect to Railway Postgres via public TCP proxy with SSL:
   ```env
   DB_POSTGRESDB_HOST=turntable.proxy.rlwy.net
   DB_POSTGRESDB_PORT=36195
   DB_POSTGRESDB_SSL_ENABLED=true
   DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false
   ```

---

## Documentation Created

Research docs saved to `docs/research/`:
- `railway-n8n-postgres-diagnosis.md` — Full diagnosis with evidence
- `n8n-database-configuration.md` — n8n PostgreSQL config reference

Existing Railway docs in `docs/railway_docs/` (17 files) — already comprehensive.

---

## Key Lessons

1. **Always investigate the database server, not just the client.** Two sessions focused exclusively on n8n configuration and network paths.
2. **Documentation-driven debugging works.** The 4 research agents found that SSL was irrelevant in 5 minutes — something 17 trial-and-error attempts missed.
3. **Raw TCP tests are the gold standard.** The diagnostic script (approach #7) proved this was network-layer, but that finding wasn't acted on properly.
4. **Services created via MCP/API may have platform-level issues** that can't be debugged from the application layer.
