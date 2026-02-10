# Phase 9: Scheduler Infrastructure — Reliable Post Dispatching

## Goal
Replace the current scheduler (which crashes after ~3 hours) with a persistent, production-grade solution that reliably dispatches posts to the n8n webhook at the exact scheduled time, 24/7.

## Done When
A user schedules a post for a future date/time, and it is reliably sent to the n8n webhook at that exact time with zero crashes or missed posts.

## Depends On
Phase 2 (multi-user — scheduler needs user context)

---

## Step-by-Step Plan

### 9.1 — Evaluate Scheduling Solutions

| Solution | Pros | Cons | Cost | Verdict |
|----------|------|------|------|---------|
| **Vercel Cron Jobs** | Zero infra, native integration, free tier | Max 1/minute precision, no dynamic scheduling, only cron expressions | Free (Hobby) / $20/mo (Pro) | ⚠️ Partial fit |
| **Upstash QStash** | At-least-once delivery, serverless, REST API, exact-time scheduling | External service dependency | Free tier (500 msgs/day) | ✅ **Best fit** |
| **Current FastAPI + APScheduler** | Already built, exact-time scheduling, PostgreSQL persistence | Crashes after ~3 hours, requires always-on server | VPS cost ($5-20/mo) | ❌ Unreliable |
| **GitHub Actions** | Free, scheduled workflows | 5-min minimum precision, not designed for this | Free | ❌ Too imprecise |
| **Database-driven queue + Vercel Cron** | No new service, uses existing DB | Polling-based, 1-min precision at best | Free | ⚠️ Acceptable |

### 9.2 — Recommended Architecture: Upstash QStash + Vercel Cron Fallback

**Primary:** Upstash QStash for exact-time post dispatching
**Fallback:** Vercel Cron Job (runs every minute) to catch any missed posts

```
┌──────────────────────────────────────────────────┐
│  User schedules a post for Feb 15, 2:30 PM UTC   │
│  1. POST /api/posts/{id}/schedule                 │
│  2. App creates a QStash scheduled message:       │
│     - Destination: /api/posts/dispatch             │
│     - Deliver at: 2025-02-15T14:30:00Z            │
│     - Body: { postId: "abc", userId: "xyz" }      │
│  3. QStash guarantees delivery at scheduled time   │
│  4. /api/posts/dispatch fetches token, calls n8n   │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Vercel Cron (every 5 minutes) — Safety net       │
│  1. GET /api/posts/recover                         │
│  2. Finds posts where scheduled_at < now           │
│     AND status = "scheduled"                       │
│  3. For each missed post, dispatches immediately   │
└──────────────────────────────────────────────────┘
```

---

### 9.3 — Implement QStash Integration

#### 9.3.1 — Install QStash SDK
```bash
npm install @upstash/qstash
```

#### 9.3.2 — Create QStash client
`src/lib/qstash.ts`:
```typescript
import { Client } from "@upstash/qstash";

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});
```

#### 9.3.3 — Update schedule endpoint
`src/app/api/posts/[id]/schedule/route.ts`:

```typescript
import { qstash } from "@/lib/qstash";

export async function POST(request: NextRequest, context: RouteContext) {
  const userId = await getAuthUserId();
  const { id } = await context.params;
  const body = await request.json();
  const scheduledAt = new Date(body.scheduledAt);
  
  // 1. Verify post belongs to user
  const post = await getPostById(id, userId);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  // 2. Schedule via QStash
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  const result = await qstash.publishJSON({
    url: `${appUrl}/api/posts/dispatch`,
    body: { postId: id, userId },
    notBefore: Math.floor(scheduledAt.getTime() / 1000), // Unix timestamp
    retries: 3,
    headers: {
      "x-internal-secret": process.env.INTERNAL_API_SECRET!,
    },
  });
  
  // 3. Update post status to "scheduled"
  await updatePost(id, {
    status: "scheduled",
    scheduled_at: scheduledAt,
  }, userId);
  
  // 4. Store QStash message ID for cancellation
  await updatePost(id, { qstash_message_id: result.messageId }, userId);
  
  return NextResponse.json({ status: "scheduled", messageId: result.messageId });
}
```

#### 9.3.4 — Create dispatch endpoint
`src/app/api/posts/dispatch/route.ts`:

This is the endpoint QStash calls at the scheduled time:

```typescript
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

async function handler(request: NextRequest) {
  const body = await request.json();
  const { postId, userId } = body;
  
  // 1. Get the post
  const post = await getPostById(postId, userId);
  if (!post || post.status !== "scheduled") {
    return NextResponse.json({ error: "Post not found or not scheduled" }, { status: 404 });
  }
  
  // 2. Get user's LinkedIn token
  const settings = await getUserSettings(userId);
  const accessToken = await getValidToken(userId);
  
  // 3. Mark as publishing
  await updatePost(postId, { status: "publishing" }, userId);
  
  // 4. Send to n8n
  const n8nResponse = await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postId,
      accessToken,
      personUrn: settings.linkedin_person_urn,
      content: post.content,
      imageUrl: post.image_url,
    }),
  });
  
  if (!n8nResponse.ok) {
    await updatePost(postId, { 
      status: "failed", 
      error_message: `n8n error: ${n8nResponse.status}` 
    }, userId);
    throw new Error(`n8n webhook failed: ${n8nResponse.status}`);
  }
  
  return NextResponse.json({ status: "dispatched" });
}

// Verify QStash signature to prevent unauthorized calls
export const POST = verifySignatureAppRouter(handler);
```

#### 9.3.5 — Update unschedule endpoint
`src/app/api/posts/[id]/unschedule/route.ts`:

```typescript
export async function POST(request: NextRequest, context: RouteContext) {
  const userId = await getAuthUserId();
  const { id } = await context.params;
  
  const post = await getPostById(id, userId);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  // Cancel QStash message
  if (post.qstash_message_id) {
    await qstash.messages.delete(post.qstash_message_id);
  }
  
  await updatePost(id, { status: "draft", scheduled_at: null, qstash_message_id: null }, userId);
  return NextResponse.json({ status: "unscheduled" });
}
```

---

### 9.4 — Add Vercel Cron Safety Net

#### 9.4.1 — Create recovery endpoint
`src/app/api/posts/recover/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (check authorization header)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Find all posts that should have been dispatched but are still "scheduled"
  const missedPosts = await getPostsReadyToPublish(); // scheduled_at < now AND status = "scheduled"
  
  let recovered = 0;
  for (const post of missedPosts) {
    try {
      // Dispatch immediately via QStash (instant delivery)
      await qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/posts/dispatch`,
        body: { postId: post.id, userId: post.user_id },
        headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET! },
      });
      recovered++;
    } catch (error) {
      console.error(`Failed to recover post ${post.id}:`, error);
    }
  }
  
  return NextResponse.json({ recovered, total: missedPosts.length });
}
```

#### 9.4.2 — Configure Vercel Cron
`vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/posts/recover",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

### 9.5 — Add `qstash_message_id` to Schema

Update `src/lib/db/schema.ts`:
```diff
 export const posts = pgTable("posts", {
   // ... existing columns ...
+  qstash_message_id: text("qstash_message_id"),
 });
```

---

### 9.6 — Retire the Python Scheduler

Once QStash is working in production:

1. The `scheduler/` directory becomes optional (keep for reference)
2. Remove `SCHEDULER_URL` from environment variables
3. Update `docker-compose.yml` to only run n8n (remove scheduler and postgres services)
4. Update README documentation

> **Do not delete the scheduler code immediately.** Keep it as a fallback during the transition period.

---

### 9.7 — Environment Variables

Add to Vercel:
```
QSTASH_TOKEN=<from Upstash dashboard>
QSTASH_CURRENT_SIGNING_KEY=<from Upstash dashboard>
QSTASH_NEXT_SIGNING_KEY=<from Upstash dashboard>
CRON_SECRET=<generate random string>
INTERNAL_API_SECRET=<generate random string>
```

---

## Verification Checklist

- [ ] Schedule a post for 2 minutes from now — it dispatches at the correct time
- [ ] Schedule a post for 1 hour from now — verify QStash message is created
- [ ] Unschedule a post — verify QStash message is cancelled
- [ ] Reschedule a post — old message cancelled, new one created
- [ ] Cron recovery job runs every 5 minutes and catches missed posts
- [ ] No crashes after running for 24+ hours
- [ ] Multiple users can schedule posts independently
- [ ] Dispatch endpoint is protected against unauthorized calls (QStash signature verification)
- [ ] Failed dispatches show error status in the UI (not silently lost)
- [ ] QStash message ID is stored in the database for each scheduled post
