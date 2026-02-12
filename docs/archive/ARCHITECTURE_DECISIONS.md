# Architecture Decisions: Why These Choices for Linkie Claw

This document explains the "why" behind each recommendation, including trade-offs and alternatives considered.

---

## 1. RETRY STRATEGY: Exponential Backoff + Jitter

### Decision
Use **exponential backoff with jitter** instead of fixed delay or simple retry.

### Timeline
```
Attempt 1: 1s   (actual: 0.9-1.1s with ±10% jitter)
Attempt 2: 2s   (actual: 1.8-2.2s)
Attempt 3: 4s   (actual: 3.6-4.4s)
Attempt 4: 8s   (actual: 7.2-8.8s)
Attempt 5: 16s  (actual: 14.4-17.6s)
Total:    ~31 seconds of retries
```

### Why This Works for Linkie Claw

**Problem with Fixed Delay (every 10s):**
```
Attempt 1: 10s
Attempt 2: 10s
Attempt 3: 10s
Attempt 4: 10s
Attempt 5: 10s
Total: 50 seconds
```
- Wastes resources retrying immediately if service is down
- No differentiation between "service temporarily unavailable" vs "will be down for 30 seconds"
- Multiple clients retry simultaneously → thundering herd

**Problem with No Jitter:**
```
Client A: Retry at 2s, 4s, 8s, 16s, 32s
Client B: Retry at 2s, 4s, 8s, 16s, 32s
Client C: Retry at 2s, 4s, 8s, 16s, 32s
→ All clients hammer server at exact same times
```

**How Exponential Backoff + Jitter Solves This:**

1. **Exponential part** (1s → 2s → 4s → 8s...):
   - Quickly backs off if problem persists
   - Gives service time to recover
   - Respects retry budgets
   - Industry standard for distributed systems

2. **Jitter part** (±10% random):
   - Spreads retries across time window
   - Prevents thundering herd
   - Example: With 100 clients, retries distributed across 1.9-2.2s instead of all at 2.0s exactly
   - RFC 8555 (ACME) specifies this exact pattern

### Alternatives Rejected

**1. No retries (only manual recovery)**
- ❌ Requires user intervention for transient failures
- ❌ Poor UX - users manually check posts for hours
- ❌ Loses 30-80% of would-be auto-recoveries
- ✅ Simpler code, but not acceptable for production

**2. Simple counter (POST /api/retry until max)**
- ❌ No exponential backoff
- ❌ No jitter
- ❌ Thundering herd problem
- ❌ Wastes bandwidth on immediate retries
- ✅ Simple to understand

**3. Message queue (Redis, Bull, RabbitMQ)**
- ✅ Professional solution
- ✅ Built-in retry logic with exponential backoff
- ✅ Dead-letter queues
- ❌ Adds infrastructure (Redis server)
- ❌ Overkill for ~10-50 posts/day
- ❌ Extra deployment complexity
- **Decision:** Premature optimization - add later if needed

**4. Database-driven scheduler (APScheduler, node-schedule)**
- ✅ Native Python/Node support
- ❌ Still need database polling
- ❌ Doesn't solve n8n callback problem
- ❌ More complex than HTTP-based cron
- **Decision:** Rejected - cron + webhook is simpler

### Recommendation for Linkie Claw
**Use exponential backoff + jitter** because:
- Simple to implement (12 lines of code)
- Solves thundering herd without extra infra
- Industry standard (AWS, Google Cloud, Azure all recommend)
- Works with your existing n8n callback model
- Can upgrade to Redis queue later if needed

---

## 2. RETRY STATE STORAGE: Same Row vs Separate Table

### Decision
Keep `retry_count` in posts table, add `post_publishing_audit` table for audit trail.

### The Confusion

**Common question:** "Should I increment retry_count in the posts table, or keep all retries in a separate table?"

**Answer:** Both! Here's why:

```typescript
// posts table (main state)
{
  id: "post-123",
  status: "scheduled",     // ← Current state
  retry_count: 2,          // ← For logic (should we retry?)
  error_message: "...",    // ← Latest error
}

// post_publishing_audit table (history)
{
  post_id: "post-123",
  attempt_number: 1,
  status: "sent",
  created_at: "2026-02-12T10:00:00Z"
},
{
  post_id: "post-123",
  attempt_number: 2,
  status: "failed",
  error_message: "n8n timeout",
  created_at: "2026-02-12T10:02:45Z"
}
```

### Why Not Separate Table Only?

**Problem:**
```typescript
// Each time cron runs, it would need to:
const attempts = await db
  .select()
  .from(postPublishingAudit)
  .where(eq(postPublishingAudit.post_id, postId));

const shouldRetry = attempts.length < MAX_RETRIES;

// Then determine state:
const latestAttempt = attempts[attempts.length - 1];
const currentStatus = latestAttempt.status === "success" ? "published" : "scheduled";
```

**Issues:**
- ❌ Requires join + logic every query (slow)
- ❌ Denormalized state scattered across table
- ❌ Inefficient WHERE clause (`status` could use index, audit table requires scan)
- ❌ Complex state machine logic

### Why Not posts Table Only?

**Problem:**
```typescript
// No audit trail at all
const post = await getPostById("post-123");
console.log(post.retry_count);  // 5 - but WHY did it fail?
console.log(post.error_message); // Only latest error

// Lost information:
// - When did each attempt happen?
// - What was the 2nd attempt's error?
// - How long did the request take?
// - Response time trend?
```

**Issues:**
- ❌ No debugging information
- ❌ Can't see retry timeline
- ❌ No performance metrics
- ❌ Hard to diagnose patterns

### Recommended Approach: Dual Storage

**posts table:**
- `status` - Current state (draft, scheduled, publishing, published, failed)
- `retry_count` - How many times we've tried
- `error_message` - Latest error (for display)

**post_publishing_audit table:**
- `attempt_number` - Sequence of events
- `status` - Sent, success, failed, timeout
- `error_code` - Error type (HTTP500, RequestTimeout, etc.)
- `error_message` - Full error details
- `response_time_ms` - Performance metric
- `created_at` - When this happened

### Queries

**Get current state (fast, one table):**
```typescript
export async function getPostsReadyToPublish() {
  return db.select().from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        lt(posts.scheduled_at, now),
        lt(posts.retry_count, MAX_RETRIES)  // ← Uses index
      )
    );
}
```

**Get retry history (for debugging, separate table):**
```typescript
export async function getPublishingHistory(postId: string) {
  return db.select().from(postPublishingAudit)
    .where(eq(postPublishingAudit.post_id, postId))
    .orderBy(desc(postPublishingAudit.created_at));
}
```

**Get failure rate (analytics, both tables):**
```typescript
export async function getPublishingMetrics(userId: string) {
  const failed = await db.select().from(posts)
    .where(
      and(
        eq(posts.user_id, userId),
        eq(posts.status, "failed")
      )
    );

  const attempts = await db.select()
    .from(postPublishingAudit)
    .where(eq(postPublishingAudit.status, "failed"));
}
```

### Trade-offs Summary

| Approach | Pros | Cons |
|----------|------|------|
| **posts only** | Simple schema | No audit trail, hard to debug |
| **audit only** | Full history | Slow queries, complex state logic |
| **Both (recommended)** | Fast queries + audit trail | Two places to write |

**For Linkie Claw:** Dual storage is worth the extra write, because:
- ✅ Debugging is critical (LinkedIn API failures are mysterious)
- ✅ Analytics matter (success rate, avg retries)
- ✅ Writes are cheap (one extra INSERT per retry)
- ✅ Reads are fast (index on main table)

---

## 3. STALE DETECTION: Timeout vs Heartbeat

### Decision
Use **timeout-based detection** (check if `updated_at` is old) instead of heartbeat pattern.

### The Pattern Comparison

**Heartbeat Pattern:**
```
T=0s:   Cron marks post as "publishing"
T=10s:  Post service writes heartbeat (updates timestamp)
T=20s:  Post service writes heartbeat
...
T=310s: No new heartbeat → ALERT
```

**Timeout Pattern:**
```
T=0s:   Cron marks post as "publishing" (sets updated_at)
T=300s: Recovery cron checks: is updated_at > 5 min old?
        YES → Reset to scheduled for retry
```

### Why Timeout for Linkie Claw

**1. Infrastructure complexity:**

Heartbeat requires:
- Separate timer/scheduler in publishing service
- Network calls every 10-30 seconds
- Handling lost heartbeats

Timeout requires:
- Query with one condition (`updated_at < 5 min ago`)
- No extra infrastructure

**2. Failure modes:**

Heartbeat fails when:
- Heartbeat service crashes (loses visibility)
- Network from service → app is down (can't write heartbeat)
- Database is slow (heartbeat can't write)

Timeout works even when:
- Publishing service is completely down
- Network is partially broken
- Database is loaded (we're just reading)

**3. For LinkedIn publishing specifically:**

LinkedIn API calls take 2-5 seconds typically. If one fails:
- You want to know within 5 minutes (not immediately)
- User can manually recover via UI
- Auto-recovery can kick in after 5 minutes
- 5 minute delay is acceptable for scheduling posts

**4. Cost:**

Heartbeat: Every 10 seconds × (posts in flight) × 24h = many DB writes

Timeout: One query every 10 minutes = negligible load

### Alternatives Rejected

**1. Immediate timeout (1 minute)**
- ❌ Too aggressive - normal network delay could trigger false positives
- ❌ LinkedIn API sometimes slow
- ❌ High false recovery rate
- ✅ Faster detection

**2. Webhook timeout handler (n8n calls back on timeout)**
- ✓ Could work
- ❌ Requires n8n to implement timeout logic
- ❌ Not reliable if n8n itself is down
- ❌ Extra complexity in n8n workflow

**3. Database polling + SELECT FOR UPDATE**
- ✓ Could work
- ❌ Requires database lock
- ❌ Overkill for this problem
- ❌ Doesn't prevent n8n from crashing

**4. Redis/cache-based heartbeat**
- ✓ Lightweight
- ❌ Extra infrastructure (Redis)
- ❌ Redis failure = no visibility
- ❌ Overkill for this scale

### Recommendation for Linkie Claw

**Use 5-minute timeout** because:
- ✅ Simple (one timestamp check)
- ✅ Reliable (doesn't require heartbeat writes)
- ✅ Good balance (not too fast, not too slow)
- ✅ No extra infrastructure
- ✅ Acceptable for user experience (5 min is OK for post scheduling)

### Detection Code

```typescript
export async function getStalePublishingPosts() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  return db.select().from(posts)
    .where(
      and(
        eq(posts.status, "publishing"),
        lt(posts.updated_at, fiveMinutesAgo),  // ← Simple!
        lt(posts.retry_count, MAX_RETRIES)
      )
    );
}
```

---

## 4. CONCURRENCY CONTROL: Status Transition as Lock

### Decision
Use **status transition** (scheduled → publishing) as concurrency control instead of SELECT FOR UPDATE.

### The Problem

**Scenario:** Cron job runs every 60 seconds, but request takes 45 seconds.

```
Timeline:
T=0s:   Cron 1 fires, finds post A (scheduled)
T=10s:  Post A still publishing, waiting for callback
T=60s:  Cron 2 fires → Should it process post A again?
        ANSWER: No! But how do we prevent it?
```

### The Lock Mechanism

**Without proper locking:**
```typescript
// Cron 1 (T=0s)
const posts = db.select().from(posts)
  .where(eq(posts.status, "scheduled"));
// finds [post A]

// Cron 2 (T=60s, runs simultaneously)
const posts = db.select().from(posts)
  .where(eq(posts.status, "scheduled"));
// ALSO finds [post A] - DUPLICATE PROCESSING!
```

**With status transition lock:**
```typescript
// Cron 1 (T=0s)
const updated = db.update(posts)
  .set({ status: "publishing" })
  .where(
    and(
      eq(posts.id, "post-A"),
      eq(posts.status, "scheduled")  // ← Only if STILL scheduled
    )
  )
  .returning();
// Returns [post A] - claimed!

// Cron 2 (T=60s)
const updated = db.update(posts)
  .set({ status: "publishing" })
  .where(
    and(
      eq(posts.id, "post-A"),
      eq(posts.status, "scheduled")  // ← But it's now "publishing"!
    )
  )
  .returning();
// Returns [] - can't claim, already in different state
```

### Why Not SELECT FOR UPDATE?

**PostgreSQL/MySQL syntax:**
```typescript
const [post] = await db.query(`
  SELECT * FROM posts
  WHERE id = $1
  FOR UPDATE
`);
// Database locks row, prevents other transactions from reading/writing
```

**Problems for Linkie Claw:**

1. **SQLite doesn't support it well**
   - SQLite has coarse-grained locking
   - `SELECT FOR UPDATE` not directly supported

2. **Not needed for this pattern**
   - We don't need to modify the same row in one transaction
   - We just need to prevent concurrent processing
   - Status transition already provides this

3. **Overhead**
   - Database locks cost resources
   - Hold locks only as long as needed
   - Here: we don't hold locks, we just check state

4. **Deadlock risk**
   - Multiple processes locking same rows
   - Could cause deadlocks
   - We avoid this by not using locks

### How Status Transition Works as a Lock

**Database guarantee:** An UPDATE with a WHERE clause is atomic.

```typescript
// This is atomic - it all happens at once
const updated = db.update(posts)
  .set({ status: "publishing", updated_at: new Date() })
  .where(
    and(
      eq(posts.id, postId),
      eq(posts.status, "scheduled")
    )
  )
  .returning();

// Only ONE concurrent caller will get a result
// All others will get []
```

**Why it works:**

1. Cron 1 checks: "Is post still scheduled?"
   - YES → Update it AND get it back
   - Now it's "publishing"

2. Cron 2 checks: "Is post still scheduled?"
   - NO (it's "publishing") → Get nothing
   - Cron 2 moves on to next post

**No locks needed** - we just check the state before acting.

### Comparison: All Locking Approaches

| Approach | Complexity | Cost | Works with SQLite | Needed? |
|----------|-----------|------|------------------|---------|
| **No locking (bad)** | 0 | Free | ✅ | ❌ Duplicates |
| **Status transition (good)** | 1 | Free | ✅ | ✅ Perfect fit |
| **SELECT FOR UPDATE** | 3 | Low | ❌ | ❌ Not needed |
| **Mutex/lock table** | 5 | Medium | ✅ | ❌ Overkill |
| **Redis SETNX** | 4 | Medium | ✅ | ❌ Extra infra |
| **Distributed lock (Consul)** | 10 | High | ✅ | ❌ Enterprise only |

### Recommendation for Linkie Claw

**Use status transition as poor-man's lock** because:
- ✅ Simple (one WHERE condition)
- ✅ Free (no extra infrastructure)
- ✅ Works with SQLite
- ✅ Works with PostgreSQL
- ✅ Guaranteed atomic
- ✅ Prevents duplicates effectively
- ✅ Matches your state machine

---

## 5. IDEMPOTENCY: Multiple Callbacks

### Decision
Support idempotency via **both callbackId AND state-based checks**.

### The Problem

**n8n publishes successfully:**
```
T=0s:   n8n: POST /api/webhooks/publish-status
        { postId: "A", status: "published", linkedinPostUrn: "urn:123" }

T=1s:   Network hiccup, retry
        n8n: POST /api/webhooks/publish-status (AGAIN)
        { postId: "A", status: "published", linkedinPostUrn: "urn:123" }

Result: Post updated TWICE with identical data
        (not harmful, but inefficient)
```

**Or worse - race condition:**
```
T=0s:   n8n: POST /api/webhooks/publish-status
        { postId: "A", status: "published", linkedinPostUrn: "urn:123" }

T=0.5s: n8n: POST /api/webhooks/publish-status (retry)
        { postId: "A", status: "failed", error: "..." }

Result: Post ends up in WRONG state (failed instead of published)
        This would be a disaster!
```

### Solution: Layered Idempotency

**Layer 1: Idempotency Key (best practice)**
```typescript
// n8n includes callback ID
{
  postId: "A",
  status: "published",
  callbackId: "n8n-exec-abc123"  // ← Unique per execution
}

// App checks: have we seen this callbackId?
const existing = await db.select()
  .from(posts)
  .where(eq(posts.webhook_idempotency_key, callbackId));

if (existing[0]) {
  // Already processed, return 200 (idempotent)
  return NextResponse.json({ success: true });
}
```

**Layer 2: State-based check (fallback)**
```typescript
// If somehow the callback was processed but callbackId not saved:
if (existingPost.status === "published" &&
    existingPost.linkedin_post_urn === linkedinPostUrn) {
  // Post already in correct state, return 200 (idempotent)
  return NextResponse.json({ success: true });
}
```

**Layer 3: State validation (safety)**
```typescript
// Ensure we're only transitioning from "publishing"
if (existingPost.status !== "publishing") {
  // Reject with 409 Conflict
  return NextResponse.json({ error: "Invalid state" }, { status: 409 });
}
```

### Why Both Layers?

**Idempotency key alone:**
- ✅ Handles immediate retries
- ❌ What if n8n crashes after making update but before saving callbackId?

**State check alone:**
- ✅ Handles most cases
- ❌ Doesn't prevent duplicate updates to same post (inefficient)
- ❌ Race conditions possible with timing

**Both together:**
- ✅ Handles all cases
- ✅ Prevents duplicates
- ✅ Prevents state corruption
- ✅ Safe even if one layer fails

### Implementation

```typescript
export async function POST(request: NextRequest) {
  const { postId, status, linkedinPostUrn, error, callbackId } = body;

  // Layer 1: Check idempotency key
  if (callbackId) {
    const existing = await db.select()
      .from(posts)
      .where(eq(posts.webhook_idempotency_key, callbackId))
      .limit(1);

    if (existing[0]) {
      log("info", "Duplicate callback (idempotency key)", { callbackId });
      return NextResponse.json({ success: true });
    }
  }

  // Layer 2: Get post and check state
  const post = await db.select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  if (!post[0]) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Layer 2: State-based idempotency
  if (post[0].status === status) {
    if (status === "published" && post[0].linkedin_post_urn === linkedinPostUrn) {
      log("info", "Duplicate callback (state match)", { postId });
      return NextResponse.json({ success: true });
    }
  }

  // Layer 3: Validate state transition
  if (post[0].status !== "publishing") {
    log("warn", "Invalid state transition", {
      postId,
      current: post[0].status,
      requested: status,
    });
    return NextResponse.json({ error: "Invalid state" }, { status: 409 });
  }

  // All checks passed - update post
  await updatePost(postId, {
    status,
    linkedin_post_urn: linkedinPostUrn,
    webhook_idempotency_key: callbackId,
  });

  return NextResponse.json({ success: true });
}
```

### Recommendation for Linkie Claw

**Use all three layers** because:
- ✅ Simple to implement (only adds a few checks)
- ✅ Prevents all failure modes
- ✅ Makes debugging easier (can see which layer caught issue)
- ✅ Standard practice (AWS, Stripe, etc. all do this)

---

## 6. SECURITY: Cron Endpoint Protection

### Decision
Use **x-cron-secret header with timing-safe comparison**.

### Why Not Other Approaches?

**1. No authentication (bad):**
```typescript
// NEVER do this:
export async function GET(request: NextRequest) {
  // Anyone can call this!
  const posts = await getPostsReadyToPublish();
  // ...
}

// Attacker: curl https://yourapp.com/api/cron/publish-scheduled
// Result: Infinite loop of fake posts!
```

**2. API key in URL (bad):**
```typescript
// https://yourapp.com/api/cron/publish-scheduled?key=abc123

// Problems:
// - Logged in server logs
// - Cached by proxies/CDNs
// - Visible in browser history
// - Easy to intercept
```

**3. Bearer token (okay, but not ideal for cron):**
```typescript
// Authorization: Bearer abc123

// Good for user APIs, but:
// - Extra encryption/parsing overhead
// - Overkill for single shared secret
```

**4. x-cron-secret header (good):**
```typescript
// curl -H "x-cron-secret: abc123" https://yourapp.com/api/cron/publish-scheduled

// Pros:
// ✅ Not in URL (not logged the same way)
// ✅ Specific header name shows intent
// ✅ Simple
// ✅ Works with cron tools
```

### Why Timing-Safe Comparison?

**Naive comparison (WRONG):**
```typescript
if (secret === expectedSecret) {  // ❌ Timing attack!
  return NextResponse.json({ success: true });
}
```

**Problem:**
```
Actual secret: "abc123def456"

Attack 1: "xyz789"
  - Comparison fails at first char
  - Time: 1 microsecond

Attack 2: "abcxyz"
  - Comparison fails at fourth char
  - Time: 3 microseconds

Attacker: "If it takes longer, the first chars are correct!"
Result: Attacker can guess secret one char at a time
```

**Timing-safe comparison (CORRECT):**
```typescript
import { timingSafeEqual } from "crypto";

if (
  !timingSafeEqual(
    Buffer.from(secret),
    Buffer.from(expectedSecret)
  )
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**How it works:**
```
// Always compares ALL characters
// Takes same time for "xyz789" and "abc123def455"
// Attacker can't use timing to guess chars
```

### Length Check First

Always check length BEFORE timing-safe compare:

```typescript
if (
  !secret ||
  secret.length !== expectedSecret.length ||  // ← Fast, safe
  !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Why:** If lengths are different, string can't be equal anyway. Saves microseconds.

### Recommendation for Linkie Claw

```typescript
// Every cron endpoint should have:

export async function GET(request: NextRequest) {
  // 1. Get secret
  const secret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  // 2. Check configured
  if (!expectedSecret) {
    log("error", "CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // 3. Length check
  if (!secret || secret.length !== expectedSecret.length) {
    log("warn", "Invalid cron secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Timing-safe comparison
  if (!timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))) {
    log("warn", "Invalid cron secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ... rest of endpoint
}
```

---

## 7. OBSERVABILITY: What to Log and Why

### Decision
**Structured JSON logging with request IDs** for complete traceability.

### Your Current Logger

You already have a good foundation:

```typescript
// src/lib/logger.ts
export function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  console.log(JSON.stringify(entry));
}
```

This is perfect because:
- ✅ JSON format (machine-parseable)
- ✅ Timestamps (correlation)
- ✅ Structured data (context)
- ✅ Can pipe to log aggregator (Datadog, ELK, CloudWatch)

### What to Log: The Complete Journey

**1. Cron invocation (info):**
```typescript
log("info", "Cron: Polling for posts", { requestId, timeMs: 0 });
```

**2. What we found (info):**
```typescript
log("info", "Cron: Found posts", {
  requestId,
  count: 5,
  postIds: ["id1", "id2", "id3", "id4", "id5"],
});
```

**3. State transition (info):**
```typescript
log("info", "Post marked as publishing", {
  requestId,
  postId: "id1",
  userId: "user123",
  retryCount: 0,
});
```

**4. Network call (info):**
```typescript
log("info", "Webhook fired to n8n", {
  requestId,
  postId: "id1",
  durationMs: 245,
  n8nUrl: process.env.N8N_WEBHOOK_URL,
});
```

**5. Webhook callback (info):**
```typescript
log("info", "Webhook callback received", {
  requestId,
  postId: "id1",
  status: "published",
  callbackDurationMs: 5000,  // Time from marking as publishing to callback
});
```

**6. Errors (error):**
```typescript
log("error", "Webhook failed", {
  requestId,
  postId: "id1",
  httpStatus: 500,
  error: "n8n: LinkedIn API returned error",
  durationMs: 125,
});
```

**7. Stale detection (warn):**
```typescript
log("warn", "Stale post detected", {
  requestId,
  postId: "id1",
  stalinessMinutes: 5.2,
  retryCount: 1,
});
```

**8. Completion (info):**
```typescript
log("info", "Cron: Complete", {
  requestId,
  processed: 4,
  failed: 1,
  totalDurationMs: 1240,
  rate: "4/min",
});
```

### Why Structured Logs Matter

**Bad logging:**
```
"2026-02-12 10:00:00 Post published"
"2026-02-12 10:00:05 Post failed: connection timeout"
```

**Problems:**
- ❌ Hard to parse
- ❌ Can't extract metrics
- ❌ No correlation across requests
- ❌ Can't filter by user/post/error type

**Good logging:**
```json
{"timestamp":"2026-02-12T10:00:00.000Z","level":"info","message":"Post marked as publishing","requestId":"abc-123","postId":"post-456","userId":"user-789","retryCount":0}
{"timestamp":"2026-02-12T10:00:05.000Z","level":"error","message":"Webhook failed","requestId":"abc-123","postId":"post-456","httpStatus":500,"error":"n8n timeout"}
```

**Capabilities:**
- ✅ Parse as JSON
- ✅ Query: `level=error`
- ✅ Filter: `userId=user-789`
- ✅ Correlate: `requestId=abc-123`
- ✅ Metrics: count errors by type
- ✅ Alerts: trigger on specific patterns

### Recommendation for Linkie Claw

Use your existing logger for all state changes:

```typescript
// Every important event should log:
// - requestId (for correlation)
// - postId (what failed)
// - userId (who it affects)
// - status (current state)
// - timing (how long it took)
// - error details (why it failed)
```

Later, pipe logs to:
- **Development:** Console only
- **Production:** Datadog/CloudWatch/ELK + Slack alerts

---

## Summary: Architectural Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **Retry strategy** | Exponential backoff + jitter | Prevents thundering herd, industry standard |
| **Retry state** | Same row + audit table | Efficient queries + complete audit trail |
| **Stale detection** | Timeout-based (5m) | Simple, reliable, no extra infra |
| **Concurrency** | Status transition | Works with SQLite, atomic, no locks needed |
| **Idempotency** | Layered (key + state + validation) | Prevents all failure modes |
| **Security** | x-cron-secret + timing-safe | Simple, secure, works with cron tools |
| **Logging** | Structured JSON + requestId | Traceable, queryable, alertable |

All of these decisions are **production-grade** but **simple** - no over-engineering.
