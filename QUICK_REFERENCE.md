# Quick Reference: Best Practices for Webhook + Polling Pattern

**TL;DR for busy developers** - See the full docs for reasoning.

---

## 1. RETRY STRATEGY

```typescript
// Timeline: 1s → 2s → 4s → 8s → 16s → 32s (total: 63s, max 5 retries)
// Formula: delay = min(1000 * 2^attempt, 32000) ± 10% jitter

import { calculateBackoffDelay } from "@/lib/api/retry-strategy";

const delayMs = calculateBackoffDelay(attemptNumber);
// Attempt 0: ~1000ms
// Attempt 1: ~2000ms
// Attempt 2: ~4000ms
// Attempt 3: ~8000ms
// Attempt 4: ~16000ms
```

**Copy-paste solution:**
```typescript
// src/lib/api/retry-strategy.ts
export function calculateBackoffDelay(attemptNumber: number): number {
  const exponential = Math.min(1000 * Math.pow(2, attemptNumber), 32000);
  const jitter = exponential * 0.1;
  const randomJitter = Math.random() * jitter * 2 - jitter;
  return Math.max(0, exponential + randomJitter);
}
```

---

## 2. DATABASE SCHEMA

```typescript
// posts table (existing - keep as is)
{
  id: string,
  status: "draft" | "scheduled" | "publishing" | "published" | "failed",
  retry_count: integer,    // Current retry count (for state machine)
  error_message: string,   // Latest error
  updated_at: timestamp,   // For stale detection (5+ min = stale)
}

// post_publishing_audit table (NEW - add this)
{
  id: string,
  post_id: string,         // FK to posts
  attempt_number: integer, // Which attempt was this?
  status: "queued" | "sent" | "success" | "failed" | "timeout",
  error_code: string,      // HTTP500, RequestTimeout, etc.
  error_message: string,   // Full error text
  response_time_ms: integer,
  created_at: timestamp,
}
```

---

## 3. STATE MACHINE

```
DRAFT
  ↓
SCHEDULED (user schedules post)
  ↓
PUBLISHING (cron fires webhook)
  ↓
PUBLISHED (n8n callback succeeds) → TERMINAL
  ↓
FAILED (n8n callback fails OR timeout) → User can manually retry
  ↓
SCHEDULED (manual recovery)

Key constraints:
- Only ONE state can send to publishing (status check)
- Only publishing → published/failed allowed (state validation)
- Max 5 retries before giving up
- Timeout: 5 minutes in "publishing" state
```

---

## 4. CRON SCHEDULE

```
┌─ Every 60 seconds ─────────────────────────┐
│  GET /api/cron/publish-scheduled            │
│  - Find posts ready to publish              │
│  - Mark as "publishing" (atomic)            │
│  - Fire webhook to n8n                      │
│  - Record audit trail                       │
└─────────────────────────────────────────────┘

┌─ Every 10 minutes ────────────────────────┐
│  GET /api/cron/recover-stale-posts         │
│  - Find posts in "publishing" > 5 min      │
│  - Reset to "scheduled" for retry          │
└───────────────────────────────────────────┘
```

---

## 5. WEBHOOK CALLBACK

```
POST /api/webhooks/publish-status
Headers: x-webhook-secret: <N8N_CALLBACK_SECRET>

Body:
{
  "postId": "post-123",
  "status": "published" | "failed",
  "linkedinPostUrn": "urn:li:share:123",    // If published
  "error": "...",                            // If failed
  "callbackId": "n8n-exec-abc"               // For idempotency
}

Response:
- 200: Success
- 400: Invalid JSON/schema
- 401: Bad secret
- 404: Post doesn't exist
- 409: Invalid state (only publishing → published/failed allowed)
- 500: Database error
```

---

## 6. CONCURRENCY CONTROL

**Problem:** Two crons running simultaneously → both process same post?

**Solution:** Status transition IS the lock

```typescript
// Only ONE cron wins this:
const updated = await db.update(posts)
  .set({ status: "publishing" })
  .where(and(
    eq(posts.id, postId),
    eq(posts.status, "scheduled")  // ← Only if STILL scheduled
  ))
  .returning();

if (!updated[0]) {
  // Lost race - another cron already claimed it
  log("info", "Post already being processed");
  continue;
}
```

**No SELECT FOR UPDATE needed.** Status check is sufficient.

---

## 7. IDEMPOTENCY

```typescript
// Check 1: Has this exact callback been processed?
if (callbackId && db.select().where(eq(webhook_idempotency_key, callbackId))) {
  return 200;  // Idempotent
}

// Check 2: Is post already in target state with correct data?
if (post.status === "published" && post.linkedin_post_urn === linkedinPostUrn) {
  return 200;  // Idempotent
}

// Check 3: Is this a valid state transition?
if (post.status !== "publishing") {
  return 409;  // Invalid transition
}

// If all checks pass, update post
```

---

## 8. SECURITY

### Cron Secret
```bash
# Generate
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Store in .env
CRON_SECRET=a7f3d2e1c9b8a4f6e2d1c3b5a7f9e8d6c4b3a1f2e3d4c5b6a7f8e9d0c1b2a3

# Verify (ALWAYS use timing-safe comparison)
import { timingSafeEqual } from "crypto";

if (!timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))) {
  return 401;  // Unauthorized
}
```

### Webhook Secret
```bash
# Same process
N8N_CALLBACK_SECRET=b8e4c3d2f1a9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5

# Verify same way
if (!timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))) {
  return 401;  // Unauthorized
}
```

**Never:**
- Compare with `===` (timing attack risk)
- Log full secret
- Put in URL
- Commit to git

---

## 9. LOGGING

Every state change should log:

```typescript
log("info", "Post marked as publishing", {
  requestId,      // UUID for this request - correlate all logs
  postId,         // Which post
  userId,         // Who it affects
  scheduledAt: new Date(),
  retryCount: 0,
});

log("warn", "Stale post detected", {
  requestId,
  postId,
  stalinessMinutes: 5.2,
});

log("error", "Webhook failed", {
  requestId,
  postId,
  httpStatus: 500,
  error: "timeout",
  durationMs: 10001,
});
```

**Why?** Debugging is critical. LinkedIn API failures are mysterious.

---

## 10. ERROR HANDLING

```typescript
// Network timeout → reset to scheduled, increment retry
try {
  response = await fetch(url, { signal: AbortSignal.timeout(10000) });
} catch (timeout) {
  await incrementRetryCount(postId);
  await resetToScheduled(postId);
  log("warn", "Request timeout, will retry");
}

// HTTP error → reset to scheduled, increment retry
if (!response.ok) {
  await incrementRetryCount(postId);
  await resetToScheduled(postId);
  log("warn", "Webhook returned error", { status: response.status });
}

// Database error → fail webhook (don't retry)
if (updateError) {
  log("error", "Database error", { error });
  return 500;  // n8n will retry callback
}

// Invalid state → fail webhook (don't retry)
if (post.status !== "publishing") {
  return 409;  // n8n should not retry
}
```

---

## 11. MONITORING METRICS

Track these in your dashboard:

```typescript
// Daily metrics
{
  postsPublished: 42,
  postsFailed: 3,
  successRate: 93.3,
  avgRetries: 0.8,
  avgCallbackLatency: 2.1,  // seconds
  staleJobsDetected: 1,
  staleJobsRecovered: 1,
}

// Alert if:
- Success rate < 80% (last 24h)
- Posts stuck > 30 minutes
- Webhook failure rate > 20% (per hour)
- n8n unreachable (webhook returns 503)
```

---

## 12. CHECKLISTS

### Pre-Launch Checklist
- [ ] Exponential backoff implemented
- [ ] Audit table created with indexes
- [ ] Auto-recovery cron endpoint created
- [ ] Cron secret configured (32+ chars)
- [ ] Webhook secret configured (32+ chars)
- [ ] Both endpoints use timing-safe comparison
- [ ] All state changes logged
- [ ] Request IDs used for correlation
- [ ] Max retries = 5
- [ ] Timeout = 5 minutes
- [ ] Status transition prevents duplicates

### Ongoing Monitoring
- [ ] Check success rate daily (target: >90%)
- [ ] Check stuck jobs (should be 0)
- [ ] Check max retry count distribution
- [ ] Review error logs for patterns
- [ ] Verify cron runs every 60 seconds
- [ ] Verify recovery cron runs every 10 minutes
- [ ] Test manual recovery endpoint weekly

### Production Deployment
- [ ] Rotate secrets from dev
- [ ] Update n8n callback URL to production domain
- [ ] Configure cron schedule (Vercel/Railway/system cron)
- [ ] Set up monitoring/alerting
- [ ] Test end-to-end with real LinkedIn
- [ ] Test with multiple posts simultaneously
- [ ] Test recovery scenarios

---

## 13. COMMON PITFALLS

| Pitfall | Problem | Solution |
|---------|---------|----------|
| **Using `===` for secret comparison** | Timing attack | Use `timingSafeEqual()` |
| **Fixed retry delay** | Thundering herd | Use exponential backoff |
| **No audit trail** | Can't debug failures | Add audit table |
| **No timeout detection** | Stuck posts forever | 5 min timeout + recovery cron |
| **No idempotency** | Duplicate updates | Check callbackId + state |
| **SELECT FOR UPDATE** | Overkill, deadlocks | Just use status check |
| **No request IDs** | Can't correlate logs | Pass requestId through all calls |
| **Immediate retries** | Hammers failing service | Exponential backoff |
| **Retrying forever** | Wastes resources | Max 5 retries |
| **No logging** | Debugging nightmare | Log every state change |

---

## 14. FILE STRUCTURE

```
src/
├── app/
│   ├── api/
│   │   ├── cron/
│   │   │   ├── publish-scheduled/
│   │   │   │   └── route.ts          (NEW - main polling cron)
│   │   │   └── recover-stale-posts/
│   │   │       └── route.ts          (NEW - recovery cron)
│   │   ├── webhooks/
│   │   │   └── publish-status/
│   │   │       └── route.ts          (UPDATE - add audit recording)
│   │   └── posts/
│   │       └── recover/
│   │           └── route.ts          (EXISTING - manual recovery)
│   └── ...
├── lib/
│   ├── api/
│   │   ├── retry-strategy.ts         (NEW - exponential backoff)
│   │   ├── scheduler.ts              (EXISTING)
│   │   └── ...
│   ├── db/
│   │   ├── schema.ts                 (UPDATE - add audit table)
│   │   └── queries.ts                (UPDATE - add audit queries)
│   ├── logger.ts                     (EXISTING)
│   └── ...
└── ...
```

---

## 15. QUICK IMPLEMENTATION ORDER

1. **Add retry strategy helper** (retry-strategy.ts)
2. **Add audit table** (schema.ts migration)
3. **Add audit queries** (queries.ts)
4. **Create main cron** (publish-scheduled/route.ts)
5. **Create recovery cron** (recover-stale-posts/route.ts)
6. **Update webhook** (add audit recording)
7. **Test end-to-end**
8. **Deploy**
9. **Monitor**

---

## 16. ENVIRONMENT VARIABLES

```bash
# .env.local (dev)
CRON_SECRET=dev_secret_min_32_chars_12345678901234567890
N8N_WEBHOOK_URL=http://localhost:5678/webhook/linkie-claw
N8N_CALLBACK_SECRET=dev_callback_secret_12345678901234567890

# .env.example (committed)
CRON_SECRET=your-secure-random-secret-min-32-chars
N8N_WEBHOOK_URL=https://n8n.yourcompany.com/webhook/linkie-claw
N8N_CALLBACK_SECRET=your-webhook-secret-min-32-chars
```

---

## 17. TEST COMMANDS

```bash
# Test main cron
curl -H 'x-cron-secret: YOUR_CRON_SECRET' \
  http://localhost:3000/api/cron/publish-scheduled

# Test recovery cron
curl -H 'x-cron-secret: YOUR_CRON_SECRET' \
  http://localhost:3000/api/cron/recover-stale-posts

# Test webhook
curl -X POST http://localhost:3000/api/webhooks/publish-status \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: YOUR_WEBHOOK_SECRET' \
  -d '{
    "postId": "your-post-id",
    "status": "published",
    "linkedinPostUrn": "urn:li:share:123"
  }'

# Check database
sqlite3 ./dev.db "SELECT * FROM posts WHERE status = 'publishing';"
sqlite3 ./dev.db "SELECT * FROM post_publishing_audit ORDER BY created_at DESC LIMIT 10;"
```

---

## Key Takeaways

1. **Exponential backoff + jitter** prevents retry storms
2. **Status transition** prevents duplicate processing (no locks needed)
3. **Audit trail** enables debugging
4. **5-minute timeout** catches failures automatically
5. **Layered idempotency** prevents state corruption
6. **Structured logging** makes debugging possible
7. **Timing-safe comparison** prevents timing attacks
8. **No over-engineering** - all solutions are simple

---

## Further Reading

- Full best practices: `WEBHOOK_POLLING_BEST_PRACTICES.md`
- Implementation guide: `IMPLEMENTATION_GUIDE.md`
- Architecture decisions: `ARCHITECTURE_DECISIONS.md`
