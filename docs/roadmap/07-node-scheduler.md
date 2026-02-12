# Phase 7: Node.js Scheduler — Replace Python with DB Polling

## Goal
Replace the Python FastAPI + APScheduler service with a single Node.js API route that polls the database for posts ready to publish. Eliminate the entire Python/Docker scheduler infrastructure.

## Done When
Posts are reliably published at their scheduled time via a cron-triggered API route that queries the database every 60 seconds. No Python service, no Docker, no thread pool crashes.

## Depends On
Phase 3 (Multi-User Support) — posts need user_id for per-user token lookup

---

## Background

The current Python scheduler (`scheduler/` directory) is a FastAPI service using APScheduler with a PostgreSQL job store. It crashes after approximately 3 hours due to:
- Thread pool exhaustion
- HTTP client resource leaks
- In-memory retry counter bloat

The scheduler's job is simple: at a scheduled time, POST to an n8n webhook with the post ID and user's LinkedIn token. The Next.js app already has all the database queries needed: `getPostsReadyToPublish()`, `markPostAsPublishing()`, `markPostAsPublished()`, `markPostAsFailed()`.

> **IMPORTANT — n8n Workflow is Off-Limits:** This phase replaces the **Python scheduling mechanism** only. The n8n workflow itself (`n8n/workflows/linkedin-publish.json`) is a working, production-tested system and **must not be modified**. The new Node.js cron route simply POSTs to the same n8n webhook that the Python scheduler used to call. If the n8n webhook doesn't respond or posting fails, it's a credentials/setup issue — troubleshoot with the user (see `docs/roadmap/00-overview.md` for the checklist) rather than modifying n8n.

---

## Architecture

```
Cron trigger (every 60 seconds)
  → GET /api/cron/publish-scheduled (protected by CRON_SECRET)
    → Query: posts WHERE status='scheduled' AND scheduled_at <= now
    → Process posts in parallel (with concurrency limit):
      → Update status to 'publishing'
      → POST to n8n webhook with {postId, accessToken, personUrn, content, imageUrl}
      → On success: POST callback will mark as 'published'
      → On failure: increment retry_count, reschedule with exponential backoff
        - Retry 1: +2 minutes
        - Retry 2: +4 minutes
        - Retry 3: +8 minutes
      → On max retries (3): mark as 'failed' with error message
```

### Post Status State Machine

No posts can fall through the cracks — every status transition is deterministic:

```
draft → scheduled (user schedules)
scheduled → publishing (cron picks up)
publishing → published (n8n callback success)
publishing → scheduled (retry: cron stale recovery or n8n failure with retries remaining)
publishing → failed (n8n callback failure OR max retries exceeded)
scheduled → draft (user unschedules)
failed → scheduled (manual retry via recover endpoint)
```

---

## Step-by-Step Plan

### 7.1 — Database Schema

The `retry_count` column on the posts table is defined in Phase 1 (Database Schema Foundation). This phase implements the scheduler logic that uses it.

**Note:** The retry_count column and user_id column on posts are available from Phase 1.

---

### 7.2 — Create `/api/cron/publish-scheduled` Route

Create `src/app/api/cron/publish-scheduled/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getPostsReadyToPublish, updatePost } from "@/lib/db/queries";
import { getUserSettings } from "@/lib/db/queries/settings";
import { log } from "@/lib/logger";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2 * 60 * 1000; // 2 minutes (base delay for exponential backoff)
const MAX_BATCH_SIZE = 10; // Process up to 10 posts per cycle

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log("info", "Cron job triggered: publish-scheduled");

  const postsToPublish = await getPostsReadyToPublish();
  const batch = postsToPublish.slice(0, MAX_BATCH_SIZE);

  // Process posts in parallel with Promise.allSettled
  const results = await Promise.allSettled(
    batch.map(async (post) => {
      try {
        // Update status to 'publishing'
        await updatePost(post.id, { status: "publishing" });

        // Get user's LinkedIn credentials
        const settings = await getUserSettings(post.user_id);
        if (!settings || !settings.linkedin_connected) {
          throw new Error("User LinkedIn not connected");
        }

        // POST to n8n webhook
        const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL!, {
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
          throw new Error(`n8n webhook failed: ${n8nResponse.status}`);
        }

        log("info", "Post dispatched to n8n", { postId: post.id });
        return { postId: post.id, success: true };
      } catch (error) {
        log("error", "Failed to publish post", { postId: post.id, error });

        // Handle retry logic with exponential backoff
        const newRetryCount = (post.retry_count || 0) + 1;

        if (newRetryCount >= MAX_RETRIES) {
          // Max retries reached, mark as failed
          await updatePost(post.id, {
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          });
          log("error", "Post marked as failed after max retries", {
            postId: post.id,
          });
        } else {
          // Exponential backoff: 2min, 4min, 8min
          const delayMs = RETRY_DELAY_MS * Math.pow(2, post.retry_count || 0);
          const newScheduledAt = new Date(Date.now() + delayMs);
          await updatePost(post.id, {
            status: "scheduled",
            retry_count: newRetryCount,
            scheduled_at: newScheduledAt,
          });
          log("info", "Post rescheduled for retry", {
            postId: post.id,
            retryCount: newRetryCount,
            delayMinutes: delayMs / 60000,
            newScheduledAt,
          });
        }

        return { postId: post.id, success: false };
      }
    })
  );

  const processed = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
  const failed = results.filter((r) => r.status === "fulfilled" && !r.value.success).length;

  return NextResponse.json({
    processed,
    failed,
    total: batch.length,
  });
}
```

**Note on concurrency:** Initial volume is very low (1-3 posts per user per day, not back-to-back), so parallel processing with a batch size of 10 is a forward-looking improvement. This approach prevents timeout issues on serverless platforms (deployment platform TBD — Vercel Hobby: 10s timeout, Vercel Pro: 60s timeout) and follows best practices even on traditional servers.

---

### 7.3 — Create Catch-up Logic for Stale 'Publishing' Posts

Add a query to find posts stuck in 'publishing' state for more than 5 minutes (from a crashed previous run):

#### 7.3.1 — Update `src/lib/db/queries.ts`

```typescript
/**
 * Get posts stuck in 'publishing' state for more than 5 minutes.
 * These are posts that failed to complete due to a crashed scheduler run.
 *
 * Note: The manual recovery UI endpoint (/api/posts/recover) uses a separate
 * 1-hour threshold for user-facing recovery, which is intentionally different
 * to avoid showing users posts that are actively being processed.
 */
export async function getStalePublishingPosts() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return db
    .select()
    .from(posts)
    .where(
      and(eq(posts.status, "publishing"), lt(posts.updated_at, fiveMinutesAgo))
    )
    .orderBy(posts.scheduled_at);
}
```

#### 7.3.2 — Update cron route to recover stale posts

Add this to the cron route before processing ready posts:

```typescript
// Recover stale 'publishing' posts
const stalePosts = await getStalePublishingPosts();
for (const post of stalePosts) {
  log("warn", "Recovering stale publishing post", { postId: post.id });
  await updatePost(post.id, { status: "scheduled" }); // Reset to scheduled
}
```

---

### 7.4 — Set Up Local Development Cron

#### 7.4.1 — Create dev scheduler script

Create `src/scripts/dev-scheduler.ts`:

```typescript
/**
 * Development scheduler: calls the cron endpoint every 60 seconds.
 * Run with: npm run scheduler:dev
 */

const CRON_SECRET = process.env.CRON_SECRET || "dev-secret";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const INTERVAL_MS = 60 * 1000; // 60 seconds

async function tick() {
  try {
    console.log(`[${new Date().toISOString()}] Triggering cron job...`);
    const response = await fetch(`${APP_URL}/api/cron/publish-scheduled`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const result = await response.json();
    console.log(`Result:`, result);
  } catch (error) {
    console.error("Cron job failed:", error);
  }
}

console.log(`Starting dev scheduler (${INTERVAL_MS}ms interval)...`);
setInterval(tick, INTERVAL_MS);
tick(); // Run immediately on start
```

#### 7.4.2 — Add npm script

In `package.json`:
```json
{
  "scripts": {
    "scheduler:dev": "tsx src/scripts/dev-scheduler.ts"
  }
}
```

**Note on deployment flexibility:** The dev scheduler script works universally across all deployment platforms. This is useful for:
- **Local development** (covered here)
- **Self-hosted deployments** (run as a background service instead of relying on OS-level cron)
- **Railway/Render/other platforms** (run as a background worker if the platform doesn't have built-in cron support)
- See section 7.9 for platform-specific cron configuration options

---

### 7.5 — Update Schedule/Unschedule API Routes

Remove calls to the Python scheduler HTTP client. Scheduling now just means setting `status='scheduled'` and `scheduled_at` in the database — the cron route picks it up.

**Changes required:**
- Remove the `scheduleWithScheduler()` call from the existing `src/app/api/posts/[id]/schedule/route.ts`
- Remove the `scheduleWithScheduler()` call from the existing `src/app/api/posts/[id]/recover/route.ts`
- Delete `src/lib/api/scheduler.ts` entirely (Python scheduler HTTP client)
- Update the recover route to no longer need the scheduler — recovery just resets status to 'scheduled' and the cron picks it up

#### 7.5.1 — Update `src/app/api/posts/[id]/schedule/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getPostById, updatePost } from "@/lib/db/queries";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  const { id } = await context.params;
  const body = await request.json();
  const scheduledAt = new Date(body.scheduledAt);

  // Verify post belongs to user
  const post = await getPostById(id);
  if (!post || post.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update post to scheduled status
  await updatePost(id, {
    status: "scheduled",
    scheduled_at: scheduledAt,
    retry_count: 0, // Reset retry count
  });

  return NextResponse.json({ status: "scheduled", scheduledAt });
}
```

#### 7.5.2 — Update `src/app/api/posts/[id]/unschedule/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getPostById, updatePost } from "@/lib/db/queries";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  const { id } = await context.params;

  const post = await getPostById(id);
  if (!post || post.user_id !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await updatePost(id, {
    status: "draft",
    scheduled_at: null,
    retry_count: 0,
  });

  return NextResponse.json({ status: "unscheduled" });
}
```

---

### 7.6 — Delete or Archive Python Scheduler

#### 7.6.1 — Archive the scheduler directory

```bash
mv scheduler scheduler.archived
```

Or delete entirely:
```bash
rm -rf scheduler
```

#### 7.6.2 — Remove `src/lib/api/scheduler.ts`

```bash
rm src/lib/api/scheduler.ts
```

#### 7.6.3 — Update any imports that reference the scheduler

Search for imports of `src/lib/api/scheduler.ts` and remove them:
```bash
grep -r "from.*@/lib/api/scheduler" src/
```

---

### 7.7 — Add Environment Variables

#### 7.7.1 — Update `.env.local`

```bash
CRON_SECRET=your-random-secret-here
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/publish-linkedin
```

#### 7.7.2 — Add to Vercel environment variables

In Vercel dashboard:
- `CRON_SECRET` (generate a random string, e.g., via `openssl rand -hex 32`)
- `N8N_WEBHOOK_URL` (already exists)

---

### 7.8 — Update n8n Webhook Callback

The n8n webhook should call back to `/api/webhooks/publish-status` to mark posts as published or failed. Update this endpoint to also reset `retry_count` to 0 on success.

#### 7.8.1 — Update `src/app/api/webhooks/publish-status/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { markPostAsPublished, markPostAsFailed } from "@/lib/db/queries";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { postId, status, linkedinPostUrn, errorMessage } = body;

  if (status === "published") {
    await markPostAsPublished(postId, linkedinPostUrn);
    // Reset retry_count on success
    await updatePost(postId, { retry_count: 0 });
    log("info", "Post published successfully", { postId, linkedinPostUrn });
  } else if (status === "failed") {
    await markPostAsFailed(postId, errorMessage);
    log("error", "Post publish failed", { postId, errorMessage });
  }

  return NextResponse.json({ received: true });
}
```

---

### 7.9 — Configure Cron Job (Deployment-Agnostic)

The deployment platform is TBD. Here are the options for different platforms:

#### Option 1: Vercel Cron Jobs

Create `vercel.json` in the project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/publish-scheduled",
      "schedule": "* * * * *"
    }
  ]
}
```

This configures Vercel to call the endpoint every minute (cron syntax: `* * * * *`).

> **Note:** Vercel Cron is only available on Pro plans. For Hobby tier, use the dev scheduler script or a third-party cron service like cron-job.org to call the endpoint.

#### Option 2: Self-Hosted (Traditional Server)

Use the dev scheduler script as a background service:

```bash
# Run as a systemd service or PM2 process
npm run scheduler:dev
```

Or use OS-level cron:

```cron
* * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/publish-scheduled
```

#### Option 3: Railway / Render / Other Platforms

Check if your platform has built-in cron support:
- **Railway:** Use Railway Cron Jobs (if available) or run the dev scheduler as a background worker
- **Render:** Use Render Cron Jobs or run the dev scheduler as a background worker
- **Generic:** The dev scheduler script (`npm run scheduler:dev`) works universally as a long-running background process

The dev scheduler script (section 7.4) is the universal fallback that works on any platform.

---

## What Gets Eliminated

- `scheduler/` directory (Python, FastAPI, APScheduler, Dockerfile)
- `src/lib/api/scheduler.ts` (Python scheduler HTTP client — deleted entirely)
- `scheduleWithScheduler()` calls from schedule/recover routes
- Separate PostgreSQL instance for APScheduler job store
- Docker requirement for scheduler
- Thread pool / resource leak crashes
- Complex APScheduler configuration
- Separate scheduler service deployment

---

## Verification Checklist

- [ ] Schedule a post 2 minutes out → it publishes at the correct time
- [ ] Schedule a post, then unschedule → it does NOT publish
- [ ] Cron endpoint rejects requests without valid CRON_SECRET
- [ ] Failed n8n call → post retries with exponential backoff (2min, 4min, 8min)
- [ ] 3 failures → post marked as 'failed' with error message
- [ ] Stuck 'publishing' posts recovered after 5 minutes
- [ ] `npm run typecheck` passes with no errors
- [ ] Python scheduler directory can be safely removed
- [ ] `src/lib/api/scheduler.ts` removed entirely
- [ ] Schedule/unschedule routes no longer call Python scheduler
- [ ] Dev scheduler script works locally (`npm run scheduler:dev`)
- [ ] Multiple users can schedule posts independently
- [ ] Retry count resets to 0 on successful publish
- [ ] Posts with different scheduled times are dispatched correctly
- [ ] Parallel processing handles multiple posts correctly
- [ ] No crashes after running for 24+ hours
