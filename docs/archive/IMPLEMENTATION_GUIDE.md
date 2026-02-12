# Implementation Guide: Applying Best Practices to Linkie Claw

This guide shows how to implement the recommendations from `WEBHOOK_POLLING_BEST_PRACTICES.md` into your Next.js app.

## Quick Reference: What Exists vs. What's Missing

### Already Implemented ✅
- Basic polling query (`getPostsReadyToPublish`)
- Status transition (scheduled → publishing)
- Webhook callback with validation
- Retry count in DB
- Structured logging
- Manual recovery endpoint
- Secret verification (timing-safe)
- Idempotency check (by state)

### Missing (High Priority) 🔴
- Exponential backoff calculation
- Audit trail table for retry history
- Auto-recovery cron endpoint
- Stale job detection + recovery (only in UI, should be automatic)

### Missing (Nice-to-Have) 🟡
- HMAC webhook signing
- Rate limiting on webhook
- Comprehensive metrics dashboard
- Alert monitoring

---

## STEP 1: Add Audit Trail Table

**File: `src/lib/db/schema.ts`**

```typescript
// Add this after the posts table definition

export const postPublishingAudit = sqliteTable(
  "post_publishing_audit",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
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
    createdAtIdx: index("audit_created_at_idx").on(table.created_at),
  })
);

// Add type export
export type PostPublishingAudit = typeof postPublishingAudit.$inferSelect;
export type NewPostPublishingAudit = typeof postPublishingAudit.$inferInsert;
```

**Then run migration:**
```bash
npm run db:generate  # Creates migration
npm run db:push     # Applies to database
```

---

## STEP 2: Add Retry Calculation Helper

**File: `src/lib/api/retry-strategy.ts`** (NEW)

```typescript
/**
 * Exponential backoff with jitter for webhook retries
 *
 * Formula: delay = min(initial * 2^attempt, max)
 * With jitter: delay ± 10% random
 *
 * Timeline (5 retries):
 * - Attempt 0: 1s ± 100ms
 * - Attempt 1: 2s ± 200ms
 * - Attempt 2: 4s ± 400ms
 * - Attempt 3: 8s ± 800ms
 * - Attempt 4: 16s ± 1.6s
 * Total: ~31 seconds of retries
 */

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,      // 1 second
  maxDelayMs: 32000,         // 32 seconds
  jitter: true,
};

/**
 * Calculate delay for a given retry attempt
 * @param attemptNumber - 0-based attempt number
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Exponential: 1s, 2s, 4s, 8s, 16s, 32s...
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(2, attemptNumber),
    config.maxDelayMs
  );

  // Add jitter: ±10%
  if (config.jitter) {
    const jitterPercent = 0.1;
    const jitterRange = exponentialDelay * jitterPercent;
    const randomJitter = Math.random() * jitterRange * 2 - jitterRange;
    return Math.max(0, exponentialDelay + randomJitter);
  }

  return exponentialDelay;
}

/**
 * Check if we should retry based on attempt count
 */
export function shouldRetry(
  attemptNumber: number,
  maxRetries: number = DEFAULT_RETRY_CONFIG.maxRetries
): boolean {
  return attemptNumber < maxRetries;
}

/**
 * Format retry information for logging
 */
export function formatRetryInfo(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): string {
  const delay = calculateBackoffDelay(attemptNumber, config);
  const shouldContinue = shouldRetry(attemptNumber, config.maxRetries);

  return `Attempt ${attemptNumber + 1}/${config.maxRetries + 1}, ` +
         `next retry in ${(delay / 1000).toFixed(1)}s, ` +
         `will ${shouldContinue ? "retry" : "NOT retry"}`;
}
```

**Usage example:**
```typescript
import { calculateBackoffDelay, formatRetryInfo } from "@/lib/api/retry-strategy";

// In your webhook retry logic:
const attemptNumber = post.retry_count;
if (shouldRetry(attemptNumber)) {
  const delayMs = calculateBackoffDelay(attemptNumber);
  log("info", "Scheduling retry", {
    postId,
    retryInfo: formatRetryInfo(attemptNumber),
  });
  // Schedule retry after delayMs
}
```

---

## STEP 3: Add Audit Trail Queries

**File: `src/lib/db/queries.ts`** (Add these functions)

```typescript
import { postPublishingAudit } from "@/lib/db/schema";
import type { NewPostPublishingAudit } from "@/lib/db/schema";

/**
 * Record a publishing attempt in the audit trail
 */
export async function recordPublishAttempt(
  postId: string,
  status: "queued" | "sent" | "success" | "failed" | "timeout",
  errorCode?: string,
  errorMessage?: string,
  responseTimeMs?: number
) {
  // Get current retry count before incrementing
  const postResult = await db
    .select({ retry_count: posts.retry_count })
    .from(posts)
    .where(eq(posts.id, postId));

  const currentRetryCount = postResult[0]?.retry_count ?? 0;

  await db.insert(postPublishingAudit).values({
    post_id: postId,
    attempt_number: currentRetryCount + 1,
    status,
    error_code: errorCode,
    error_message: errorMessage,
    response_time_ms: responseTimeMs,
  });
}

/**
 * Get publishing history for a post
 */
export async function getPublishingHistory(
  postId: string,
  limit: number = 10
) {
  return db
    .select()
    .from(postPublishingAudit)
    .where(eq(postPublishingAudit.post_id, postId))
    .orderBy(desc(postPublishingAudit.created_at))
    .limit(limit);
}

/**
 * Get statistics for a post's publishing attempts
 */
export async function getPublishingStats(postId: string) {
  const attempts = await db
    .select({
      status: postPublishingAudit.status,
      count: sql<number>`COUNT(*)`,
      avgResponseTime: sql<number>`AVG(${postPublishingAudit.response_time_ms})`,
    })
    .from(postPublishingAudit)
    .where(eq(postPublishingAudit.post_id, postId))
    .groupBy(postPublishingAudit.status);

  const totalAttempts = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(postPublishingAudit)
    .where(eq(postPublishingAudit.post_id, postId));

  return {
    totalAttempts: totalAttempts[0]?.count ?? 0,
    byStatus: attempts,
  };
}

/**
 * Get posts with failed publishing attempts in last N hours
 */
export async function getRecentPublishingFailures(
  hours: number = 24
) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  return db
    .select({
      postId: postPublishingAudit.post_id,
      failureCount: sql<number>`COUNT(*)`,
      lastFailure: sql<string>`MAX(${postPublishingAudit.created_at})`,
      lastError: sql<string>`(SELECT ${postPublishingAudit.error_message}
                               FROM ${postPublishingAudit}
                               WHERE post_id = ${postPublishingAudit.post_id}
                               ORDER BY created_at DESC LIMIT 1)`,
    })
    .from(postPublishingAudit)
    .where(
      and(
        eq(postPublishingAudit.status, "failed"),
        gte(postPublishingAudit.created_at, cutoff)
      )
    )
    .groupBy(postPublishingAudit.post_id);
}
```

---

## STEP 4: Create Auto-Recovery Cron Endpoint

**File: `src/app/api/cron/recover-stale-posts/route.ts`** (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getStalePublishingPosts, updatePost } from "@/lib/db/queries";
import { log } from "@/lib/logger";

/**
 * GET /api/cron/recover-stale-posts
 *
 * Auto-recovers posts stuck in "publishing" state for too long.
 * Resets them to "scheduled" so the main cron can retry.
 *
 * Should run every 10 minutes.
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Verify cron secret
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
    log("warn", "Unauthorized cron request", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    log("info", "Cron: Starting stale job recovery", { requestId });

    const stalePosts = await getStalePublishingPosts();

    if (stalePosts.length === 0) {
      log("info", "Cron: No stale posts found", { requestId });
      return NextResponse.json({ success: true, recovered: 0 });
    }

    log("warn", "Cron: Found stale posts", {
      requestId,
      count: stalePosts.length,
      postIds: stalePosts.map(p => p.id),
    });

    let recovered = 0;
    let failed = 0;

    for (const post of stalePosts) {
      try {
        const stalenessMs = Date.now() - post.updated_at.getTime();
        const stalenessMinutes = (stalenessMs / 1000 / 60).toFixed(1);

        log("warn", "Auto-recovering stale post", {
          requestId,
          postId: post.id,
          stalenessMinutes: `${stalenessMinutes}m`,
          retryCount: post.retry_count,
        });

        // Reset to scheduled for retry
        const updated = await updatePost(
          post.id,
          {
            status: "scheduled",
            scheduled_at: new Date(),
          },
          post.user_id
        );

        if (updated) {
          recovered++;
          log("info", "Post recovered", {
            requestId,
            postId: post.id,
            action: "reset_to_scheduled",
          });
        } else {
          failed++;
          log("warn", "Failed to recover post (already deleted?)", {
            requestId,
            postId: post.id,
          });
        }
      } catch (error) {
        failed++;
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
      failed,
      total: stalePosts.length,
    });

    return NextResponse.json({
      success: true,
      recovered,
      failed,
      total: stalePosts.length,
    });
  } catch (error) {
    log("error", "Cron: Recovery job failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}
```

---

## STEP 5: Enhance Main Cron with Audit Recording

**File: `src/app/api/cron/publish-scheduled/route.ts`** (Need to create - this doesn't exist yet!)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  getPostsReadyToPublish,
  markPostAsPublishing,
  updatePost,
  recordPublishAttempt,
  incrementPostRetryCount,
} from "@/lib/db/queries";
import { log } from "@/lib/logger";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

/**
 * GET /api/cron/publish-scheduled
 *
 * Main polling cron job - runs every 60 seconds
 * Finds posts ready to publish and fires them to n8n
 *
 * State transitions:
 *   scheduled → publishing (atomic)
 *   publishing → (waits for webhook callback)
 *   publishing → published (via /api/webhooks/publish-status)
 *   publishing → failed (via /api/webhooks/publish-status or timeout recovery)
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // Verify cron secret with timing-safe comparison
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
    log("warn", "Unauthorized cron request", {
      requestId,
      ip: request.headers.get("x-forwarded-for") || "unknown",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    log("info", "Cron: Polling for posts to publish", { requestId });

    // Find all posts that are due and below retry limit
    const postsToProcess = await getPostsReadyToPublish();

    if (postsToProcess.length === 0) {
      log("info", "Cron: No posts ready to publish", { requestId });
      return NextResponse.json({
        success: true,
        processed: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
      });
    }

    log("info", "Cron: Found posts to process", {
      requestId,
      count: postsToProcess.length,
      postIds: postsToProcess.map(p => p.id),
    });

    let processed = 0;
    let failed = 0;

    // Process each post
    for (const post of postsToProcess) {
      try {
        // ATOMIC: Only transition if still "scheduled"
        // This prevents duplicate processing if cron runs concurrently
        const marked = await markPostAsPublishing(post.id);

        if (!marked) {
          // Another cron instance already claimed this post
          log("info", "Post already claimed by another cron", {
            requestId,
            postId: post.id,
          });
          continue;
        }

        log("info", "Post marked as publishing", {
          requestId,
          postId: post.id,
          userId: post.user_id,
          scheduledAt: post.scheduled_at,
          retryCount: post.retry_count,
        });

        // Record audit: queued
        await recordPublishAttempt(post.id, "queued");

        // Fire to n8n
        const fireStart = Date.now();

        let response: Response;
        try {
          response = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId: post.id,
              content: post.content,
              imageUrl: post.image_url,
              // TODO: get actual LinkedIn URN from user settings
              linkedinPersonUrn: post.user_id,
              scheduledAt: post.scheduled_at?.toISOString(),
            }),
            signal: AbortSignal.timeout(10000),  // 10 second timeout
          });
        } catch (timeoutError) {
          const durationMs = Date.now() - fireStart;

          log("warn", "Webhook request timeout", {
            requestId,
            postId: post.id,
            durationMs,
            error: timeoutError instanceof Error ? timeoutError.message : String(timeoutError),
          });

          // Record attempt
          await recordPublishAttempt(
            post.id,
            "timeout",
            "RequestTimeout",
            "Webhook request timed out after 10 seconds",
            durationMs
          );

          // Increment retry counter, reset to scheduled for retry
          await incrementPostRetryCount(post.id);
          await updatePost(
            post.id,
            { status: "scheduled", updated_at: new Date() },
            post.user_id
          );

          failed++;
          continue;
        }

        const fireDurationMs = Date.now() - fireStart;

        if (!response.ok) {
          const errorText = await response.text();

          log("warn", "Webhook failed", {
            requestId,
            postId: post.id,
            status: response.status,
            durationMs: fireDurationMs,
            errorText: errorText.substring(0, 500),  // Limit error text length
          });

          // Record attempt
          await recordPublishAttempt(
            post.id,
            "failed",
            `HTTP${response.status}`,
            errorText.substring(0, 500),
            fireDurationMs
          );

          // Increment retry counter, reset to scheduled for retry
          await incrementPostRetryCount(post.id);
          await updatePost(
            post.id,
            { status: "scheduled", updated_at: new Date() },
            post.user_id
          );

          failed++;
          continue;
        }

        // Success - webhook accepted the request
        // (it will call back via /api/webhooks/publish-status)

        log("info", "Webhook fired successfully", {
          requestId,
          postId: post.id,
          durationMs: fireDurationMs,
        });

        // Record attempt
        await recordPublishAttempt(
          post.id,
          "sent",
          undefined,
          undefined,
          fireDurationMs
        );

        processed++;

      } catch (error) {
        failed++;

        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorCode = error instanceof Error ? error.constructor.name : "UnknownError";

        log("error", "Failed to process post", {
          requestId,
          postId: post.id,
          error: errorMsg,
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Record attempt
        try {
          await recordPublishAttempt(
            post.id,
            "failed",
            errorCode,
            errorMsg.substring(0, 500)
          );
        } catch (auditError) {
          log("error", "Failed to record audit entry", {
            requestId,
            postId: post.id,
            auditError: auditError instanceof Error ? auditError.message : String(auditError),
          });
        }

        // Increment retry, reset to scheduled
        try {
          await incrementPostRetryCount(post.id);
          await updatePost(
            post.id,
            { status: "scheduled", updated_at: new Date() },
            post.user_id
          );
        } catch (updateError) {
          log("error", "Failed to reset post to scheduled", {
            requestId,
            postId: post.id,
            error: updateError instanceof Error ? updateError.message : String(updateError),
          });
        }
      }
    }

    const totalDuration = Date.now() - startTime;

    log("info", "Cron: Complete", {
      requestId,
      processed,
      failed,
      total: postsToProcess.length,
      durationMs: totalDuration,
    });

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: postsToProcess.length,
      durationMs: totalDuration,
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;

    log("error", "Cron: Job failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: totalDuration,
    });

    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
```

---

## STEP 6: Configure Cron Schedules

**For Vercel (if using):**

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/publish-scheduled",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/cron/recover-stale-posts",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**For Railway (recommended for self-hosted):**

Add to `docker-compose.yml`:
```yaml
services:
  app:
    # ... existing config ...

  cron:
    image: node:20-alpine
    entrypoint: sh
    command: |
      -c "
      while true; do
        echo '[CRON] Running publish-scheduled...'
        curl -s -H 'x-cron-secret: $CRON_SECRET' \
          'http://app:3000/api/cron/publish-scheduled' \
          >> /var/log/cron.log 2>&1

        sleep 60

        echo '[CRON] Running recover-stale-posts...'
        curl -s -H 'x-cron-secret: $CRON_SECRET' \
          'http://app:3000/api/cron/recover-stale-posts' \
          >> /var/log/cron.log 2>&1

        sleep 540  # 9 minutes, so total cycle is 10 minutes
      done
      "
    environment:
      CRON_SECRET: ${CRON_SECRET}
    depends_on:
      - app
    volumes:
      - cron-logs:/var/log

volumes:
  cron-logs:
```

**For simple system cron (Linux/Mac):**

```bash
# crontab -e
# Every minute - main publishing cron
* * * * * curl -H 'x-cron-secret: YOUR_CRON_SECRET' https://yourapp.com/api/cron/publish-scheduled

# Every 10 minutes - recovery cron
*/10 * * * * curl -H 'x-cron-secret: YOUR_CRON_SECRET' https://yourapp.com/api/cron/recover-stale-posts
```

---

## STEP 7: Update Webhook Handler (Minor Enhancement)

**File: `src/app/api/webhooks/publish-status/route.ts`** (Existing file - add audit recording)

Replace the success update section:

```typescript
  try {
    // Update post status
    let updated;
    const userId = existingPost.user_id;

    if (status === "published") {
      updated = await updatePost(postId, {
        status: "published",
        linkedin_post_urn: linkedinPostUrn ?? null,
        published_at: new Date(),
      }, userId);
    } else {
      updated = await updatePost(postId, {
        status: "failed",
        error_message: error ?? "Unknown publishing error",
      }, userId);
    }

    if (!updated) {
      log("warn", "Post was deleted during status update", {
        requestId,
        postId,
      });
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Record in audit trail
    try {
      await recordPublishAttempt(
        postId,
        status === "published" ? "success" : "failed",
        undefined,
        error ? (typeof error === "string" ? error : JSON.stringify(error).substring(0, 500)) : undefined
      );
    } catch (auditError) {
      log("warn", "Failed to record audit entry", {
        requestId,
        postId,
        auditError: auditError instanceof Error ? auditError.message : String(auditError),
      });
      // Don't fail the webhook over audit recording failure
    }

    log("info", "Post status updated via webhook", {
      requestId,
      postId,
      status,
      callbackDurationMs: Date.now() - new Date(requestId).getTime(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    // ... existing error handling ...
  }
```

---

## STEP 8: Add to Environment Variables

**File: `.env.example`**

Add/update:
```bash
# Cron scheduling
CRON_SECRET=your-secure-random-secret-here-min-32-chars

# n8n integration
N8N_WEBHOOK_URL=https://n8n.yourcompany.com/webhook/linkie-claw
N8N_CALLBACK_SECRET=your-webhook-secret-here-min-32-chars

# Optional: Slack/Email alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**For development (`.env.local`):**
```bash
CRON_SECRET=dev_cron_secret_12345678901234567890
N8N_WEBHOOK_URL=http://localhost:5678/webhook/linkie-claw
N8N_CALLBACK_SECRET=dev_webhook_secret_12345678901234
```

**Generate strong secrets:**
```bash
# Generate 32-byte (256-bit) secrets
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('N8N_CALLBACK_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

---

## STEP 9: Testing Checklist

### Manual Testing

```bash
# 1. Start dev server
npm run dev

# 2. Create a test post and schedule it for ~30 seconds from now
# Use the UI or curl:
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION" \
  -d '{
    "content": "Test post",
    "scheduledAt": "'$(date -d '+30 seconds' --iso-8601=seconds)'"
  }'

# 3. Manually trigger cron (wait 60+ seconds)
curl -H 'x-cron-secret: dev_cron_secret_12345678901234567890' \
  http://localhost:3000/api/cron/publish-scheduled

# 4. Check logs - should see:
# - "Polling for posts to publish"
# - "Found posts to process"
# - "Post marked as publishing"
# - "Webhook fired successfully"

# 5. Check database:
sqlite3 ./dev.db "SELECT id, status, retry_count FROM posts WHERE content LIKE 'Test%';"

# 6. Check audit trail:
sqlite3 ./dev.db "SELECT * FROM post_publishing_audit ORDER BY created_at DESC LIMIT 5;"

# 7. Test recovery cron:
curl -H 'x-cron-secret: dev_cron_secret_12345678901234567890' \
  http://localhost:3000/api/cron/recover-stale-posts

# 8. Simulate webhook callback:
curl -X POST http://localhost:3000/api/webhooks/publish-status \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: dev_webhook_secret_12345678901234" \
  -d '{
    "postId": "YOUR_POST_ID",
    "status": "published",
    "linkedinPostUrn": "urn:li:share:123456"
  }'

# 9. Verify post status updated:
sqlite3 ./dev.db "SELECT id, status, published_at, linkedin_post_urn FROM posts WHERE id = 'YOUR_POST_ID';"
```

### Database Verification

```bash
# Check schema created correctly
sqlite3 ./dev.db ".schema post_publishing_audit"

# Check indexes
sqlite3 ./dev.db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='post_publishing_audit';"

# Monitor audit trail growth
sqlite3 ./dev.db "SELECT COUNT(*) as audit_entries FROM post_publishing_audit;"

# Check retry distribution
sqlite3 ./dev.db "SELECT retry_count, COUNT(*) FROM posts GROUP BY retry_count;"
```

### Automated Testing (Optional)

```typescript
// src/__tests__/cron.test.ts
import { calculateBackoffDelay, shouldRetry, formatRetryInfo } from "@/lib/api/retry-strategy";

describe("Retry Strategy", () => {
  it("calculates exponential backoff", () => {
    expect(calculateBackoffDelay(0)).toBeLessThan(1200);  // ~1s ± 10%
    expect(calculateBackoffDelay(1)).toBeLessThan(2200);  // ~2s ± 10%
    expect(calculateBackoffDelay(4)).toBeLessThan(17600); // ~16s ± 10%
  });

  it("respects max retries", () => {
    expect(shouldRetry(0, 5)).toBe(true);
    expect(shouldRetry(4, 5)).toBe(true);
    expect(shouldRetry(5, 5)).toBe(false);
  });

  it("formats retry info", () => {
    const info = formatRetryInfo(0);
    expect(info).toContain("Attempt 1");
    expect(info).toContain("will retry");
  });
});
```

---

## STEP 10: Monitoring & Observability

### View Publishing Metrics

**Create a dashboard page (optional):**

```typescript
// src/app/api/debug/cron-metrics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, postPublishingAudit } from "@/lib/db/schema";
import { eq, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Posts by status
  const postsByStatus = await db
    .select({
      status: posts.status,
      count: db.sql<number>`COUNT(*)`,
    })
    .from(posts)
    .groupBy(posts.status);

  // Recent attempts
  const attempts = await db
    .select({
      status: postPublishingAudit.status,
      count: db.sql<number>`COUNT(*)`,
    })
    .from(postPublishingAudit)
    .where(gte(postPublishingAudit.created_at, oneHourAgo))
    .groupBy(postPublishingAudit.status);

  return NextResponse.json({
    lastHour: new Date().toISOString(),
    postsByStatus: Object.fromEntries(
      postsByStatus.map(ps => [ps.status, ps.count])
    ),
    attemptsByStatus: Object.fromEntries(
      attempts.map(a => [a.status, a.count])
    ),
  });
}
```

Access at: `http://localhost:3000/api/debug/cron-metrics`

---

## Summary: What You've Implemented

✅ **Core Features:**
- Exponential backoff retry calculation
- Audit trail table for retry history
- Auto-recovery cron endpoint
- Enhanced main cron with audit recording
- Complete logging and observability

✅ **Security:**
- Timing-safe secret comparison (already had)
- Proper state transitions
- Idempotency by state

✅ **Reliability:**
- Concurrency control via status (poor-man's lock)
- Timeout detection (5 minutes)
- Retry limits (5 retries max)
- Atomic transitions

✅ **Production Ready:**
- Proper error handling
- Structured JSON logging with request IDs
- Database indexes for performance
- Environment variable configuration

---

## Next Steps (After Implementing Above)

1. **Deploy to production** (Railway/Vercel)
2. **Test end-to-end** with actual n8n instance
3. **Set up alerting** for stale jobs
4. **Monitor metrics** daily
5. **Add HMAC webhook signing** (optional but recommended)
6. **Implement rate limiting** on webhook (optional)
7. **Create admin dashboard** for metrics (optional)
