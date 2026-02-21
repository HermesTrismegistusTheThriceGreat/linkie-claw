# Railway Clean Redeployment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Delete the broken Railway project and deploy 3 clean services (PostgreSQL, Next.js, n8n) with verification gates between each step.

**Architecture:** Fresh Railway project with PostgreSQL from template (never GitHub-connected), linkie-claw Next.js app from GitHub root, and n8n from GitHub `/n8n` subdirectory using Dockerfile builder. All inter-service communication over Railway private networking.

**Tech Stack:** Railway, PostgreSQL (postgres-ssl template), Next.js 16, n8n (Docker), Railway MCP

---

## Prerequisites

- Railway CLI logged in (`railway login`)
- Railway MCP server configured in `.mcp.json`
- Access to Railway dashboard for manual steps
- Access to Google Cloud Console and GitHub Developer Settings for OAuth redirect URIs
- `.env.local` available for copying API keys/secrets

---

### Task 1: Code Cleanup — Clean n8n Dockerfile

**Files:**
- Modify: `n8n/Dockerfile`
- Delete: `n8n/startup.sh`
- Keep: `n8n/railway.toml` (already correct)

**Step 1: Replace n8n/Dockerfile with clean version**

```dockerfile
FROM n8nio/n8n

ENV ENABLE_ALPINE_PRIVATE_NETWORKING=true

EXPOSE 5678
```

**Step 2: Delete n8n/startup.sh**

```bash
rm n8n/startup.sh
```

**Step 3: Delete n8n/Dockerfile.disabled (if it exists)**

```bash
rm -f n8n/Dockerfile.disabled
```

**Step 4: Verify n8n/railway.toml is correct**

Should contain:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
```

**Step 5: Commit and push**

```bash
git add n8n/Dockerfile n8n/railway.toml
git rm n8n/startup.sh
git rm --cached n8n/Dockerfile.disabled 2>/dev/null || true
git commit -m "chore: clean up n8n Dockerfile for fresh Railway deployment"
git push origin main
```

---

### Task 2: Delete Old Railway Project (MANUAL)

**This task requires the user to act in the Railway dashboard.**

**Step 1: User deletes `dazzling-caring` from Railway dashboard**

1. Go to https://railway.com/dashboard
2. Click on `dazzling-caring` project
3. Settings (gear icon) > Danger Zone > Delete Project
4. Confirm deletion

**Step 2: Verify deletion**

Use Railway MCP `list-projects` to confirm `dazzling-caring` is gone.

---

### Task 3: Create New Railway Project

**Step 1: Create project via Railway MCP**

Use `create-project-and-link` with:
- `projectName`: `linkie-claw`
- `workspacePath`: project root directory

**Step 2: Verify project exists**

Use `list-projects` to confirm `linkie-claw` appears.

---

### Task 4: Deploy PostgreSQL

**CRITICAL: PostgreSQL must come from a Railway template, NOT from GitHub.**

**Step 1: Deploy postgres-ssl template**

Use Railway MCP `deploy-template` with:
- `searchQuery`: `postgres`
- `workspacePath`: project root directory

Select the `postgres-ssl` or `Postgres` template.

**Step 2: Wait for deployment**

Give it 30-60 seconds to start.

**Step 3: VERIFY GATE — Confirm PostgreSQL is running**

Use Railway MCP `get-logs` with:
- `logType`: `deploy`
- `service`: the Postgres service name
- `lines`: 20

Expected: Logs contain `database system is ready to accept connections`

**Step 4: VERIFY GATE — Check service variables exist**

Use Railway MCP `list-variables` for the Postgres service.

Expected: `DATABASE_URL`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`, `PGPORT` all present.

**DO NOT PROCEED until both verifications pass.**

---

### Task 5: Generate Secrets

**Step 1: Generate all fresh secrets locally**

```bash
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "N8N_CALLBACK_SECRET=$(openssl rand -base64 32)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo "N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

**Step 2: Record the generated values**

Save these somewhere temporarily — they'll be used in Tasks 6 and 8. The `CRON_SECRET` and `N8N_CALLBACK_SECRET` must be identical on both linkie-claw and n8n services.

---

### Task 6: Deploy linkie-claw (Next.js)

**Step 1: Link the linkie-claw service to GitHub**

The project was created via MCP and linked. Use Railway MCP `link-service` to see available services, or create the service from the dashboard by adding a new service from GitHub repo `HermesTrismegistusTheThriceGreat/linkie-claw`, root directory `/`.

**Step 2: Set environment variables**

Use Railway MCP `set-variables` for the linkie-claw service. Set ALL of these:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
AUTH_SECRET=<generated-in-task-5>
AUTH_URL=https://app.linkyai.dev
AUTH_TRUST_HOST=true
GOOGLE_CLIENT_ID=<from-env>
GOOGLE_CLIENT_SECRET=<from-env>
GITHUB_CLIENT_ID=<from-env>
GITHUB_CLIENT_SECRET=<from-env>
ANTHROPIC_API_KEY=<from-env>
GEMINI_API_KEY=<from-env>
REPLICATE_API_TOKEN=<from-env>
IMAGE_PROVIDER=gemini
LINKEDIN_CLIENT_ID=<from-env>
LINKEDIN_CLIENT_SECRET=<from-env>
ENCRYPTION_KEY=<from-env>
N8N_CALLBACK_SECRET=<generated-in-task-5>
CRON_SECRET=<generated-in-task-5>
R2_ACCOUNT_ID=<from-env>
R2_ACCESS_KEY_ID=<from-env>
R2_SECRET_ACCESS_KEY=<from-env>
R2_BUCKET_NAME=deltaagents
R2_PUBLIC_URL=https://storage.deltaagents.dev
NEXT_PUBLIC_APP_URL=https://app.linkyai.dev
N8N_WEBHOOK_URL=https://PLACEHOLDER-set-after-n8n-deploy/webhook/linkedin-post
```

Note: `N8N_WEBHOOK_URL` is a placeholder — updated in Task 9 after n8n is deployed.
Note: `DATABASE_URL=${{Postgres.DATABASE_URL}}` is a Railway reference variable — Railway resolves it automatically.

**Step 3: Generate a Railway domain**

Use Railway MCP `generate-domain` for the linkie-claw service to get a Railway domain. This is needed even with a custom domain.

**Step 4: Assign custom domain (MANUAL)**

User adds custom domain `app.linkyai.dev` in Railway dashboard:
1. Service Settings > Domains > Custom Domain
2. Add `app.linkyai.dev`
3. Update DNS CNAME to point to the Railway domain from Step 3

**Step 5: Deploy**

Trigger deploy via Railway MCP `deploy` or it auto-deploys from GitHub push.

**Step 6: Run database migrations**

After the build succeeds, the schema needs to be pushed. Option A: Railway includes `npm run db:push` as part of the build. Option B: Run from local machine using the Postgres public proxy URL.

From local machine:
```bash
DATABASE_URL="<public-proxy-connection-string>" npx drizzle-kit push
```

**Step 7: VERIFY GATE — Build succeeds**

Use Railway MCP `get-logs` with `logType: build` for linkie-claw.
Expected: Build completes without errors.

**Step 8: VERIFY GATE — App loads**

Use `curl -s -o /dev/null -w "%{http_code}" https://app.linkyai.dev/login`
Expected: HTTP 200

**DO NOT PROCEED until both verifications pass.**

---

### Task 7: Update OAuth Redirect URIs (MANUAL)

**Step 1: Google OAuth**

1. Go to https://console.cloud.google.com > APIs & Services > Credentials
2. Edit the OAuth 2.0 Client ID
3. Add Authorized redirect URI: `https://app.linkyai.dev/api/auth/callback/google`
4. Save

**Step 2: GitHub OAuth**

1. Go to https://github.com/settings/developers > OAuth Apps
2. Edit the Linkie Claw app
3. Set Authorization callback URL: `https://app.linkyai.dev/api/auth/callback/github`
4. Save

**Step 3: VERIFY GATE — Test login**

Open `https://app.linkyai.dev/login` in browser and sign in with Google.
Expected: Redirected to dashboard (empty but no errors).

---

### Task 8: Deploy n8n

**Step 1: Create n8n service from GitHub**

In Railway dashboard (or via MCP), add a new service:
- Source: GitHub repo `HermesTrismegistusTheThriceGreat/linkie-claw`
- Root directory: `/n8n` (SET THIS IMMEDIATELY — before first build)
- Builder: Dockerfile (auto-detected from `n8n/railway.toml`)

**Step 2: Set environment variables**

Use Railway MCP `set-variables` for the n8n service:

```
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres.railway.internal
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=railway
DB_POSTGRESDB_USER=${{Postgres.PGUSER}}
DB_POSTGRESDB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_POSTGRESDB_SSL_ENABLED=false
N8N_HOST=n8n.linkyai.dev
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_LISTEN_ADDRESS=::
WEBHOOK_URL=https://n8n.linkyai.dev/
N8N_ENCRYPTION_KEY=<generated-in-task-5>
APP_URL=https://app.linkyai.dev
CRON_SECRET=<same-value-as-linkie-claw>
N8N_CALLBACK_SECRET=<same-value-as-linkie-claw>
```

**Step 3: Generate a Railway domain**

Use Railway MCP `generate-domain` for the n8n service.

**Step 4: Assign custom domain (MANUAL — optional but recommended)**

User adds custom domain `n8n.linkyai.dev` in Railway dashboard:
1. Service Settings > Domains > Custom Domain
2. Add `n8n.linkyai.dev`
3. Update DNS CNAME to point to the Railway domain from Step 3

If skipping custom domain, update `N8N_HOST` and `WEBHOOK_URL` env vars to use the Railway-generated domain instead.

**Step 5: Deploy**

Trigger deploy or wait for auto-deploy.

**Step 6: VERIFY GATE — Build log shows correct image**

Use Railway MCP `get-logs` with `logType: build` for n8n service.
Expected: `FROM n8nio/n8n` in build output.
NOT expected: Any Next.js or Railpack references.

**Step 7: VERIFY GATE — n8n starts and connects to DB**

Use Railway MCP `get-logs` with `logType: deploy` for n8n service, `lines: 30`.
Expected:
- `n8n ready on ::, port 5678`
- No `ECONNREFUSED` or `ECONNRESET` errors

**Step 8: VERIFY GATE — n8n UI accessible**

Open the n8n URL in browser (either custom domain or Railway domain).
Expected: n8n setup page loads (first-time setup wizard).

**DO NOT PROCEED until all three verifications pass.**

---

### Task 9: n8n Post-Setup

**Step 1: Set up n8n owner account**

```bash
curl -X POST https://n8n.linkyai.dev/rest/owner/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@linky.com",
    "firstName": "Linkie",
    "lastName": "Admin",
    "password": "<generate-a-secure-password>"
  }'
```

Expected: HTTP 200 with user object.

**Step 2: Get API auth cookie**

```bash
curl -X POST https://n8n.linkyai.dev/rest/login \
  -H "Content-Type: application/json" \
  -c n8n-cookies.txt \
  -d '{
    "email": "admin@linky.com",
    "password": "<the-password-from-step-1>"
  }'
```

**Step 3: Import workflow**

```bash
curl -X POST https://n8n.linkyai.dev/rest/workflows \
  -H "Content-Type: application/json" \
  -b n8n-cookies.txt \
  -d @n8n/workflows/linkedin-publish-prod.json
```

Note: The workflow JSON is an array — may need to extract the first element:
```bash
# If the above fails, try extracting the workflow object:
cat n8n/workflows/linkedin-publish-prod.json | python -c "import sys,json; w=json.load(sys.stdin)[0]; del w['shared']; print(json.dumps(w))" | curl -X POST https://n8n.linkyai.dev/rest/workflows -H "Content-Type: application/json" -b n8n-cookies.txt -d @-
```

**Step 4: Activate workflow**

```bash
# Get workflow ID from import response, then:
curl -X POST https://n8n.linkyai.dev/rest/workflows/<workflow-id>/activate \
  -H "Content-Type: application/json" \
  -b n8n-cookies.txt
```

**Step 5: Configure LinkedIn OAuth credential in n8n UI**

This must be done manually in the n8n UI:
1. Log into n8n at `https://n8n.linkyai.dev`
2. Go to Credentials > Add Credential > LinkedIn OAuth2 API
3. Set Client ID: `<from LinkedIn Developer Portal>`
4. Set Client Secret: `<from LinkedIn Developer Portal>`
5. OAuth callback URL will be: `https://n8n.linkyai.dev/rest/oauth2-credential/callback`
6. Add this callback URL to LinkedIn Developer Portal > Your App > Auth > Authorized redirect URLs
7. Connect and authorize

**Step 6: Update linkie-claw N8N_WEBHOOK_URL**

Use Railway MCP `set-variables` on linkie-claw service:
```
N8N_WEBHOOK_URL=https://n8n.linkyai.dev/webhook/linkedin-post
```

**Step 7: VERIFY GATE — Test webhook**

```bash
curl -X POST https://n8n.linkyai.dev/webhook/linkedin-post \
  -H "Content-Type: application/json" \
  -d '{"postId": "test-123"}'
```

Expected: A response (even a 400/error is fine — it means n8n received the request and the workflow executed).

---

### Task 10: Cron Setup (MANUAL)

**Step 1: Set up cron-job.org account**

1. Go to https://cron-job.org and create an account
2. Create a new cron job:
   - Title: `Linkie Claw Scheduler`
   - URL: `https://app.linkyai.dev/api/cron/publish-scheduled`
   - Schedule: Every 1 minute
   - Request method: GET
   - Headers: `Authorization: Bearer <CRON_SECRET-from-task-5>`
3. Enable the job

**Step 2: VERIFY GATE — Check cron hits arriving**

Use Railway MCP `get-logs` with `logType: deploy` for linkie-claw service, `filter: "cron"` or `filter: "publish-scheduled"`, `lines: 10`.

Wait 2-3 minutes, then check. Expected: Log entries showing the cron endpoint was hit.

---

### Task 11: End-to-End Smoke Test

**Step 1: Create a test post**

In the app at `https://app.linkyai.dev`:
1. Sign in
2. Create a new post with any content
3. Schedule it for 2 minutes from now

**Step 2: Watch the pipeline**

1. Check Railway logs for linkie-claw: cron picks up the scheduled post
2. Check n8n execution history: workflow receives the webhook
3. Check LinkedIn: post appears on your profile
4. Check the app: post status updates to "published"

**Step 3: VERIFY GATE — Full pipeline works**

- [ ] Post created and scheduled in app
- [ ] Cron detects the scheduled post
- [ ] n8n workflow executes
- [ ] Post appears on LinkedIn
- [ ] App shows "published" status

---

### Task 12: Cleanup and Documentation

**Step 1: Delete temporary files**

```bash
rm -f n8n-cookies.txt
```

**Step 2: Update MEMORY.md with new deployment state**

Update the Railway Deployment section with:
- New project name and service IDs
- Confirmed working state
- Custom domains
- Cron service details

**Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "docs: update deployment state after clean Railway redeployment"
git push origin main
```

---

## Task Dependency Chain

```
Task 1 (code cleanup) → Task 2 (delete old project) → Task 3 (create project)
  → Task 4 (PostgreSQL) → Task 5 (generate secrets)
    → Task 6 (linkie-claw) + Task 7 (OAuth URIs) → Task 8 (n8n)
      → Task 9 (n8n setup) → Task 10 (cron) → Task 11 (smoke test)
        → Task 12 (cleanup)
```

Tasks are strictly sequential. Each depends on the previous one's VERIFY GATE passing.

---

## Manual vs Automated Steps

| Task | Execution | Who |
|------|-----------|-----|
| 1. Code cleanup | Automated | Agent |
| 2. Delete old project | **MANUAL** | User (dashboard) |
| 3. Create project | Automated | Agent (Railway MCP) |
| 4. PostgreSQL | Automated | Agent (Railway MCP template) |
| 5. Generate secrets | Automated | Agent (bash) |
| 6. linkie-claw deploy | Mixed | Agent (env vars, deploy) + User (custom domain DNS) |
| 7. OAuth URIs | **MANUAL** | User (Google/GitHub consoles) |
| 8. n8n deploy | Mixed | Agent (env vars, deploy) + User (custom domain DNS, root dir) |
| 9. n8n post-setup | Mixed | Agent (API calls) + User (LinkedIn OAuth in n8n UI) |
| 10. Cron setup | **MANUAL** | User (cron-job.org) |
| 11. Smoke test | **MANUAL** | User (browser testing) |
| 12. Cleanup | Automated | Agent |
