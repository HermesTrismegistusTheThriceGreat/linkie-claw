import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  getPostsReadyToPublish,
  getStalePublishingPosts,
  getUserSettings,
  markPostAsPublishing,
  markPostAsFailed,
  incrementPostRetryCount,
  reschedulePostForRetry,
  resetStalePost,
  getLinkedInAccessToken,
} from "@/lib/db/queries";
import { log } from "@/lib/logger";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2 * 60 * 1000; // 2 minutes
const MAX_BATCH_SIZE = 10;

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    log("error", "CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  if (
    !authHeader ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
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

        // Get access token (from settings or accounts table)
        const accessToken = await getLinkedInAccessToken(post.user_id);
        // accessToken is optional — n8n manages OAuth credentials directly

        // POST to n8n webhook (per-user URL, falling back to env var)
        const n8nUrl = settings.n8n_webhook_url || process.env.N8N_WEBHOOK_URL;
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
            ...(accessToken && { accessToken }),
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

// Railway Cron Webhook Trigger sends POST requests
export { GET as POST };
