# Phase 7: Node.js Scheduler — Agent Team Plan

Replace the Python FastAPI + APScheduler service with a Node.js cron route that polls the database for posts ready to publish. Eliminate all Python/Docker scheduler infrastructure.

## Overview

The current Python scheduler (`scheduler/` directory) crashes after ~3 hours due to thread pool exhaustion and resource leaks. The replacement is a single Next.js API route (`/api/cron/publish-scheduled`) triggered every 60 seconds that queries the DB for scheduled posts and dispatches them to the existing n8n webhook.

**CRITICAL: The n8n workflow (`n8n/workflows/linkedin-publish.json`) is OFF-LIMITS. Do not modify it.**

## Requirements Summary

- Cron route polls DB every 60s for posts where `status='scheduled' AND scheduled_at <= now`
- Posts dispatched to n8n webhook with user's LinkedIn credentials
- Exponential backoff retry (2min, 4min, 8min) with max 3 retries
- Stale `publishing` post recovery (stuck > 5 minutes)
- Dev scheduler script for local development
- Remove all Python scheduler code and dependencies
- Update schedule/unschedule/recover routes to remove Python scheduler calls

## Research Findings

### Existing Database Queries (Already Implemented)

The following scheduler queries **already exist** in `src/lib/db/queries.ts` (lines 152-259) and do NOT need to be created:

| Function | Line | Purpose |
|----------|------|---------|
| `getPostsReadyToPublish()` | 162 | `WHERE status='scheduled' AND scheduled_at < now AND retry_count < 3` |
| `getStalePublishingPosts()` | 181 | `WHERE status='publishing' AND updated_at < 5min ago AND retry_count < 3` |
| `incrementPostRetryCount(postId)` | 200 | SQL increment: `retry_count + 1` |
| `markPostAsPublishing(id)` | 215 | Sets `status='publishing'`, updates `updated_at` |
| `markPostAsPublished(id, urn)` | 229 | Sets `status='published'`, `linkedin_post_urn`, `published_at` |
| `markPostAsFailed(id, msg)` | 248 | Sets `status='failed'`, `error_message` |

**IMPORTANT**: All the above are **global queries** (no `user_id` filter) — designed for cross-user scheduler use.

### Missing Queries (Must Be Added)

The cron route needs to reset posts back to `scheduled` with a new `scheduled_at` (for retries/stale recovery). No existing query does this without `userId`. **Two new functions needed:**

```typescript
export async function reschedulePostForRetry(id: string, newScheduledAt: Date)
// Sets status='scheduled', scheduled_at=newScheduledAt, updated_at=now
// Global (no user filtering) — for cron/scheduler use only

export async function resetStalePost(id: string)
// Sets status='scheduled', updated_at=now
// Global (no user filtering) — for cron/scheduler use only
```

### updatePost() Requires userId

The existing `updatePost(id, data, userId)` function (line 53) filters by **both `id` AND `user_id`**. The cron route processes posts across all users, so it **cannot use `updatePost()`** for status transitions. It must use the dedicated scheduler query functions listed above plus the two new ones.

### Files That Import Python Scheduler (3 files)

1. `src/app/api/posts/[id]/schedule/route.ts:6` — `import { scheduleWithScheduler }`
2. `src/app/api/posts/[id]/unschedule/route.ts:5` — `import { cancelSchedule }`
3. `src/app/api/posts/recover/route.ts:6` — `import { scheduleWithScheduler }`

### Post Status State Machine

```
draft → scheduled          (user schedules via API)
scheduled → publishing     (cron picks up)
publishing → published     (n8n callback success)
publishing → scheduled     (retry with backoff — retries remaining)
publishing → failed        (n8n callback failure OR max retries exceeded)
scheduled → draft          (user unschedules)
failed → scheduled         (manual retry via /api/posts/recover)
```

### n8n Webhook Contract

**Outgoing (cron → n8n):**
- URL: `process.env.N8N_WEBHOOK_URL`
- Method: POST
- Headers: `Content-Type: application/json`
- Body: `{ postId, userId, personUrn, content, imageUrl }`

**Incoming callback (n8n → app):**
- Endpoint: `POST /api/webhooks/publish-status`
- Auth: `x-webhook-secret` header (validated with `timingSafeEqual` against `N8N_CALLBACK_SECRET`)
- Body: `{ postId, status: "published"|"failed", linkedinPostUrn?, error?, callbackId? }`
- State machine enforced: only `publishing → published/failed` allowed

### Environment Variables

| Variable | Status | Purpose |
|----------|--------|---------|
| `CRON_SECRET` | **Need to generate** | Protects cron endpoint (run `openssl rand -hex 32`) |
| `N8N_WEBHOOK_URL` | **Already exists** in `.env` | n8n webhook URL for publishing |
| `N8N_CALLBACK_SECRET` | **Already exists** in `.env` | Webhook callback signature |
| `SCHEDULER_URL` | **Will be removed** | Only used in `src/lib/api/scheduler.ts` (being deleted) |

## Agent Build Order & Communication

### Contract Chain

```
Scheduler Builder → publishes DB query signatures + cron route contract → Route Migrator
```

The Scheduler Builder is upstream because it creates two new query functions in `queries.ts`. The Route Migrator needs to know these exist but doesn't call them directly — only the cron route does.

Both agents can work **mostly in parallel** since they own different files. Scheduler Builder should publish its contract first.

### Agent Roles (2 Agents)

#### Agent 1: Scheduler Builder
**Owns (creates):**
- `src/app/api/cron/publish-scheduled/route.ts` (NEW)
- `src/scripts/dev-scheduler.ts` (NEW)

**Owns (modifies):**
- `src/lib/db/queries.ts` — add `reschedulePostForRetry()` and `resetStalePost()` only

**Does NOT touch:**
- `src/app/api/posts/[id]/schedule/route.ts`
- `src/app/api/posts/[id]/unschedule/route.ts`
- `src/app/api/posts/recover/route.ts`
- `src/app/api/webhooks/publish-status/route.ts`
- `src/lib/api/scheduler.ts`
- `scheduler/` directory
- `package.json`

**Responsibilities:**
1. Add `reschedulePostForRetry(id, newScheduledAt)` and `resetStalePost(id)` to `src/lib/db/queries.ts`
2. Create the cron endpoint with: CRON_SECRET auth, stale recovery, batch processing, exponential backoff retry
3. Create dev scheduler script for local development

#### Agent 2: Route Migrator
**Owns (modifies):**
- `src/app/api/posts/[id]/schedule/route.ts` — remove scheduler import + call + rollback logic
- `src/app/api/posts/[id]/unschedule/route.ts` — remove scheduler import + call
- `src/app/api/posts/recover/route.ts` — remove scheduler import + call + rollback logic
- `src/app/api/webhooks/publish-status/route.ts` — add retry_count reset on success
- `package.json` — add `scheduler:dev` npm script

**Owns (deletes):**
- `src/lib/api/scheduler.ts` (DELETE)

**Owns (archives):**
- `scheduler/` directory → `scheduler.archived/`

**Does NOT touch:**
- `src/app/api/cron/` (Agent 1 territory)
- `src/scripts/dev-scheduler.ts` (Agent 1 territory)
- `src/lib/db/queries.ts` (Agent 1 territory)

**Responsibilities:**
1. Simplify schedule route to DB-only (remove lines 6, 87-111)
2. Simplify unschedule route to DB-only (remove lines 5, 56-68)
3. Simplify recover route to DB-only (remove lines 6, 158-180)
4. Add `retry_count: 0` reset in webhook route on successful publish
5. Delete `src/lib/api/scheduler.ts`
6. Archive `scheduler/` directory
7. Remove all `@/lib/api/scheduler` imports
8. Add `"scheduler:dev": "npx tsx src/scripts/dev-scheduler.ts"` to package.json scripts

### Cross-Cutting Concerns

| Concern | Owner | Detail |
|---------|-------|--------|
| Post status state machine | Both | Must follow exact transitions. Retries: `publishing → scheduled`. Max retries: `publishing → failed`. |
| `retry_count` column | Both | Scheduler Builder increments in cron route. Route Migrator resets to 0 in schedule route, recover retry action, and webhook success. |
| `CRON_SECRET` env var | Scheduler Builder | Used by cron route (Agent 1) and dev scheduler script (Agent 1). Agent 2 adds the npm script that runs the dev scheduler. |
| n8n payload shape | Scheduler Builder | Cron → n8n: `{postId, userId, personUrn, content, imageUrl}`. n8n → webhook: `{postId, status, linkedinPostUrn, error}`. Different endpoints, different shapes. |

## Implementation Tasks

### Phase 1: Contracts (Sequential — Scheduler Builder first)

**Scheduler Builder publishes:**

1. **New query: `reschedulePostForRetry`**
   ```typescript
   export async function reschedulePostForRetry(id: string, newScheduledAt: Date): Promise<Post | null>
   // Sets status='scheduled', scheduled_at=newScheduledAt, updated_at=now
   // Global query (no user_id filter) — scheduler use only
   ```

2. **New query: `resetStalePost`**
   ```typescript
   export async function resetStalePost(id: string): Promise<Post | null>
   // Sets status='scheduled', updated_at=now
   // Global query (no user_id filter) — scheduler use only
   ```

3. **Cron route contract**
   ```
   GET /api/cron/publish-scheduled
   Auth: Authorization: Bearer {CRON_SECRET}
   Response: { processed: number, failed: number, total: number, recovered: number }
   Side effects:
     1. Recover stale 'publishing' posts → resetStalePost()
     2. Query getPostsReadyToPublish() → batch limit 10
     3. Per post: markPostAsPublishing() → fetch user settings → POST to N8N_WEBHOOK_URL
     4. On n8n failure + retries remaining: incrementPostRetryCount() → reschedulePostForRetry()
     5. On n8n failure + max retries (3): markPostAsFailed()
   ```

4. **Dev scheduler contract**
   ```
   npm run scheduler:dev
   Calls GET /api/cron/publish-scheduled every 60s with Bearer CRON_SECRET
   Reads CRON_SECRET and NEXT_PUBLIC_APP_URL from env
   ```

### Phase 2: Implementation (Parallel)

Both agents build their files in parallel after contracts are published.

---

**Scheduler Builder Tasks:**

#### Task 1: Add new query functions to `src/lib/db/queries.ts`

Add after line 205 (after `incrementPostRetryCount`), before the "Post Status Update Queries" section comment:

```typescript
/**
 * Reschedule a post for retry with exponential backoff.
 * Global query (no user filtering) — for cron/scheduler use only.
 * @param id - The post ID
 * @param newScheduledAt - The new scheduled time (with backoff applied)
 */
export async function reschedulePostForRetry(id: string, newScheduledAt: Date) {
  const result = await db
    .update(posts)
    .set({
      status: "scheduled",
      scheduled_at: newScheduledAt,
      updated_at: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();
  return result[0] ?? null;
}

/**
 * Reset a stale 'publishing' post back to 'scheduled'.
 * Global query (no user filtering) — for cron/scheduler use only.
 * @param id - The post ID
 */
export async function resetStalePost(id: string) {
  const result = await db
    .update(posts)
    .set({
      status: "scheduled",
      updated_at: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();
  return result[0] ?? null;
}
```

- **File**: `src/lib/db/queries.ts`
- **Location**: After `incrementPostRetryCount()` (line 205), before line 207
- **Dependencies**: Uses existing `db`, `posts`, `eq` imports (already in file)

#### Task 2: Create `src/app/api/cron/publish-scheduled/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  getPostsReadyToPublish,
  getStalePublishingPosts,
  getUserSettings,
  markPostAsPublishing,
  markPostAsFailed,
  incrementPostRetryCount,
  reschedulePostForRetry,
  resetStalePost,
} from "@/lib/db/queries";
import { log } from "@/lib/logger";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2 * 60 * 1000; // 2 minutes
const MAX_BATCH_SIZE = 10;

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = crypto.randomUUID();
  log("info", "Cron job triggered: publish-scheduled", { requestId });

  // Step 1: Recover stale 'publishing' posts (stuck > 5 min)
  const stalePosts = await getStalePublishingPosts();
  for (const post of stalePosts) {
    log("warn", "Recovering stale publishing post", {
      requestId,
      postId: post.id,
      userId: post.user_id,
    });
    await resetStalePost(post.id);
  }

  // Step 2: Get posts ready to publish
  const postsToPublish = await getPostsReadyToPublish();
  const batch = postsToPublish.slice(0, MAX_BATCH_SIZE);

  if (batch.length === 0) {
    return NextResponse.json({
      processed: 0,
      failed: 0,
      total: 0,
      recovered: stalePosts.length,
    });
  }

  // Step 3: Process posts in parallel
  const results = await Promise.allSettled(
    batch.map(async (post) => {
      try {
        // Set status to 'publishing'
        await markPostAsPublishing(post.id);

        // Get user's LinkedIn credentials
        const settings = await getUserSettings(post.user_id);
        if (!settings?.linkedin_connected || !settings.linkedin_person_urn) {
          throw new Error("User LinkedIn not connected or missing person URN");
        }

        // POST to n8n webhook
        const n8nUrl = process.env.N8N_WEBHOOK_URL;
        if (!n8nUrl) {
          throw new Error("N8N_WEBHOOK_URL not configured");
        }

        const n8nResponse = await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: post.id,
            userId: post.user_id,
            personUrn: settings.linkedin_person_urn,
            content: post.content,
            imageUrl: post.image_url,
          }),
        });

        if (!n8nResponse.ok) {
          throw new Error(`n8n webhook returned ${n8nResponse.status}`);
        }

        log("info", "Post dispatched to n8n", {
          requestId,
          postId: post.id,
          userId: post.user_id,
        });
        return { postId: post.id, success: true };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        log("error", "Failed to dispatch post to n8n", {
          requestId,
          postId: post.id,
          userId: post.user_id,
          error: errorMsg,
        });

        // Retry logic with exponential backoff
        const currentRetries = post.retry_count ?? 0;
        const newRetryCount = currentRetries + 1;

        if (newRetryCount >= MAX_RETRIES) {
          await markPostAsFailed(post.id, errorMsg);
          log("error", "Post marked as failed after max retries", {
            requestId,
            postId: post.id,
            retryCount: newRetryCount,
          });
        } else {
          await incrementPostRetryCount(post.id);
          const delayMs = BASE_DELAY_MS * Math.pow(2, currentRetries);
          const newScheduledAt = new Date(Date.now() + delayMs);
          await reschedulePostForRetry(post.id, newScheduledAt);
          log("info", "Post rescheduled for retry", {
            requestId,
            postId: post.id,
            retryCount: newRetryCount,
            delayMinutes: delayMs / 60000,
            newScheduledAt: newScheduledAt.toISOString(),
          });
        }

        return { postId: post.id, success: false };
      }
    })
  );

  const processed = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;
  const failed = results.filter(
    (r) => r.status === "fulfilled" && !r.value.success
  ).length;

  log("info", "Cron job completed", {
    requestId,
    processed,
    failed,
    total: batch.length,
    recovered: stalePosts.length,
  });

  return NextResponse.json({
    processed,
    failed,
    total: batch.length,
    recovered: stalePosts.length,
  });
}
```

- **File**: `src/app/api/cron/publish-scheduled/route.ts` (NEW)
- **Dependencies**: Existing query functions + 2 new ones from Task 1

#### Task 3: Create `src/scripts/dev-scheduler.ts`

```typescript
/**
 * Development scheduler: calls the cron endpoint every 60 seconds.
 * Run with: npm run scheduler:dev
 */

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const INTERVAL_MS = 60 * 1000;

async function tick() {
  const timestamp = new Date().toISOString();
  try {
    console.log(
      `[${timestamp}] Triggering cron: ${APP_URL}/api/cron/publish-scheduled`
    );
    const response = await fetch(`${APP_URL}/api/cron/publish-scheduled`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const result = await response.json();
    console.log(`[${timestamp}] Result:`, JSON.stringify(result));
  } catch (error) {
    console.error(`[${timestamp}] Cron tick failed:`, error);
  }
}

console.log(`Dev scheduler started (interval: ${INTERVAL_MS / 1000}s)`);
console.log(`Target: ${APP_URL}/api/cron/publish-scheduled`);
tick(); // Immediate first tick
setInterval(tick, INTERVAL_MS);
```

- **File**: `src/scripts/dev-scheduler.ts` (NEW)
- **Dependencies**: None (standalone script, reads env vars)

---

**Route Migrator Tasks:**

#### Task 4: Simplify `src/app/api/posts/[id]/schedule/route.ts`

**Remove:**
- Line 6: `import { scheduleWithScheduler } from "@/lib/api/scheduler";`
- Lines 87-111: The entire Python scheduler integration block (try/catch with rollback)

**Add:**
- Reset `retry_count: 0` in the `updatePost()` call (line 78) to ensure clean state on reschedule

**Result:** The route becomes: validate auth → check post exists → validate status → validate future time → `updatePost({ status: 'scheduled', scheduled_at, retry_count: 0 })` → return mapped post. The cron picks it up later.

#### Task 5: Simplify `src/app/api/posts/[id]/unschedule/route.ts`

**Remove:**
- Line 5: `import { cancelSchedule } from "@/lib/api/scheduler";`
- Lines 56-68: The Python scheduler cancellation block

**Add:**
- Reset `retry_count: 0` in the `updatePost()` call (line 47) to clean up state

**Result:** The route becomes: validate auth → check post exists → validate status is 'scheduled' → `updatePost({ status: 'draft', scheduled_at: null, retry_count: 0 })` → return mapped post.

#### Task 6: Simplify `src/app/api/posts/recover/route.ts`

**Remove:**
- Line 6: `import { scheduleWithScheduler } from "@/lib/api/scheduler";`
- Lines 158-180: The Python scheduler registration block with rollback logic

**Modify:**
- The retry action (lines 150-155) should just update the post to `status: 'scheduled'` with `scheduled_at: new Date()` and `retry_count: 0`. The cron will pick it up. No scheduler call needed.

**Result:** On retry: `updatePost({ status: 'scheduled', scheduled_at: new Date(), retry_count: 0 })`. On fail: `updatePost({ status: 'failed', error_message: '...' })`. No scheduler interaction.

#### Task 7: Update `src/app/api/webhooks/publish-status/route.ts`

**Add** `retry_count: 0` in the `status === "published"` branch (around line 145-149):

**Current (lines 145-149):**
```typescript
updated = await updatePost(postId, {
  status: "published",
  linkedin_post_urn: linkedinPostUrn ?? null,
  published_at: new Date(),
}, userId);
```

**Updated:**
```typescript
updated = await updatePost(postId, {
  status: "published",
  linkedin_post_urn: linkedinPostUrn ?? null,
  published_at: new Date(),
  retry_count: 0,
}, userId);
```

#### Task 8: Delete `src/lib/api/scheduler.ts`

Delete the entire file. This is the Python scheduler HTTP client with `scheduleWithScheduler()`, `cancelSchedule()`, and `reschedule()`.

#### Task 9: Remove all `@/lib/api/scheduler` imports

After Task 8, verify no remaining imports. Expected locations (all handled by Tasks 4-6):
- `src/app/api/posts/[id]/schedule/route.ts`
- `src/app/api/posts/[id]/unschedule/route.ts`
- `src/app/api/posts/recover/route.ts`

Verify with: `grep -r "from.*@/lib/api/scheduler" src/` → should return nothing.

#### Task 10: Archive `scheduler/` directory

```bash
mv scheduler scheduler.archived
```

This preserves the Python code as reference without it being part of the active project.

#### Task 11: Add `scheduler:dev` npm script to `package.json`

Add to the `scripts` section:
```json
"scheduler:dev": "npx tsx src/scripts/dev-scheduler.ts"
```

Note: `tsx` is NOT a direct dependency, so use `npx tsx` (same pattern as `db:seed` script).

### Phase 3: Contract Verification (Lead)

Before declaring complete, the lead verifies:

1. **No broken imports**: `grep -r "from.*@/lib/api/scheduler" src/` returns nothing
2. **TypeScript compiles**: `npm run typecheck` passes
3. **Lint clean**: `npm run lint:fix` passes
4. **Build succeeds**: `npm run build` passes
5. **State machine consistency**: Both agents' code follows exact same transitions
6. **retry_count handling**: Reset on schedule (Task 4), reset on unschedule (Task 5), reset on recover retry (Task 6), reset on publish success (Task 7), incremented on cron failure (Task 2)
7. **Cron route uses correct queries**: Uses existing `getPostsReadyToPublish`, `getStalePublishingPosts`, `markPostAsPublishing`, `markPostAsFailed`, `incrementPostRetryCount` + new `reschedulePostForRetry`, `resetStalePost`
8. **Dev scheduler works**: `npm run scheduler:dev` starts and ticks every 60s

## Existing Files to Read First

Both agents **MUST read these** before building:

| File | Why |
|------|-----|
| `src/lib/db/schema.ts` | Posts table schema: status enum, retry_count, scheduled_at, updated_at |
| `src/lib/db/queries.ts` | **All scheduler queries already exist** (lines 152-259). Agent 1 adds 2 new functions here. |
| `src/lib/logger.ts` | Logging pattern: `log(level, message, context)` |
| `src/lib/auth.ts` | Auth pattern for user-facing routes |
| `src/app/api/posts/[id]/schedule/route.ts` | Current schedule implementation (Agent 2 modifies) |
| `src/app/api/posts/[id]/unschedule/route.ts` | Current unschedule implementation (Agent 2 modifies) |
| `src/app/api/posts/recover/route.ts` | Current recover implementation (Agent 2 modifies) |
| `src/app/api/webhooks/publish-status/route.ts` | Current webhook implementation (Agent 2 modifies) |
| `src/lib/api/scheduler.ts` | Python scheduler client to be deleted (Agent 2 deletes) |

## Files Summary

### New Files (2)
| File | Owner | Purpose |
|------|-------|---------|
| `src/app/api/cron/publish-scheduled/route.ts` | Scheduler Builder | Main cron endpoint |
| `src/scripts/dev-scheduler.ts` | Scheduler Builder | Local dev cron trigger |

### Modified Files (6)
| File | Owner | Change |
|------|-------|--------|
| `src/lib/db/queries.ts` | Scheduler Builder | Add `reschedulePostForRetry()` and `resetStalePost()` |
| `src/app/api/posts/[id]/schedule/route.ts` | Route Migrator | Remove scheduler import + call + rollback (lines 6, 87-111), add retry_count reset |
| `src/app/api/posts/[id]/unschedule/route.ts` | Route Migrator | Remove scheduler import + call (lines 5, 56-68), add retry_count reset |
| `src/app/api/posts/recover/route.ts` | Route Migrator | Remove scheduler import + call + rollback (lines 6, 158-180), simplify retry to DB-only |
| `src/app/api/webhooks/publish-status/route.ts` | Route Migrator | Add `retry_count: 0` on publish success (line 148) |
| `package.json` | Route Migrator | Add `"scheduler:dev"` script |

### Deleted Files (1)
| File | Owner | Reason |
|------|-------|--------|
| `src/lib/api/scheduler.ts` | Route Migrator | Python scheduler HTTP client no longer needed |

### Archived Directories (1)
| Directory | Owner | Action |
|-----------|-------|--------|
| `scheduler/` → `scheduler.archived/` | Route Migrator | Preserve Python code as reference |

## Environment Variables

```bash
# NEW — generate and add to .env.local:
CRON_SECRET=<run: openssl rand -hex 32>

# EXISTING — already in .env, no changes needed:
N8N_WEBHOOK_URL=<already set>
N8N_CALLBACK_SECRET=<already set>

# REMOVED — no longer referenced after src/lib/api/scheduler.ts is deleted:
# SCHEDULER_URL (was defaulting to http://localhost:8000)
```

## Validation

### Scheduler Builder Validation
```bash
# TypeScript compiles
npm run typecheck

# Cron route rejects unauthorized requests
curl -s http://localhost:3000/api/cron/publish-scheduled
# Expected: 401 {"error":"Unauthorized"}

# Cron route accepts valid secret
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/publish-scheduled
# Expected: {"processed":0,"failed":0,"total":0,"recovered":0}

# Dev scheduler starts and ticks
npm run scheduler:dev
# Expected: Logs tick every 60 seconds with results
```

### Route Migrator Validation
```bash
# TypeScript compiles (no broken imports)
npm run typecheck

# No references to deleted scheduler
grep -r "from.*@/lib/api/scheduler" src/
# Expected: No results

# Lint passes
npm run lint:fix

# Build succeeds
npm run build
```

### End-to-End Validation (Lead)
1. Generate `CRON_SECRET`: `openssl rand -hex 32` → add to `.env.local`
2. Start dev server: `npm run dev`
3. Start dev scheduler: `npm run scheduler:dev`
4. Create a post via the studio UI
5. Schedule it 2 minutes in the future
6. Watch cron logs — should pick up the post after `scheduled_at` passes
7. Verify post status transitions: `scheduled → publishing`
8. If n8n is running: verify `published` status callback and `retry_count` reset to 0
9. If n8n is NOT running: verify retry logic:
   - Post goes back to `scheduled` with incremented `retry_count`
   - `scheduled_at` moves forward (2min, 4min, 8min backoff)
   - After 3 failures → post marked as `failed`
10. Test unschedule: schedule a post → unschedule → verify it does NOT publish
11. Test recover: manually set a post to `publishing` status → use recover endpoint → verify it reschedules
12. Run full validation: `npm run typecheck && npm run lint:fix && npm run build`

## Success Criteria

- [ ] Cron route processes scheduled posts at the correct time
- [ ] CRON_SECRET authentication works (rejects without, accepts with)
- [ ] Exponential backoff retry works (2min, 4min, 8min delays)
- [ ] Max retries (3) → post marked as 'failed' with error message
- [ ] Stale 'publishing' posts recovered after 5 minutes
- [ ] Schedule route works without Python scheduler (DB-only)
- [ ] Unschedule route works without Python scheduler (DB-only)
- [ ] Recover route works without Python scheduler (DB-only)
- [ ] Webhook callback resets retry_count to 0 on success
- [ ] `src/lib/api/scheduler.ts` deleted
- [ ] `scheduler/` directory archived
- [ ] No broken imports anywhere in codebase
- [ ] `npm run typecheck` passes
- [ ] `npm run lint:fix` passes
- [ ] `npm run build` passes
- [ ] Dev scheduler script works locally (`npm run scheduler:dev`)
- [ ] Multiple users can schedule posts independently

## What Gets Eliminated

- `scheduler/` directory (Python, FastAPI, APScheduler, Dockerfile, docker-compose)
- `src/lib/api/scheduler.ts` (Python scheduler HTTP client)
- `scheduleWithScheduler()` calls from schedule/recover routes
- `cancelSchedule()` call from unschedule route
- Separate PostgreSQL instance for APScheduler job store
- Docker requirement for scheduler
- Thread pool / resource leak crashes
- `SCHEDULER_URL` environment variable
