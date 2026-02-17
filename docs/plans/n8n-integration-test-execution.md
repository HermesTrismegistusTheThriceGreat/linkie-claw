# Plan: n8n Integration Test Execution

## Goal
Run a full end-to-end publishing test: schedule a post in the app, have the cron pick it up, n8n publish it to LinkedIn, and verify the callback updates the post status.

## Pre-Conditions (Already Done)
- [x] Webhook URL fixed in `.env.local` (`/webhook/linkedin-post`)
- [x] Internal posts endpoint created (`/api/internal/posts/[id]`) with bearer token auth
- [x] Middleware updated to exempt `/api/internal`
- [x] TypeScript typecheck passing
- [x] n8n container running (`scheduler-n8n-1`, port 5678)
- [x] Docker→host networking confirmed (`host.docker.internal` resolves)

## Architecture Reminder
```
Cron (/api/cron/publish-scheduled)
  → Finds due posts in DB (status=scheduled, scheduled_at <= now, retry_count < 3)
  → Marks post as 'publishing'
  → POSTs to N8N_WEBHOOK_URL with {postId, userId, personUrn, content, imageUrl}

n8n Workflow (linkedin-publish.json)
  → Receives webhook
  → Fetches full post from /api/internal/posts/{postId} (with bearer auth)
  → Gets real person URN from LinkedIn API (using n8n's own OAuth credential)
  → If image: validates → initializes upload → downloads → uploads binary → creates post with image
  → If no image: creates text-only post
  → Calls back to /api/webhooks/publish-status with {postId, status, linkedinPostUrn}

App Webhook (/api/webhooks/publish-status)
  → Validates x-webhook-secret header (timing-safe)
  → Updates post: published (with URN) or failed (with error)
```

---

## Phase 1: n8n Container Restart (Agent Task)

### Problem
`N8N_CALLBACK_SECRET` is empty in the running container. The callback auth will fail.

### Actions
1. Create a `.env` file in `scheduler.archived/` with the correct environment variables:
   ```
   N8N_CALLBACK_SECRET=sTNYUMVrhREvUV+AAwnVnOn8vOgHaeHsOX5MeUwK4ys=
   N8N_ENCRYPTION_KEY=generate-a-random-string-here
   ```
   Keep the same `N8N_ENCRYPTION_KEY` to preserve any existing credentials in the n8n database.

2. Restart ONLY the n8n container (not the old Python scheduler or Postgres):
   ```bash
   cd scheduler.archived && docker compose up -d n8n
   ```

3. Verify the env var is set:
   ```bash
   docker exec scheduler-n8n-1 env | grep N8N_CALLBACK_SECRET
   ```
   Expected: `N8N_CALLBACK_SECRET=sTNYUMVrhREvUV+AAwnVnOn8vOgHaeHsOX5MeUwK4ys=`

### Validation
- n8n is reachable at http://localhost:5678
- `N8N_CALLBACK_SECRET` is non-empty in the container

---

## Phase 2: n8n UI Configuration (User — Manual Steps)

### 2a. Verify/Import Workflow
1. Open http://localhost:5678 in browser
2. Log in (or set up owner account if first time on this machine)
3. Check if "LinkedIn Post Publisher" workflow exists
4. If NOT: Import from `n8n/workflows/linkedin-publish.json`
   - Click "Add workflow" → "Import from file" → select the JSON

### 2b. Configure LinkedIn OAuth2 Credential
1. Go to **Credentials** in n8n sidebar
2. Check if "LinkedIn OAuth2" credential exists
3. If NOT, create it:
   - Type: "LinkedIn OAuth2 API"
   - Client ID: `<YOUR_LINKEDIN_CLIENT_ID>` (from `.env.local`)
   - Client Secret: `<YOUR_LINKEDIN_CLIENT_SECRET>` (from `.env.local`)
   - Scopes: `openid profile email w_member_social`
   - **Complete the OAuth flow** — sign in with your LinkedIn account
4. If it EXISTS, test the credential to verify the tokens are still valid

### 2c. Update "Fetch Post" Node (Option B — Internal Auth)
1. Open the "LinkedIn Post Publisher" workflow
2. Click the **"HTTP Request - Fetch Post"** node
3. Change the URL from:
   ```
   http://host.docker.internal:3000/api/posts/{{ $json.body.postId }}
   ```
   to:
   ```
   http://host.docker.internal:3000/api/internal/posts/{{ $json.body.postId }}
   ```
4. Enable **"Send Headers"**
5. Add a header:
   - Name: `Authorization`
   - Value: `Bearer sTNYUMVrhREvUV+AAwnVnOn8vOgHaeHsOX5MeUwK4ys=`
6. Save the node

### 2d. Activate the Workflow
1. Toggle the workflow to **Active** (top-right switch)
2. Verify the webhook is registered — the webhook URL should be:
   `http://localhost:5678/webhook/linkedin-post`

### Validation
- Workflow shows as "Active" in the workflows list
- LinkedIn OAuth2 credential tests successfully
- Fetch Post node URL points to `/api/internal/posts/...` with auth header

---

## Phase 3: App Preparation (Agent Task)

### 3a. Verify Build
```bash
npm run typecheck && npm run build
```

### 3b. Reset a Test Post
The DB has 2 scheduled posts (Feb 15 and Feb 16) and 5 failed posts. Options:
- **Option A**: Use one of the existing scheduled posts (they're due Feb 15-16, so the cron will pick them up on/after those dates, or we reschedule one to now)
- **Option B**: Reset a failed post back to scheduled with a near-future `scheduled_at`
- **Option C**: Create a fresh test post via the DB

Best approach: Reset one failed post to `scheduled` status with `scheduled_at` = 2 minutes from now and `retry_count = 0`. Use a short, identifiable test content like "Integration test post - [timestamp]" so it's easy to find on LinkedIn and delete afterward.

```sql
UPDATE posts
SET status = 'scheduled',
    retry_count = 0,
    scheduled_at = strftime('%s', 'now') + 120,
    error_message = NULL
WHERE id = '<pick-a-failed-post-id>'
```

### 3c. Start Services
Terminal 1:
```bash
npm run dev
```

Terminal 2 (separate):
```bash
npm run scheduler:dev
```

### Validation
- Dev server running on http://localhost:3000
- Scheduler running and calling cron endpoint every 60s
- Test post exists with status `scheduled` and `scheduled_at` in the near future

---

## Phase 4: Execute Test (Mixed — Agent Monitors, User Observes)

### What to Watch

**Terminal 1 (Next.js):**
- `[info] Cron job triggered: publish-scheduled` — scheduler is calling
- `[info] Post dispatched to n8n` — post was sent to n8n webhook
- `[info] Received publish status callback` — n8n called back
- `[info] Post status updated via webhook` — success!

**Terminal 2 (Scheduler):**
- `Cron response: { processed: 1, failed: 0, total: 1, recovered: 0 }` — post was picked up

**n8n UI (http://localhost:5678):**
- Go to "Executions" tab on the workflow
- Should see an execution with all nodes green (success) or red (failure)
- Click into the execution to see data at each step

**LinkedIn:**
- Check your LinkedIn profile/feed for the test post
- Delete it after confirming it appeared

### Possible Failure Points

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Cron says `processed: 0` | No posts due yet, or `scheduled_at` is in the future | Check post `scheduled_at` vs current time |
| Cron says `User LinkedIn not connected` | `linkedin_connected` or `linkedin_person_urn` not set for the post's user | Update `user_settings` in DB |
| n8n returns 404 | Webhook URL mismatch | Verify `N8N_WEBHOOK_URL` matches n8n's actual webhook path |
| n8n Fetch Post fails | URL or auth header wrong | Check the node config in n8n UI |
| n8n LinkedIn API error | OAuth token expired or invalid | Re-authenticate in n8n Credentials |
| Callback returns 401 | `N8N_CALLBACK_SECRET` mismatch | Compare container env vs `.env.local` |
| Post stays in `publishing` | n8n execution failed or callback didn't fire | Check n8n execution logs |

### Agent Monitoring Tasks
1. Watch the Next.js server logs for cron activity
2. Query the DB periodically to track post status changes
3. If post transitions to `failed`, read the `error_message` column for details
4. If post stays in `publishing` > 2 minutes, check stale recovery logic

---

## Phase 5: Post-Test Verification (Agent Task)

### Success Criteria
- [ ] Post status changed from `scheduled` → `publishing` → `published`
- [ ] `linkedin_post_urn` is populated (e.g., `urn:li:share:12345`)
- [ ] `published_at` timestamp is set
- [ ] `retry_count` is 0
- [ ] Post is visible on LinkedIn
- [ ] n8n execution shows all green nodes

### Failure Documentation
If the test fails, capture:
1. Post status and `error_message` from DB
2. n8n execution log (which node failed, what error)
3. Next.js server log output around the failure time
4. Exact error messages for troubleshooting

---

## Phase 6: Cleanup (User)
1. Delete the test post from LinkedIn (if it published)
2. Optionally reset the test post in DB back to `draft`
3. Stop the dev scheduler (Ctrl+C in terminal 2)

---

## Agent Team Structure

| Agent | Type | Responsibilities |
|-------|------|-----------------|
| **infra** | general-purpose | Phase 1 (container restart + env verification), Phase 3a (build check) |
| **test-prep** | general-purpose | Phase 3b (test post preparation), Phase 3c (start services), Phase 4 (monitoring), Phase 5 (verification) |

**User handles:** Phase 2 (all n8n UI steps), Phase 6 (cleanup)

### Contract: infra → test-prep
infra must confirm n8n is running with correct env vars BEFORE test-prep starts services and monitoring.

### Contract: User → test-prep
User must confirm Phase 2 is complete (workflow active, credentials valid, Fetch Post updated) BEFORE test-prep starts the scheduler.

---

## Key Environment Variables Reference

| Variable | Value | Where |
|----------|-------|-------|
| `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/linkedin-post` | `.env.local` |
| `N8N_CALLBACK_SECRET` | `sTNYUMVrhREvUV+AAwnVnOn8vOgHaeHsOX5MeUwK4ys=` | `.env.local` AND n8n container env |
| `CRON_SECRET` | `sTNYUMVrhREvUV+AAwnVnOn8vOgHaeHsOX5MeUwK4ys=` | `.env.local` (used by internal endpoint + scheduler) |

Note: `CRON_SECRET` and `N8N_CALLBACK_SECRET` currently share the same value. For production, these should be different secrets.
