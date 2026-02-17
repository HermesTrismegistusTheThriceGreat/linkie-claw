# Flow Diagrams: Visual Guide to Webhook + Polling Pattern

---

## 1. HAPPY PATH: Normal Publishing

```
User schedules post for 2:30 PM
         ↓
       [database: status = "scheduled", scheduled_at = 2:30 PM]
         ↓
Cron fires at 2:31 PM (60-second polling interval)
         ↓
Query: Find posts with status="scheduled" AND scheduled_at < now
         ↓
       [Found: post-123]
         ↓
Try to mark as publishing (atomic status update):
       UPDATE posts SET status="publishing" WHERE id="post-123" AND status="scheduled"
         ↓
       [Success! Post now "publishing"]
         ↓
Record attempt:
       INSERT INTO post_publishing_audit (post_id, attempt_number, status="sent")
         ↓
Fire webhook to n8n:
       POST https://n8n.com/webhook/linkie-claw
       { postId: "post-123", content: "...", ... }
         ↓
n8n succeeds (LinkedIn API call successful)
         ↓
n8n calls back:
       POST https://yourapp.com/api/webhooks/publish-status
       {
         postId: "post-123",
         status: "published",
         linkedinPostUrn: "urn:li:share:7654321",
         callbackId: "n8n-exec-abc123"
       }
         ↓
Webhook handler verifies secret (timing-safe comparison)
         ↓
Check idempotency: Is callbackId new? YES
         ↓
Check state: Is post "publishing"? YES
         ↓
Update post:
       UPDATE posts SET status="published", linkedin_post_urn="urn:li:share:7654321"
       WHERE id="post-123"
         ↓
Record success:
       INSERT INTO post_publishing_audit (post_id, attempt_number, status="success")
         ↓
Return 200 OK to n8n
         ↓
       [Post is now "published" - DONE!]
         ↓
User sees post published in UI ✓
```

---

## 2. RETRY PATH: Transient Failure

```
Cron fires, posts ready to publish:
       [posts: A, B, C]
         ↓
Process post A:
       - Mark as publishing ✓
       - Fire webhook to n8n
       - n8n returns 503 (service unavailable)
         ↓
       [FAILURE - reset for retry]
         ↓
Increment retry counter:
       UPDATE posts SET retry_count = retry_count + 1
         ↓
Reset to scheduled:
       UPDATE posts SET status = "scheduled"
         ↓
Record failure:
       INSERT INTO post_publishing_audit
       (post_id, status="failed", error="n8n 503", response_time_ms=250)
         ↓
Log warning with request ID (for correlation):
       log("warn", "Webhook failed", {
         requestId: "req-xyz",
         postId: "A",
         status: 503,
         error: "Service Unavailable"
       })
         ↓
Next cron run (60 seconds later):
       [post A is back to "scheduled", retry_count=1]
         ↓
Query finds it again (retry_count < MAX_RETRIES):
       SELECT * FROM posts
       WHERE status="scheduled" AND scheduled_at < now AND retry_count < 5
         ↓
Retry exponential backoff timing:
       Attempt 1 failed → Next retry at 2s delay
       Attempt 2 (60s later) → Gets picked up by cron
       Attempt 3 → Mark publishing, fire n8n
       n8n succeeds! ✓
         ↓
       [Success after retry]
```

**Timeline with exponential backoff:**
```
Attempt 1: T=0s   - Fire, get 503, reset
Attempt 2: T=60s  - Fire (next cron cycle), timeout, reset
Attempt 3: T=120s - Fire, n8n says "4s delay then retry"
Attempt 4: T=130s - Fire (after 4s delay we scheduled)
           → Success! ✓
```

---

## 3. STALE JOB RECOVERY PATH

```
Cron fires at T=0s:
       post-123: "scheduled" → mark as "publishing"
         ↓
Fire webhook to n8n
       n8n receives request, starts processing...
         ↓
n8n crashes (or hangs indefinitely)
         ↓
Webhook callback NEVER arrives
         ↓
       [post-123 stuck in "publishing"]
         ↓
Time passes... T=60s, T=120s, T=180s, T=240s, T=300s
         ↓
Recovery cron fires (every 10 minutes):
       SELECT * FROM posts
       WHERE status = "publishing"
       AND updated_at < (now - 5 minutes)
       AND retry_count < 5
         ↓
       [Found: post-123, updated_at = 5+ minutes ago]
         ↓
Auto-recovery: Reset to scheduled
       UPDATE posts SET status="scheduled", scheduled_at=now
         ↓
Log warning:
       log("warn", "Auto-recovering stale post", {
         requestId,
         postId: "post-123",
         stalinessMinutes: 5.2
       })
         ↓
Next main cron run (60 seconds):
       [post-123 is back to "scheduled"]
         ↓
Query finds it again:
       Retry as normal ↑ (see retry path)
```

**Stale detection timeline:**
```
T=0s:     Marked as publishing
T=60s:    Main cron, post still publishing (waiting for callback)
T=120s:   Main cron, post still publishing
T=300s:   Recovery cron fires, detects staleness (5+ min)
T=310s:   Recovery cron resets to scheduled
T=360s:   Main cron picks it up again, retries
```

---

## 4. CONCURRENCY CONTROL: Two Crons Racing

```
Timeline: Two cron instances running simultaneously

Instance A (T=0s)             Instance B (T=0.5s)
  │                             │
  ├─ SELECT posts               │
  │  WHERE status="scheduled"   │
  │  AND scheduled_at < now     │
  │  → Returns [post-123]       │
  │                             ├─ SELECT posts
  │                             │  WHERE status="scheduled"
  │                             │  AND scheduled_at < now
  │                             │  → Also returns [post-123]
  │                             │
  ├─ Try UPDATE post-123:      │
  │  SET status="publishing"   │
  │  WHERE id="post-123"       │
  │  AND status="scheduled" ← ATOMIC
  │  → SUCCESS (1 row updated)
  │                             ├─ Try UPDATE post-123:
  │                             │  SET status="publishing"
  │                             │  WHERE id="post-123"
  │                             │  AND status="scheduled"
  │                             │  → FAILS (0 rows updated)
  │                             │     (post already "publishing")
  ├─ Fire webhook to n8n      │
  │                             ├─ Skip this post
  │                             │  (already being processed)
  │                             │
  ├─ Webhook returns success   │
  │                             └─ Continue with next post
  │
  └─ Update post to published

Result: post-123 processed ONCE by Instance A
        No duplicates, no race condition ✓
```

**Why it works:**

The WHERE clause `AND status="scheduled"` is **atomic**:
- Only ONE instance can satisfy this condition
- Other instances get empty result
- Database guarantees atomicity

---

## 5. IDEMPOTENCY: Duplicate Webhook Callbacks

```
T=0s:  n8n sends callback:
       POST /api/webhooks/publish-status
       {
         postId: "post-123",
         status: "published",
         linkedinPostUrn: "urn:li:share:7654321",
         callbackId: "n8n-exec-abc123"
       }
         ↓
       [Server receives, returns 200]
         ↓
T=1s:  Network timeout on client side
       n8n doesn't see 200, retries
         ↓
       Same callback sent again (n8n is idempotent)
         ↓
Webhook handler receives same data again:

       Check 1: Is callbackId new?
       → No, webhook_idempotency_key="n8n-exec-abc123" exists
       → Return 200 immediately (idempotent)
         ↓
       [No update to database, no duplicate processing]
         ↓
T=2s:  Another retry (network still flaky):

       Same data again
         ↓
       Check 1: callbackId already exists?
       → Yes → Return 200 (idempotent)
         ↓
       [Still safe, still no duplicates]
         ↓
Result: Post updated ONCE despite 3 callbacks ✓
```

**Three layers of idempotency protection:**

```
Layer 1: Check callbackId
  └─ If same callbackId: return 200
     [Protects against immediate retries]

Layer 2: Check state match
  └─ If post already published with same URN: return 200
     [Protects if callbackId lost]

Layer 3: State validation
  └─ If post not "publishing": return 409
     [Prevents out-of-order state changes]
```

---

## 6. ERROR SCENARIOS: Various Failures

```
Scenario A: n8n times out
┌─────────────────────────────────────────┐
│ Cron fires webhook                      │
│ Wait 10 seconds...                      │
│ → Request timeout (AbortSignal.timeout) │
│ → Increment retry_count                 │
│ → Reset to scheduled                    │
│ → Log error                             │
│ → Continue with next post               │
│                                         │
│ Result: Auto-retry on next cron ✓      │
└─────────────────────────────────────────┘

Scenario B: n8n returns HTTP 500
┌─────────────────────────────────────────┐
│ Cron fires webhook                      │
│ → response.ok = false (500)             │
│ → Increment retry_count                 │
│ → Reset to scheduled                    │
│ → Log error with HTTP status            │
│ → Continue with next post               │
│                                         │
│ Result: Auto-retry on next cron ✓      │
└─────────────────────────────────────────┘

Scenario C: n8n never calls back
┌─────────────────────────────────────────┐
│ Cron fires webhook to n8n               │
│ → response 200, n8n accepted task       │
│ → But n8n crashes before callback       │
│ → Callback NEVER arrives                │
│ → Post stuck in "publishing"            │
│                                         │
│ 5 minutes later:                        │
│ Recovery cron detects staleness         │
│ → Reset to scheduled                    │
│ → Log warning                           │
│                                         │
│ Next cron cycle:                        │
│ → Retry as normal                       │
│                                         │
│ Result: Auto-recovered after 5 min ✓   │
└─────────────────────────────────────────┘

Scenario D: Database error on update
┌─────────────────────────────────────────┐
│ Webhook callback arrives                │
│ → Verify secret ✓                       │
│ → Verify idempotency ✓                  │
│ → Verify state ✓                        │
│ → Try to update database                │
│ → DatabaseError: connection lost!       │
│ → Return 500 (don't return 200)         │
│                                         │
│ n8n sees 500, retries later             │
│ → Next attempt succeeds                 │
│                                         │
│ Result: Safe retry by n8n ✓             │
└─────────────────────────────────────────┘
```

---

## 7. COMPLETE STATE MACHINE

```
                    ┌─────────────────────────────┐
                    │         DRAFT               │
                    │                             │
                    │  User editing post          │
                    │  Not scheduled yet          │
                    └──────────┬──────────────────┘
                               │
                               │ User clicks "Schedule"
                               ↓
                    ┌─────────────────────────────┐
                    │      SCHEDULED              │
                    │                             │
                    │  Post is ready              │
                    │  Waiting for scheduled time │
                    │  In: posts table            │
                    │  retry_count: 0             │
                    └──────────┬──────────────────┘
                               │
                               │ Time reached, cron fires
                               │ Atomic status transition
                               ↓
                    ┌─────────────────────────────┐
                    │    PUBLISHING               │
                    │                             │
                    │  Webhook fired to n8n       │
                    │  Waiting for callback       │
                    │  updated_at: now            │
                    │  retry_count: 0             │
                    └──────┬──────────┬───────────┘
                           │          │
         ┌─────────────────┘          └──────────────────┐
         │                                               │
         │ Callback: "published"                  Timeout > 5 min
         │ (success from LinkedIn)                (no callback)
         │                                        │
         │                          ┌──────────────┘
         ↓                          ↓
┌─────────────────────┐  ┌─────────────────────────┐
│   PUBLISHED         │  │   RECOVERY CRON FIRES   │
│                     │  │   Detects staleness     │
│ LinkedIn post URN   │  │                         │
│ published_at: now   │  └──────────┬──────────────┘
│                     │             │
│ TERMINAL STATE      │             │ Reset to scheduled
│ (no more changes)   │             ↓
└─────────────────────┘  ┌──────────────────────────────┐
                         │ Back to SCHEDULED             │
      ┌──────────────────┤ (retries as normal above) ↑  │
      │                  │                               │
      │ OR               │ scheduled_at: now             │
      │                  │ retry_count: incremented      │
      │                  └───────────────────────────────┘
      │
      │ Callback: "failed"
      │ (error from LinkedIn)
      │
      ↓
┌─────────────────────┐
│     FAILED          │
│                     │
│ LinkedIn error      │
│ error_message: "..."│
│                     │
│ User can manually   │
│ retry via UI        │
└─────────────────────┘
      │
      │ User clicks "Retry"
      │
      ↓
┌──────────────────────────────────────┐
│ Back to SCHEDULED                    │
│ (manual recovery endpoint)           │
│                                      │
│ Retries as normal (see above) ↑     │
└──────────────────────────────────────┘
```

---

## 8. EXPONENTIAL BACKOFF TIMELINE

```
Attempt 1 (T=0s):  Fire webhook → Timeout
                   Reset to scheduled

Attempt 2 (T=60s): Main cron runs
                   Fire webhook → HTTP 500
                   Reset to scheduled
                   Delay calculated: 2s

Attempt 3 (T=120s): Main cron runs
                    Fire webhook → HTTP 503
                    Reset to scheduled
                    Delay calculated: 4s

Attempt 4 (T=180s): Main cron runs
                    Fire webhook → HTTP 500
                    Reset to scheduled
                    Delay calculated: 8s

Attempt 5 (T=240s): Main cron runs
                    Fire webhook → HTTP 500
                    Reset to scheduled
                    Delay calculated: 16s

Attempt 6 (T=300s): Main cron runs
                    Fire webhook → SUCCESS! ✓

Result: After 300 seconds (5 minutes), post published
        Thanks to exponential backoff recovery pattern

Contrast with fixed delay:
If we always waited 10 seconds:
  Attempt 1: T=10s
  Attempt 2: T=20s
  Attempt 3: T=30s
  Attempt 4: T=40s
  Attempt 5: T=50s
  Result: Same attempts, but with fixed 10s delays
          Would hit 50s just to fail 5 times (inefficient)
```

---

## 9. DATABASE WRITES: What Changes When

```
Initial state:
┌──────────────────────────────────────────┐
│ posts table                              │
├──────────────────────────────────────────┤
│ id: "post-123"                           │
│ status: "scheduled"                      │
│ retry_count: 0                           │
│ error_message: NULL                      │
│ updated_at: 2026-02-12 14:20:00         │
└──────────────────────────────────────────┘

After cron marks as publishing:
┌──────────────────────────────────────────┐
│ posts table                              │
├──────────────────────────────────────────┤
│ id: "post-123"                           │
│ status: "publishing" ← CHANGED           │
│ retry_count: 0                           │
│ error_message: NULL                      │
│ updated_at: 2026-02-12 14:21:00 ← CHANGED
└──────────────────────────────────────────┘

│ post_publishing_audit table              │
├──────────────────────────────────────────┤
│ post_id: "post-123"                      │
│ attempt_number: 1                        │
│ status: "sent"                           │
│ created_at: 2026-02-12 14:21:00         │
└──────────────────────────────────────────┘

After webhook callback succeeds:
┌──────────────────────────────────────────┐
│ posts table                              │
├──────────────────────────────────────────┤
│ id: "post-123"                           │
│ status: "published" ← CHANGED            │
│ retry_count: 0                           │
│ linkedin_post_urn: "urn:li:share:7654321"← NEW
│ error_message: NULL                      │
│ published_at: 2026-02-12 14:21:03 ← NEW  │
│ updated_at: 2026-02-12 14:21:03 ← CHANGED
└──────────────────────────────────────────┘

│ post_publishing_audit table              │
├──────────────────────────────────────────┤
│ post_id: "post-123"                      │
│ attempt_number: 1                        │
│ status: "success" ← CHANGED              │
│ response_time_ms: 2800                   │
│ created_at: 2026-02-12 14:21:03 ← CHANGED
└──────────────────────────────────────────┘
```

---

## 10. LOGGING CORRELATION: Request ID Trail

```
User schedules post via UI:
  RequestID: user-req-001
  log("info", "Post scheduled", { postId: "post-123" })

Cron runs (60 seconds later):
  RequestID: cron-req-042
  log("info", "Polling for posts", { count: 5 })
  log("info", "Post marked as publishing", { postId: "post-123" })
  log("info", "Webhook fired", { durationMs: 245 })

n8n processes, calls back:
  RequestID: webhook-callback-789
  log("info", "Webhook callback received", { postId: "post-123" })
  log("info", "Post status updated", { newStatus: "published" })

User views analytics:
  RequestID: user-req-043
  log("info", "Fetching dashboard data")
  → Shows: post-123 is published ✓

All events traceable by post ID:
  SELECT * FROM logs WHERE postId = "post-123"
  → Shows complete timeline from scheduling through publishing

For debugging a specific issue:
  User: "Why didn't my post publish?"
  You: "Let me check post-123..."
    1. User scheduled it (user-req-001)
    2. Cron picked it up (cron-req-042)
    3. Webhook fired (durationMs: 245)
    4. Callback received (webhook-callback-789)
    5. Status updated to published
  You: "It published successfully! Check if the LinkedIn API changed..."
```

---

## Key Insights

1. **State machine is everything** - All logic follows the state
2. **Atomicity prevents duplicates** - Status check in WHERE clause
3. **Audit trail enables debugging** - Every attempt recorded
4. **Timeout detection is simple** - Just check updated_at timestamp
5. **Idempotency has layers** - Each layer handles different scenario
6. **Exponential backoff spreads load** - Not all retries at once
7. **Logging with request IDs** - Traceable across services
8. **No distributed locks needed** - Status transitions are sufficient
