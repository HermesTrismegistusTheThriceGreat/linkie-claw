# Best Practices: Scheduled Database Polling → External Webhooks (Node.js/Next.js)

**Application Context:** LinkedIn post scheduler with n8n integration (SQLite/PostgreSQL)

This guide provides concrete, production-grade best practices for the specific pattern of:
- Scheduled database polling (every 60s) to find due posts
- Firing them to an external service (n8n)
- Handling callbacks with retry logic and recovery

---

## 1. RETRY STRATEGIES

### 1.1 Exponential Backoff vs Fixed Delay

**Recommendation: Use exponential backoff with jitter for webhook failures, fixed delay for scheduled polling.**

#### For Webhook Retries (n8n callback failures)
Use **exponential backoff with jitter** when retrying failed webhook deliveries:

```typescript
// src/lib/api/webhook-retry.ts
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,      // 1 second
  maxDelayMs: 300000,        // 5 minutes
  jitter: true,
};

export function calculateBackoffDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Exponential: 1s, 2s, 4s, 8s, 16s, 32s... capped at 5m
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(2, attemptNumber),
    config.maxDelayMs
  );

  // Add jitter: ±10% to avoid thundering herd
  if (config.jitter) {
    const jitterRange = exponentialDelay * 0.1;
    const jitter = Math.random() * jitterRange * 2 - jitterRange;
    return Math.max(0, exponentialDelay + jitter);
  }

  return exponentialDelay;
}

// Timeline: 1s → 2s → 4s → 8s → 16s → 32s (total: 63s of retries)
// With jitter, thundering herd effects are prevented
```

**Why exponential backoff?**
- Handles transient failures (network blips, rate limiting)
- Reduces server load on external service
- Prevents retry storms when service is temporarily down
- Standard practice for distributed systems (AWS, Google Cloud, etc.)

**Why jitter?**
- Prevents multiple clients from retrying simultaneously
- Reduces spike load on recovering service
- Industry standard (RFC 8555)

---

### 1.2 Max Retries & Retry State Storage

**Recommendation: Max 5 retries, retry state in same DB row, separate table for audit trail.**

#### Current Implementation (Good!)
Your schema already has:
```typescript
// src/lib/db/schema.ts
retry_count: integer("retry_count").notNull().default(0),
error_message: text("error_message"),
```

#### Storage Strategy: Same Row + Audit Trail

**Use same DB row for:**
- Current retry count (for state machine)
- Error message (latest error)
- Status (draft → scheduled → publishing → published/failed)

**Use separate table for:**
- Full audit trail (for debugging/analytics)
- All retry attempts (timestamps, error details)

```typescript
// src/lib/db/schema.ts - Add audit table

export const postPublishingAudit = sqliteTable(
  "post_publishing_audit",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    post_id: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    attempt_number: integer("attempt_number").notNull(),
    status: text("status", {
      enum: ["queued", "sent", "success", "failed", "timeout"],
    }).notNull(),
    error_code: text("error_code"),
    error_message: text("error_message"),
    response_time_ms: integer("response_time_ms"),
    created_at: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    postIdIdx: index("audit_post_id_idx").on(table.post_id),
    statusIdx: index("audit_status_idx").on(table.status),
  })
);
```

#### Retry Lifecycle

```typescript
// src/lib/db/queries.ts

const MAX_RETRIES = 5;

export async function getPostsReadyToPublish() {
  const now = new Date();
  return db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        lt(posts.scheduled_at, now),
        lt(posts.retry_count, MAX_RETRIES)  // Don't retry if exceeded
      )
    )
    .orderBy(posts.scheduled_at);
}

/**
 * Increment retry count and log attempt to audit table
 */
export async function recordPublishAttempt(
  postId: string,
  attempt: "queued" | "sent" | "success" | "failed" | "timeout",
  errorCode?: string,
  errorMessage?: string,
  responseTimeMs?: number
) {
  // Record in audit trail
  await db.insert(postPublishingAudit).values({
    post_id: postId,
    attempt_number: (await getPostRetryCount(postId)) + 1,
    status: attempt,
    error_code: errorCode,
    error_message: errorMessage,
    response_time_ms: responseTimeMs,
  });

  // If failed, increment retry_count in main table
  if (attempt === "failed") {
    await db
      .update(posts)
      .set({
        retry_count: sql`${posts.retry_count} + 1`,
        error_message: errorMessage,
        updated_at: new Date(),
      })
      .where(eq(posts.id, postId));
  }
}

async function getPostRetryCount(postId: string): Promise<number> {
  const result = await db
    .select({ count: posts.retry_count })
    .from(posts)
    .where(eq(posts.id, postId));
  return result[0]?.count ?? 0;
}
```

#### Max Retries Decision Logic

```typescript
const MAX_RETRIES = 5;

// After 5 failed attempts (≈1 minute total with exponential backoff):
if (post.retry_count >= MAX_RETRIES) {
  // Don't attempt again, will be caught by stale job recovery
  // User can manually trigger recovery via UI
  await markPostAsFailed(
    postId,
    `Publishing failed after ${MAX_RETRIES} retries. Please check n8n logs.`
  );
}
```

**Why 5 retries?**
- Gives ~63 seconds of retry window (1+2+4+8+16+32s = 63s)
- Assumes cron runs every 60 seconds
- Balances between recovery and avoiding retry storms
- Allows time for transient failures to resolve

---

### 1.3 Retry State Transition Diagram

```
┌─────────────┐
│  scheduled  │ ← Post is due, ready to publish
└──────┬──────┘
       │ (cron finds it)
       ▼
┌─────────────────────┐
│    publishing       │ ← Marked as "publishing", webhook fired to n8n
│ retry_count = 0     │
└──────┬──────────────┘
       │
       ├─ Success (webhook callback) ──────────────────┐
       │                                              │
       │  ┌──────────────────────────────────────────┤
       │  ▼                                            │
       │ ┌──────────────┐                             │
       │ │  published   │                             │
       │ └──────────────┘                             │
       │                                              │
       ├─ Timeout (no callback after 5m) ────────────┤
       │                                              │
       │  ┌──────────────────────────────────────────┤
       │  ▼                                            │
       │ ┌──────────────┐    (stale job recovery)   │
       │ │  scheduled   │ ◄─ Auto-retry or fail      │
       │ │ retry_count=1│                            │
       │ └──────────────┘                            │
       │                                              │
       └──────────────────────────────────────────────►

Once published/failed, no further retries
```

---

## 2. STALE JOB RECOVERY

### 2.1 Detection Strategy: Timeout-Based (Not Heartbeat)

**Recommendation: Timeout-based detection using `updated_at` timestamp.**

Your current implementation is correct:

```typescript
// src/lib/db/queries.ts (existing)
export async function getStalePublishingPosts() {
  const fiveMinutesAgo = subMinutes(new Date(), 5);
  return db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "publishing"),
        lt(posts.updated_at, fiveMinutesAgo),
        lt(posts.retry_count, MAX_RETRIES)
      )
    )
    .orderBy(posts.scheduled_at);
}
```

**Why timeout-based over heartbeat?**

| Approach | Pros | Cons |
|----------|------|------|
| **Timeout** | Simple, no extra infra, works with n8n callbacks | Slight delay in detection (5m) |
| **Heartbeat** | Faster detection, real-time status | Extra DB writes, complex, overkill for this case |

**For LinkedIn scheduling:** 5-minute timeout is reasonable because:
- Posts are rarely time-critical (±5 minutes is acceptable)
- Reduces database load vs heartbeat approach
- Works well with 60-second cron interval

### 2.2 Recovery Implementation

Your current recovery endpoint is good:

```typescript
// src/app/api/posts/recover/route.ts (existing, enhance with automatic recovery)

export async function POST(request: NextRequest) {
  // ... validation ...

  if (action === "retry") {
    // Reset to scheduled so cron picks it up again
    const scheduledAt = new Date();
    await updatePost(postId, {
      status: "scheduled",
      scheduled_at: scheduledAt,
    }, userId);

    // Register with scheduler
    await scheduleWithScheduler(postId, scheduledAt.toISOString());
  } else if (action === "fail") {
    // Mark as failed permanently
    await updatePost(postId, {
      status: "failed",
      error_message: "Manual recovery: publishing timed out",
    }, userId);
  }
}
```

### 2.3 Automatic Stale Job Recovery (Optional Enhancement)

For production, consider a separate cron job that auto-recovers stale jobs:

```typescript
// src/app/api/cron/recover-stale-posts/route.ts (NEW)
import { getStalePublishingPosts, updatePost } from "@/lib/db/queries";
import { log } from "@/lib/logger";

/**
 * GET /api/cron/recover-stale-posts
 * Runs every 10 minutes to auto-recover stale publishing posts
 * Should be called by a cron service (Vercel Crons, Railway, etc.)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestId = crypto.randomUUID();

  try {
    const stalePost = await getStalePublishingPosts();

    for (const post of stalePosts) {
      log("warn", "Auto-recovering stale publishing post", {
        requestId,
        postId: post.id,
        staleSince: post.updated_at,
      });

      // Reset to scheduled so it gets retried
      await updatePost(post.id, {
        status: "scheduled",
        scheduled_at: new Date(),
      }, post.user_id);
    }

    log("info", "Stale job recovery complete", {
      requestId,
      recovered: stalePosts.length,
    });

    return NextResponse.json({
      success: true,
      recovered: stalePosts.length,
    });
  } catch (error) {
    log("error", "Stale job recovery failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Recovery failed" },
      { status: 500 }
    );
  }
}
```

**Configure cron:**
- **Vercel:** Use `vercel.json` with cron config
- **Railway/Docker:** Use cron service in docker-compose
- **Self-hosted:** Use system cron + curl

Example Railway/Docker:
```yaml
# docker-compose.yml
cron:
  image: node:20-alpine
  command: |
    sh -c "while true; do
      curl -H 'x-cron-secret: $CRON_SECRET' http://app:3000/api/cron/recover-stale-posts
      sleep 600
    done"
  environment:
    CRON_SECRET: ${CRON_SECRET}
```

---

## 3. CONCURRENCY CONTROL

### 3.1 The Problem

If cron fires every 60 seconds and a previous run takes 45 seconds:

```
T=0s   | Cron 1 fires, starts processing post A
T=30s  | Post A still publishing (waiting for n8n callback)
T=60s  | Cron 2 fires → finds same post A (still in "publishing")
       | Should Cron 2 process it again? NO!
```

### 3.2 Solution: Status Transition as Poor-Man's Lock

**Recommendation: Status transition (scheduled → publishing) is sufficient, SELECT FOR UPDATE is overkill.**

```typescript
// The status transition IS your lock!

// Atomic operation: only ONE cron can transition a post from
// "scheduled" to "publishing"
export async function getPostsReadyToPublish() {
  const now = new Date();

  // Only fetch posts in "scheduled" status
  // If Cron 2 also runs, it won't see post A (it's in "publishing")
  return db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),  // ← This is your lock!
        lt(posts.scheduled_at, now),
        lt(posts.retry_count, MAX_RETRIES)
      )
    )
    .orderBy(posts.scheduled_at);
}

// In cron handler:
// 1. Mark as "publishing" (atomic)
// 2. Fire webhook to n8n
// 3. Wait for callback (n8n will call POST /api/webhooks/publish-status)

async function processPost(post: Post) {
  // Step 1: Atomic transition to "publishing"
  const updated = await db
    .update(posts)
    .set({ status: "publishing", updated_at: new Date() })
    .where(
      and(
        eq(posts.id, post.id),
        eq(posts.status, "scheduled")  // ← Ensure still "scheduled"
      )
    )
    .returning();

  if (!updated[0]) {
    // Another cron already claimed this post
    log("info", "Post already being processed", { postId: post.id });
    return;
  }

  // Step 2: Fire to n8n
  try {
    await fireToN8n(post);
  } catch (error) {
    // If n8n fails immediately, reset to scheduled for retry
    await updatePost(post.id, {
      status: "scheduled",
      retry_count: sql`${posts.retry_count} + 1`,
    });
  }
}
```

### 3.3 When SELECT FOR UPDATE IS Needed

**Do NOT use SELECT FOR UPDATE** unless:
- You're modifying the same row in multiple queries within a transaction
- You need guaranteed exclusive access during a multi-step operation
- Your database is PostgreSQL and you need advisory locks

For this use case: **Status transition alone is sufficient.**

```typescript
// AVOID THIS (unnecessary complexity):
const [post] = await db
  .select()
  .from(posts)
  .where(eq(posts.id, postId))
  .limit(1)
  .for(sql`update`);  // ← Not needed!

// DO THIS (simple, effective):
const updated = await db
  .update(posts)
  .set({ status: "publishing" })
  .where(
    and(
      eq(posts.id, postId),
      eq(posts.status, "scheduled")  // ← Prevents re-processing
    )
  )
  .returning();
```

### 3.4 Concurrency Control Diagram

```
Cron Job 1                          Cron Job 2
├─ T=0s: Finds post A (scheduled)  │
├─ T=1s: Updates → publishing      │
│                                   ├─ T=60s: Finds posts
└─                                  │         (post A NOT here, it's publishing!)
                                    └─ Only finds posts still in "scheduled"

Result: NO duplicate processing
Mechanism: Status value acts as a distributed lock
Cost: Single WHERE clause condition (negligible)
```

---

## 4. CALLBACK HANDLING

### 4.1 Idempotency

**Current implementation (good!):**

```typescript
// src/app/api/webhooks/publish-status/route.ts (existing)

// Idempotency: if post already in target state with matching data, return 200
if (existingPost.status === status) {
  if (
    status === "published" &&
    existingPost.linkedin_post_urn === linkedinPostUrn
  ) {
    log("info", "Duplicate publish callback (idempotent)", {
      requestId,
      postId,
    });
    return NextResponse.json({ success: true });
  }
  if (status === "failed") {
    log("info", "Duplicate failure callback (idempotent)", {
      requestId,
      postId,
    });
    return NextResponse.json({ success: true });
  }
}
```

**Enhance with idempotency key:**

```typescript
// src/lib/db/schema.ts (enhance)
export const posts = sqliteTable("posts", {
  // ... existing fields ...
  webhook_idempotency_key: text("webhook_idempotency_key"),  // NEW
  published_at: integer("published_at", { mode: "timestamp" }),
});

// src/app/api/webhooks/publish-status/route.ts (enhance)
const publishStatusSchema = z.object({
  postId: z.string().min(1),
  status: z.enum(["published", "failed"]),
  linkedinPostUrn: z.string().min(1).optional(),
  error: z.union([z.string(), z.record(z.string(), z.unknown())])
    .optional()
    .transform((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : v)),
  callbackId: z.string().optional(),  // n8n-generated unique ID
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;

  if (
    !secret ||
    secret.length !== expectedSecret.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
  ) {
    log("warn", "Unauthorized webhook", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = publishStatusSchema.safeParse(body);

  if (!result.success) {
    log("warn", "Webhook validation failed", { requestId, errors: result.error.flatten() });
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const { postId, status, linkedinPostUrn, error, callbackId } = result.data;

  // Idempotency check #1: By callbackId
  if (callbackId) {
    const existing = await db
      .select()
      .from(posts)
      .where(eq(posts.webhook_idempotency_key, callbackId))
      .limit(1);

    if (existing[0]) {
      log("info", "Duplicate callback (by idempotency key)", {
        requestId,
        postId,
        callbackId,
      });
      return NextResponse.json({ success: true });
    }
  }

  // Idempotency check #2: By state
  const existingPost = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!existingPost[0]) {
    log("warn", "Callback for non-existent post", { requestId, postId });
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (existingPost[0].status === status) {
    if (
      status === "published" &&
      existingPost[0].linkedin_post_urn === linkedinPostUrn
    ) {
      return NextResponse.json({ success: true });
    }
  }

  // ... update post ...
  await updatePost(postId, {
    status,
    linkedin_post_urn: linkedinPostUrn ?? null,
    webhook_idempotency_key: callbackId ?? null,
  });
}
```

### 4.2 State Validation

**Current implementation (good!):**

```typescript
// src/app/api/webhooks/publish-status/route.ts (existing)

// Validate state transition: only publishing → published/failed is allowed
if (existingPost.status !== "publishing") {
  log("warn", "Invalid state transition", {
    requestId,
    postId,
    currentStatus: existingPost.status,
    requestedStatus: status,
  });
  return NextResponse.json(
    {
      error: "Invalid state transition",
      currentStatus: existingPost.status,
    },
    { status: 409 }
  );
}
```

**This is correct.** State machine:
- `scheduled` → `publishing` (only from cron)
- `publishing` → `published` or `failed` (only from webhook)
- No backwards transitions allowed

**Allowed transitions:**
```typescript
const VALID_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  draft: ["scheduled", "deleted"],
  scheduled: ["publishing", "draft"],
  publishing: ["published", "failed"],
  published: [],  // terminal state
  failed: ["scheduled"],  // user can manually retry
};

function isValidTransition(from: PostStatus, to: PostStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Use in validation
if (!isValidTransition(existingPost.status, status)) {
  return NextResponse.json({ error: "Invalid transition" }, { status: 409 });
}
```

### 4.3 Timeout Handling: Never Arrives

**Current approach: Manual recovery (good for MVP)**

Your UI lets users manually recover stale posts. For production, add automatic recovery:

```typescript
// src/app/api/cron/recover-stale-posts/route.ts (see Section 2.3)

// Runs every 10 minutes
// Automatically resets posts stuck in "publishing" > 5 minutes to "scheduled"
```

**For n8n:** Configure webhook retry behavior:

```json
{
  "webhook": {
    "url": "https://yourapp.com/api/webhooks/publish-status",
    "method": "POST",
    "retries": {
      "maxAttempts": 5,
      "backoffMultiplier": 2,
      "initialDelayMs": 1000
    },
    "timeout": 30000,
    "headers": {
      "x-webhook-secret": "${N8N_CALLBACK_SECRET}"
    }
  }
}
```

**Monitoring:** Alert if posts stuck in "publishing" > 30 minutes

```typescript
// src/app/api/cron/alert-stale-posts/route.ts

export async function GET(request: NextRequest) {
  // Get posts stuck > 30 minutes
  const thirtyMinutesAgo = subMinutes(new Date(), 30);
  const veryStale = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "publishing"),
        lt(posts.updated_at, thirtyMinutesAgo)
      )
    );

  if (veryStale.length > 0) {
    // Send alert to Slack/email/PagerDuty
    await sendAlert({
      title: "Critical: Posts stuck publishing",
      count: veryStale.length,
      postIds: veryStale.map(p => p.id),
    });

    log("error", "ALERT: Stale publishing posts", {
      count: veryStale.length,
      postIds: veryStale.map(p => p.id),
    });
  }

  return NextResponse.json({ checked: true });
}
```

---

## 5. SECURITY

### 5.1 Cron Endpoint Security

**Current setup (good):**

```typescript
// Verify cron secret (timing-safe comparison)
const secret = request.headers.get("x-cron-secret");
const expectedSecret = process.env.CRON_SECRET;

if (secret !== expectedSecret) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Enhance: Use timing-safe comparison**

```typescript
import { timingSafeEqual } from "crypto";

const secret = request.headers.get("x-cron-secret");
const expectedSecret = process.env.CRON_SECRET;

if (!expectedSecret) {
  throw new Error("CRON_SECRET not configured");
}

if (
  !secret ||
  secret.length !== expectedSecret.length ||
  !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**CRON_SECRET Generation:**

```bash
# Generate a strong random secret (32 bytes = 256 bits)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env.local
CRON_SECRET=a7f3d2e1c9b8a4f6e2d1c3b5a7f9e8d6c4b3a1f2e3d4c5b6a7f8e9d0c1b2a3
```

**Calling the cron endpoint securely:**

```typescript
// Railway/external cron service
curl -H "x-cron-secret: $CRON_SECRET" https://yourapp.com/api/cron/publish-scheduled

// Or via environment
curl -H "x-cron-secret: ${CRON_SECRET}" https://yourapp.com/api/cron/publish-scheduled
```

### 5.2 Webhook Callback Security

**Current implementation (excellent!):**

```typescript
// src/app/api/webhooks/publish-status/route.ts (existing)

const secret = request.headers.get("x-webhook-secret");
const expectedSecret = process.env.N8N_CALLBACK_SECRET;

if (
  !secret ||
  secret.length !== expectedSecret.length ||
  !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
) {
  log("warn", "Unauthorized webhook callback", { requestId });
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Enhancement: Add request signing (HMAC)**

For extra security (optional but recommended), sign requests:

```typescript
// src/lib/webhook-signing.ts
import crypto from "crypto";

export function signWebhook(
  payload: Record<string, unknown>,
  secret: string
): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest("hex");
}

export function verifyWebhookSignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhook(payload, secret);
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In webhook handler:
const signature = request.headers.get("x-webhook-signature");
const isValid = verifyWebhookSignature(body, signature, N8N_CALLBACK_SECRET);
```

**N8N Configuration for HMAC:**

```json
{
  "webhook": {
    "url": "https://yourapp.com/api/webhooks/publish-status",
    "headers": {
      "x-webhook-secret": "${N8N_CALLBACK_SECRET}",
      "x-webhook-signature": "${signature}"  // n8n can generate HMAC
    }
  }
}
```

### 5.3 Environment Variables

**Secure configuration:**

```bash
# .env.local (dev - gitignored)
CRON_SECRET=dev_secret_change_in_production
N8N_CALLBACK_SECRET=dev_webhook_secret_change_in_production

# .env.example (committed - shows structure only)
CRON_SECRET=your-secure-random-secret-here
N8N_CALLBACK_SECRET=your-webhook-secret-here
```

**Never:**
- Commit actual secrets
- Expose to client-side code
- Log the full secret
- Use defaults in production

### 5.4 Rate Limiting (Optional)

For production, add rate limiting to webhook endpoint:

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60s"),
});

// In webhook handler:
const { success } = await ratelimit.limit(postId);

if (!success) {
  log("warn", "Webhook rate limited", { postId });
  return NextResponse.json(
    { error: "Rate limited" },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
```

---

## 6. OBSERVABILITY

### 6.1 What to Log

**Your current logger is good, use it everywhere:**

```typescript
// src/lib/logger.ts (existing)
export function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  console.log(JSON.stringify(entry));
}
```

**Log every state change:**

```typescript
// Cron: Finding posts
log("info", "Polling for posts to publish", {
  requestId,
  foundCount: posts.length,
});

// Cron: Marking as publishing
log("info", "Post marked as publishing", {
  requestId,
  postId,
  scheduledAt: post.scheduled_at,
});

// Cron: Firing webhook
log("info", "Webhook fired to n8n", {
  requestId,
  postId,
  n8nUrl: N8N_WEBHOOK_URL,
  durationMs: endTime - startTime,
});

// Webhook: Received callback
log("info", "Received publish status callback", {
  requestId,
  postId,
  status: "published" | "failed",
  callbackDurationMs: Date.now() - post.updated_at.getTime(),
});

// Recovery: Detecting stale
log("warn", "Detected stale publishing post", {
  requestId,
  postId,
  staleFor: "5+ minutes",
  lastUpdate: post.updated_at,
});

// Recovery: Auto-recovering
log("info", "Auto-recovering stale post", {
  requestId,
  postId,
  action: "retry" | "fail",
});
```

### 6.2 Key Metrics to Track

**Create a metrics helper:**

```typescript
// src/lib/metrics.ts
interface PublishingMetrics {
  pollCount: number;
  postsFound: number;
  webhooksSent: number;
  webhooksSucceeded: number;
  webhooksFailed: number;
  callbacksReceived: number;
  staleJobsDetected: number;
  staleJobsRecovered: number;
}

export class MetricsCollector {
  private metrics: PublishingMetrics = {
    pollCount: 0,
    postsFound: 0,
    webhooksSent: 0,
    webhooksSucceeded: 0,
    webhooksFailed: 0,
    callbacksReceived: 0,
    staleJobsDetected: 0,
    staleJobsRecovered: 0,
  };

  recordPoll(postsFound: number) {
    this.metrics.pollCount++;
    this.metrics.postsFound += postsFound;
  }

  recordWebhookSent() {
    this.metrics.webhooksSent++;
  }

  recordWebhookSuccess() {
    this.metrics.webhooksSucceeded++;
  }

  recordWebhookFailure() {
    this.metrics.webhooksFailed++;
  }

  recordCallbackReceived() {
    this.metrics.callbacksReceived++;
  }

  recordStaleJobDetected() {
    this.metrics.staleJobsDetected++;
  }

  recordStaleJobRecovered() {
    this.metrics.staleJobsRecovered++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      webhookSuccessRate:
        this.metrics.webhooksSent > 0
          ? ((this.metrics.webhooksSucceeded / this.metrics.webhooksSent) * 100).toFixed(2) + "%"
          : "N/A",
      callbackReceivedRate:
        this.metrics.webhooksSent > 0
          ? ((this.metrics.callbacksReceived / this.metrics.webhooksSent) * 100).toFixed(2) + "%"
          : "N/A",
    };
  }
}

export const metrics = new MetricsCollector();
```

### 6.3 Alerting

**Set up alerts for these conditions:**

```typescript
// src/app/api/cron/alert-on-anomalies/route.ts

interface AlertCondition {
  name: string;
  check: () => Promise<boolean>;
  severity: "warning" | "critical";
}

const alertConditions: AlertCondition[] = [
  {
    name: "High webhook failure rate",
    check: async () => {
      const failed = await getPublishingFailureCount({ lastHours: 1 });
      return failed > 10;  // More than 10 failures in 1 hour
    },
    severity: "critical",
  },
  {
    name: "Posts stuck in publishing",
    check: async () => {
      const stale = await getStalePublishingPosts();
      return stale.length > 5;
    },
    severity: "warning",
  },
  {
    name: "Callback timeout rate too high",
    check: async () => {
      const sent = await getWebhooksSentCount({ lastHours: 1 });
      const received = await getCallbacksReceivedCount({ lastHours: 1 });
      const deliveryRate = received / sent;
      return deliveryRate < 0.8;  // Less than 80% delivered
    },
    severity: "critical",
  },
  {
    name: "N8N webhook endpoint unreachable",
    check: async () => {
      const response = await fetch(N8N_WEBHOOK_URL, { method: "HEAD" });
      return !response.ok;
    },
    severity: "critical",
  },
];

export async function GET(request: NextRequest) {
  const triggered: string[] = [];

  for (const condition of alertConditions) {
    const shouldAlert = await condition.check();
    if (shouldAlert) {
      triggered.push(condition.name);
      await sendAlert(condition.name, condition.severity);
    }
  }

  return NextResponse.json({
    checked: alertConditions.length,
    triggered: triggered.length,
    alerts: triggered,
  });
}

async function sendAlert(name: string, severity: string) {
  // Slack
  await fetch(process.env.SLACK_WEBHOOK_URL || "", {
    method: "POST",
    body: JSON.stringify({
      text: `${severity.toUpperCase()}: ${name}`,
      channel: "#alerts",
    }),
  });

  // Or email, PagerDuty, etc.
  log("warn", "ALERT triggered", { name, severity });
}
```

### 6.4 Dashboard Queries

**Add analytics for publishing pipeline:**

```typescript
// src/lib/db/queries.ts

export async function getPublishingMetrics(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await db
    .select({
      status: posts.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.user_id, userId),
        gte(posts.created_at, startDate),
        sql`${posts.status} IN ('scheduled', 'publishing', 'published', 'failed')`
      )
    )
    .groupBy(posts.status);

  const scheduled = stats.find(s => s.status === "scheduled")?.count ?? 0;
  const publishing = stats.find(s => s.status === "publishing")?.count ?? 0;
  const published = stats.find(s => s.status === "published")?.count ?? 0;
  const failed = stats.find(s => s.status === "failed")?.count ?? 0;

  return {
    scheduled,
    publishing,
    published,
    failed,
    successRate: published + failed > 0 ? (published / (published + failed)) * 100 : 0,
    avgRetries: await getAverageRetryCount(userId),
  };
}

export async function getAverageRetryCount(userId: string): Promise<number> {
  const result = await db
    .select({
      avg: sql<number>`AVG(${posts.retry_count})`,
    })
    .from(posts)
    .where(eq(posts.user_id, userId));

  return result[0]?.avg ?? 0;
}

export async function getCallbackLatency(userId: string, hours: number = 24): Promise<{
  avgMs: number;
  minMs: number;
  maxMs: number;
}> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const result = await db
    .select({
      avgLatency: sql<number>`AVG(EXTRACT(EPOCH FROM (${posts.published_at} - ${posts.updated_at})) * 1000)`,
      minLatency: sql<number>`MIN(EXTRACT(EPOCH FROM (${posts.published_at} - ${posts.updated_at})) * 1000)`,
      maxLatency: sql<number>`MAX(EXTRACT(EPOCH FROM (${posts.published_at} - ${posts.updated_at})) * 1000)`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.user_id, userId),
        eq(posts.status, "published"),
        gte(posts.published_at, cutoff)
      )
    );

  return {
    avgMs: result[0]?.avgLatency ?? 0,
    minMs: result[0]?.minLatency ?? 0,
    maxMs: result[0]?.maxLatency ?? 0,
  };
}
```

---

## 7. COMPLETE REFERENCE IMPLEMENTATION

### 7.1 Cron Endpoint

```typescript
// src/app/api/cron/publish-scheduled/route.ts

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getPostsReadyToPublish, markPostAsPublishing, recordPublishAttempt } from "@/lib/db/queries";
import { log } from "@/lib/logger";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

/**
 * GET /api/cron/publish-scheduled
 *
 * Polls database every 60 seconds for posts ready to publish.
 * Transitions: scheduled → publishing → (waiting for callback)
 *
 * Security: Requires x-cron-secret header
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // 1. Verify cron secret (timing-safe)
  const secret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    log("error", "CRON_SECRET not configured", { requestId });
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (
    !secret ||
    secret.length !== expectedSecret.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
  ) {
    log("warn", "Unauthorized cron request", { requestId, ip: request.ip });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    log("info", "Cron: Polling for posts ready to publish", { requestId });

    // 2. Find posts ready to publish
    const posts = await getPostsReadyToPublish();

    if (posts.length === 0) {
      log("info", "Cron: No posts ready to publish", { requestId });
      return NextResponse.json({
        success: true,
        processed: 0,
      });
    }

    log("info", "Cron: Found posts to process", {
      requestId,
      count: posts.length,
    });

    let processed = 0;
    let failed = 0;

    // 3. Process each post
    for (const post of posts) {
      try {
        // Mark as publishing (atomic status transition - prevents duplicate processing)
        const marked = await markPostAsPublishing(post.id);

        if (!marked) {
          log("info", "Post already being processed by another cron", {
            requestId,
            postId: post.id,
          });
          continue;
        }

        log("info", "Post marked as publishing", {
          requestId,
          postId: post.id,
          userId: post.user_id,
        });

        // Fire to n8n
        const fireStart = Date.now();
        const response = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: post.id,
            content: post.content,
            imageUrl: post.image_url,
            linkedinPersonUrn: post.user_id,  // TODO: get actual URN from settings
          }),
          signal: AbortSignal.timeout(10000),  // 10 second timeout
        });

        const fireDuration = Date.now() - fireStart;

        if (!response.ok) {
          throw new Error(`n8n returned ${response.status}`);
        }

        log("info", "Webhook fired to n8n", {
          requestId,
          postId: post.id,
          durationMs: fireDuration,
        });

        // Record attempt
        await recordPublishAttempt(post.id, "sent", undefined, undefined, fireDuration);

        processed++;
      } catch (error) {
        failed++;

        const errorMsg = error instanceof Error ? error.message : String(error);

        log("error", "Failed to process post", {
          requestId,
          postId: post.id,
          error: errorMsg,
        });

        // Record attempt failure
        await recordPublishAttempt(
          post.id,
          "failed",
          error instanceof Error ? error.constructor.name : "UnknownError",
          errorMsg
        );
      }
    }

    log("info", "Cron: Complete", {
      requestId,
      processed,
      failed,
      duration: `${Date.now() - new Date(requestId).getTime()}ms`,
    });

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: posts.length,
    });
  } catch (error) {
    log("error", "Cron job failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
```

### 7.2 Webhook Callback Handler

```typescript
// src/app/api/webhooks/publish-status/route.ts (enhanced)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { updatePost, recordPublishAttempt } from "@/lib/db/queries";
import { log } from "@/lib/logger";

const publishStatusSchema = z.object({
  postId: z.string().min(1),
  status: z.enum(["published", "failed"]),
  linkedinPostUrn: z.string().min(1).optional(),
  error: z.union([z.string(), z.record(z.string(), z.unknown())])
    .optional()
    .transform((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : v)),
  callbackId: z.string().optional(),  // n8n-generated unique ID for idempotency
});

/**
 * POST /api/webhooks/publish-status
 *
 * Callback from n8n after LinkedIn publish attempt.
 * Updates post status and marks as published or failed.
 *
 * Idempotency: Safe to call multiple times for same callbackId
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // 1. Verify webhook secret
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;

  if (!expectedSecret) {
    log("error", "N8N_CALLBACK_SECRET not configured", { requestId });
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (
    !secret ||
    secret.length !== expectedSecret.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
  ) {
    log("warn", "Unauthorized webhook callback", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log("warn", "Invalid JSON body", { requestId });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = publishStatusSchema.safeParse(body);

  if (!result.success) {
    log("warn", "Validation failed", {
      requestId,
      errors: result.error.flatten(),
    });
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const { postId, status, linkedinPostUrn, error, callbackId } = result.data;

  log("info", "Received webhook callback", {
    requestId,
    postId,
    status,
    callbackId,
  });

  // 3. Check post exists
  const existingPostResult = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  const existingPost = existingPostResult[0];

  if (!existingPost) {
    log("warn", "Callback for non-existent post", { requestId, postId });
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // 4. Idempotency check: if already in target state with matching data
  if (existingPost.status === status) {
    if (
      status === "published" &&
      existingPost.linkedin_post_urn === linkedinPostUrn
    ) {
      log("info", "Duplicate callback (idempotent)", { requestId, postId });
      return NextResponse.json({ success: true });
    }
    if (status === "failed") {
      log("info", "Duplicate failure callback (idempotent)", { requestId, postId });
      return NextResponse.json({ success: true });
    }
  }

  // 5. Validate state transition: only publishing → published/failed
  if (existingPost.status !== "publishing") {
    log("warn", "Invalid state transition", {
      requestId,
      postId,
      currentStatus: existingPost.status,
      requestedStatus: status,
    });
    return NextResponse.json(
      {
        error: "Invalid state transition",
        currentStatus: existingPost.status,
      },
      { status: 409 }
    );
  }

  try {
    // 6. Update post status
    const updated = await updatePost(
      postId,
      {
        status,
        ...(status === "published" && { linkedin_post_urn: linkedinPostUrn ?? null, published_at: new Date() }),
        ...(status === "failed" && { error_message: error ?? "Unknown error" }),
      },
      existingPost.user_id
    );

    if (!updated) {
      log("warn", "Post deleted during update", { requestId, postId });
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // 7. Record in audit trail
    await recordPublishAttempt(
      postId,
      status === "published" ? "success" : "failed",
      undefined,
      error ? (typeof error === "string" ? error : JSON.stringify(error)) : undefined,
      Date.now() - new Date(requestId).getTime()
    );

    log("info", "Post status updated via webhook", {
      requestId,
      postId,
      status,
      callbackId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    log("error", "Failed to update post", {
      requestId,
      postId,
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}
```

### 7.3 Recovery Endpoint (Enhanced)

```typescript
// src/app/api/posts/recover/route.ts (existing - already good)

// Keep the existing implementation, it's already well-designed.
// Just ensure it:
// 1. Validates state transitions
// 2. Logs all actions
// 3. Handles scheduler service failures gracefully
// 4. Records audit trail
```

### 7.4 Auto-Recovery Cron (Optional)

```typescript
// src/app/api/cron/recover-stale-posts/route.ts (NEW)

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getStalePublishingPosts, updatePost } from "@/lib/db/queries";
import { log } from "@/lib/logger";

/**
 * GET /api/cron/recover-stale-posts
 *
 * Runs every 10 minutes to auto-recover posts stuck in "publishing" > 5 minutes.
 * Resets them to "scheduled" so the main cron can retry them.
 *
 * Security: Requires x-cron-secret header
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Verify cron secret
  const secret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    log("info", "Cron: Starting stale job recovery", { requestId });

    const stalePosts = await getStalePublishingPosts();

    if (stalePosts.length === 0) {
      log("info", "Cron: No stale posts to recover", { requestId });
      return NextResponse.json({ success: true, recovered: 0 });
    }

    let recovered = 0;

    for (const post of stalePosts) {
      try {
        log("warn", "Auto-recovering stale post", {
          requestId,
          postId: post.id,
          stalenessMs: Date.now() - post.updated_at.getTime(),
        });

        // Reset to scheduled for retry
        await updatePost(
          post.id,
          {
            status: "scheduled",
            scheduled_at: new Date(),
          },
          post.user_id
        );

        recovered++;
      } catch (error) {
        log("error", "Failed to recover post", {
          requestId,
          postId: post.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    log("info", "Cron: Stale job recovery complete", {
      requestId,
      recovered,
      total: stalePosts.length,
    });

    return NextResponse.json({ success: true, recovered, total: stalePosts.length });
  } catch (error) {
    log("error", "Cron: Recovery job failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}
```

---

## 8. CONFIGURATION CHECKLIST

### 8.1 Environment Variables

```bash
# .env.local (development)
CRON_SECRET=dev_cron_secret_change_in_prod
N8N_CALLBACK_SECRET=dev_webhook_secret_change_in_prod
N8N_WEBHOOK_URL=http://localhost:5678/webhook/linkie-claw

# .env.example (committed)
CRON_SECRET=your-secure-random-secret
N8N_CALLBACK_SECRET=your-webhook-secret
N8N_WEBHOOK_URL=https://n8n.yourcompany.com/webhook/linkie-claw
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### 8.2 Cron Job Configuration

**Vercel Crons:**
```json
{
  "crons": [
    {
      "path": "/api/cron/publish-scheduled",
      "schedule": "*/1 * * * *",
      "secret": "$CRON_SECRET"
    },
    {
      "path": "/api/cron/recover-stale-posts",
      "schedule": "*/10 * * * *",
      "secret": "$CRON_SECRET"
    }
  ]
}
```

**Railway/Docker:**
```yaml
cron:
  image: node:20-alpine
  command: |
    sh -c "while true; do
      echo 'Running main cron...'
      curl -H 'x-cron-secret: $CRON_SECRET' http://app:3000/api/cron/publish-scheduled
      sleep 60

      echo 'Running recovery cron...'
      curl -H 'x-cron-secret: $CRON_SECRET' http://app:3000/api/cron/recover-stale-posts
      sleep 480  # 8 minutes, so total cycle is 10 minutes
    done"
```

### 8.3 n8n Workflow Configuration

```json
{
  "webhookId": "linkie-claw",
  "nodes": [
    {
      "name": "LinkedIn Publish",
      "parameters": {
        "postId": "{{ $json.postId }}",
        "content": "{{ $json.content }}",
        "imageUrl": "{{ $json.imageUrl }}"
      }
    },
    {
      "name": "Callback",
      "type": "webhook",
      "method": "POST",
      "url": "{{ $env.CALLBACK_URL }}/api/webhooks/publish-status",
      "headers": {
        "x-webhook-secret": "{{ $env.N8N_CALLBACK_SECRET }}"
      },
      "body": {
        "postId": "{{ $json.postId }}",
        "status": "{{ $json.success ? 'published' : 'failed' }}",
        "linkedinPostUrn": "{{ $json.linkedinPostUrn }}",
        "error": "{{ $json.error }}",
        "callbackId": "{{ $env.EXECUTION_ID }}"
      },
      "retries": {
        "maxAttempts": 5,
        "backoffMultiplier": 2,
        "initialDelayMs": 1000
      }
    }
  ]
}
```

---

## 9. SUMMARY TABLE

| Aspect | Recommendation | Rationale |
|--------|-----------------|-----------|
| **Retry Strategy** | Exponential backoff + jitter (5 retries, 1s→32s) | Handles transient failures, prevents retry storms |
| **Retry Storage** | Same row + audit table | State in main row, history in audit table |
| **Stale Detection** | Timeout-based (5 min) | Simple, no extra infra, acceptable latency |
| **Recovery** | Manual UI + auto cron | User control + automatic fallback |
| **Concurrency** | Status transition (scheduled→publishing) | Effective poor-man's lock, no SELECT FOR UPDATE needed |
| **Idempotency** | By state + callbackId | Prevents double-processing from retried callbacks |
| **State Validation** | Enforce state machine | Only publishing→published/failed allowed |
| **Cron Security** | x-cron-secret header + timing-safe compare | Prevents unauthorized cron triggers |
| **Webhook Security** | x-webhook-secret header + timing-safe compare | Prevents webhook spoofing |
| **Logging** | Structured JSON + request IDs | Easy to correlate events, debug issues |
| **Metrics** | Success rate, latency, failure rate | Alerts + dashboard insights |

---

## 10. IMPLEMENTATION ROADMAP

### Phase 1 (MVP - Already Have Most)
- [x] Polling query (`getPostsReadyToPublish`)
- [x] Status transition (scheduled → publishing)
- [x] Webhook callback handler
- [x] Idempotency check
- [x] State validation
- [x] Manual recovery endpoint
- [x] Retry count in DB
- [x] Structured logging
- [x] Secret verification

### Phase 2 (Enhance - Recommended)
- [ ] Exponential backoff retry calculation
- [ ] Audit trail table
- [ ] Stale job detection query
- [ ] Auto-recovery cron
- [ ] Alert on anomalies
- [ ] Metrics collection

### Phase 3 (Production Polish)
- [ ] Rate limiting on webhook
- [ ] HMAC webhook signing
- [ ] Comprehensive dashboard
- [ ] SLA monitoring
- [ ] Cost optimization (batch processing)

---

## References

- **RFC 8555**: Automatic Certificate Management Environment (ACME) - Section 7.5 (backoff strategy)
- **AWS Best Practices**: Exponential backoff and jitter
- **Google Cloud**: Handling API quotas
- **PostgreSQL Docs**: `SELECT FOR UPDATE` (not needed here)
- **NIST**: Guidelines for User Authentication and Authorization
