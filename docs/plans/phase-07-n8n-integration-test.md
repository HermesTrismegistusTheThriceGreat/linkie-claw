# Phase 7 Handover: n8n Integration Test

## What Was Built (Phase 7 — Node.js Scheduler)

The Python FastAPI + APScheduler service was replaced with a single Next.js cron endpoint. The entire publishing pipeline now runs inside the Next.js app.

### New Files

| File | Purpose |
|------|---------|
| `src/app/api/cron/publish-scheduled/route.ts` | Cron endpoint — polls DB for due posts, dispatches to n8n |
| `src/scripts/dev-scheduler.ts` | Dev script — calls cron endpoint every 60s |

### Modified Files

| File | What Changed |
|------|-------------|
| `src/lib/db/queries.ts` | Added `reschedulePostForRetry()` and `resetStalePost()` (global scheduler queries) |
| `src/app/api/posts/[id]/schedule/route.ts` | Removed Python scheduler import/call, added `retry_count: 0` |
| `src/app/api/posts/[id]/unschedule/route.ts` | Removed Python scheduler import/call, added `retry_count: 0` |
| `src/app/api/posts/recover/route.ts` | Removed Python scheduler import/call, simplified retry logic |
| `src/app/api/webhooks/publish-status/route.ts` | Added `retry_count: 0` on successful publish |
| `src/middleware.ts` | Exempted `/api/cron` and `/api/webhooks` from session auth (they use their own secrets) |
| `src/scripts/dev-scheduler.ts` | Added `.env.local` loader (script runs outside Next.js) |
| `package.json` | Added `"scheduler:dev"` npm script |

### Deleted / Archived

| Item | Action |
|------|--------|
| `src/lib/api/scheduler.ts` | Deleted (Python scheduler HTTP client) |
| `scheduler/` | Archived to `scheduler.archived/` |

---

## Test Results (Scheduler Only — No n8n)

All scheduler mechanics verified:

- **Auth**: Bad secret returns 401, valid secret returns 200
- **Post discovery**: Finds all `scheduled` posts where `scheduled_at < now` and `retry_count < 3`
- **Retry lifecycle**: `retry_count` increments correctly (0 → 1 → 2 → failed)
- **Exponential backoff**: 2min → 4min → 8min delays between retries
- **Max retries**: Posts marked `failed` with descriptive error message after 3 attempts
- **Error capture**: Error messages stored in DB (`"n8n webhook returned 404"`, `"User LinkedIn not connected..."`)
- **Stale recovery**: Posts stuck in `publishing` > 5 minutes are reset to `scheduled`

---

## What Needs Testing Next: n8n Integration

### The Full Publishing Flow

```
Scheduler (cron) → n8n webhook → LinkedIn API → n8n callback → App webhook
```

1. **Cron finds due post** → marks it `publishing` → POSTs to n8n
2. **n8n receives the webhook** → uses LinkedIn OAuth to publish the post
3. **n8n calls back** → `POST /api/webhooks/publish-status` with result
4. **App updates post** → `published` (with LinkedIn URN) or `failed` (with error)

### Services Required

| Service | URL | How to Start |
|---------|-----|-------------|
| Next.js app | `http://localhost:3000` | `npm run dev` |
| Dev scheduler | (calls cron every 60s) | `npm run scheduler:dev` (separate terminal) |
| n8n | `http://localhost:5678` | Start n8n instance, import workflow |

### Environment Variables (already in `.env.local`)

```
# Scheduler auth
CRON_SECRET=sTNYUMVrhREvUV+AAwnVnOn8vOgHaeHsOX5MeUwK4ys=

# n8n outgoing webhook (scheduler POSTs here)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/linkedin

# n8n incoming callback (n8n POSTs back here)
N8N_CALLBACK_SECRET=sTNYUMVrhREvUV+AAwnVnOn8vOgHaeHsOX5MeUwK4ys=
```

### Critical: n8n Webhook URL Mismatch Warning

There is a **known discrepancy** documented in `.env`:

> The n8n workflow (`n8n/workflows/linkedin-publish.json`) uses webhook path `/linkedin-post` but `.env.local` says `/linkedin`. Verify which path the imported n8n workflow actually exposes in the n8n UI and update `.env.local` to match.

**Action required**: After importing the workflow into n8n, check the Webhook node's path in the n8n UI and ensure `N8N_WEBHOOK_URL` matches exactly. Do NOT modify the n8n workflow — update the env var instead.

### What the Cron Sends to n8n

The cron endpoint POSTs this JSON to `N8N_WEBHOOK_URL`:

```json
{
  "postId": "string (cuid2)",
  "userId": "string",
  "personUrn": "string (from userSettings.linkedin_person_urn)",
  "content": "string (post text)",
  "imageUrl": "string | null"
}
```

### What n8n Should Call Back

After publishing (or failing), n8n POSTs to `http://localhost:3000/api/webhooks/publish-status`:

**Headers:**
```
x-webhook-secret: {N8N_CALLBACK_SECRET value}
Content-Type: application/json
```

**Success body:**
```json
{
  "postId": "string",
  "status": "published",
  "linkedinPostUrn": "string (e.g., urn:li:share:12345)"
}
```

**Failure body:**
```json
{
  "postId": "string",
  "status": "failed",
  "error": "string or object describing the error"
}
```

### Webhook Endpoint Behavior

- **Auth**: `x-webhook-secret` header must match `N8N_CALLBACK_SECRET` (timing-safe comparison)
- **Idempotent**: Duplicate callbacks for same state return 200 OK
- **State validation**: Only `publishing → published/failed` transitions allowed; rejects others with 409
- **On success**: Sets `status: "published"`, stores `linkedin_post_urn`, sets `published_at`, resets `retry_count: 0`
- **On failure**: Sets `status: "failed"`, stores `error_message`
- **Middleware**: `/api/webhooks` is exempt from session auth (uses its own secret)

### LinkedIn OAuth Prerequisites

For n8n to actually publish to LinkedIn, the user's `userSettings` must have:

- `linkedin_connected = 1` (boolean stored as integer in SQLite)
- `linkedin_person_urn` (e.g., `urn:li:person:abc123`)
- `linkedin_access_token` (encrypted, used by n8n workflow)

If these aren't set, the cron endpoint will fail with: `"User LinkedIn not connected or missing person URN"` — the post won't even reach n8n.

### DB State After Previous Test

The scheduler test ran all 4 past-due posts through the full retry cycle. They are now in `failed` state. To test the n8n flow, you'll need posts in `scheduled` state with `scheduled_at` in the past (or near future). Options:

1. **Schedule a new post via the UI** — set time a few minutes from now
2. **Reset existing posts via Drizzle Studio** — `npm run db:studio`, change status back to `scheduled` and set `retry_count: 0`
3. **Use the recovery endpoint** — `POST /api/posts/recover` with `action: "retry"` (resets to scheduled)

### n8n Workflow

The workflow file is at `n8n/workflows/linkedin-publish.json`. Per CLAUDE.md:

> **Never modify the workflow nodes or logic.** If LinkedIn posting fails, it is a credentials/environment issue — not a code bug.

Import it into n8n via the UI. The workflow expects the incoming webhook payload shape documented above.

---

## Post Status State Machine

```
draft → scheduled (user schedules via UI)
scheduled → publishing (cron picks up, marks publishing)
publishing → published (n8n callback: success)
publishing → failed (n8n callback: failure, or max retries)
publishing → scheduled (stale recovery after 5min, or manual retry)
scheduled → draft (user unschedules)
failed → scheduled (user retries via recovery endpoint)
```

---

## Validation Checklist for n8n Integration Test

- [ ] n8n instance running at `http://localhost:5678`
- [ ] LinkedIn publish workflow imported and active
- [ ] Webhook URL in n8n matches `N8N_WEBHOOK_URL` in `.env.local`
- [ ] n8n has the callback URL configured: `http://localhost:3000/api/webhooks/publish-status`
- [ ] n8n has `N8N_CALLBACK_SECRET` configured to match `.env.local`
- [ ] User has LinkedIn OAuth connected (check Settings page or `userSettings` table)
- [ ] Test post exists in `scheduled` state with `scheduled_at` in the past
- [ ] `npm run dev` running
- [ ] `npm run scheduler:dev` running
- [ ] Scheduler picks up post → sends to n8n → n8n publishes → callback received → post marked `published`
- [ ] Post `linkedin_post_urn` is populated after successful publish
- [ ] Failed publish scenario: n8n callback with `status: "failed"` correctly marks post
