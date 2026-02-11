import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { updatePost } from "@/lib/db/queries";
import { log } from "@/lib/logger";

const publishStatusSchema = z
  .object({
    postId: z.string().min(1),
    status: z.enum(["published", "failed"]),
    linkedinPostUrn: z.string().min(1).optional(),
    error: z.union([z.string(), z.record(z.string(), z.unknown())])
      .optional()
      .transform((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : v)),
    callbackId: z.string().optional(),
  })
  .refine(
    (data) => data.status !== "published" || !!data.linkedinPostUrn,
    { message: "linkedinPostUrn is required when status is published", path: ["linkedinPostUrn"] }
  );

/**
 * POST /api/webhooks/publish-status
 * Callback from n8n after LinkedIn publish attempt.
 * Updates post status to published (with URN) or failed (with error).
 * 
 * Note: This endpoint is called by n8n, not by an authenticated user.
 * Authentication is via webhook secret, not session.
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Verify webhook secret (REQUIRED)
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.N8N_CALLBACK_SECRET;
  if (!expectedSecret) {
    log("error", "N8N_CALLBACK_SECRET not configured", { requestId });
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }
  if (
    !secret ||
    secret.length !== expectedSecret.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
  ) {
    log("warn", "Unauthorized webhook callback", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log("warn", "Webhook received invalid JSON body", { requestId });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = publishStatusSchema.safeParse(body);

  if (!result.success) {
    log("warn", "Webhook validation failed", {
      requestId,
      errors: result.error.flatten(),
    });
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { postId, status, linkedinPostUrn, error, callbackId } = result.data;

  log("info", "Received publish status callback", {
    requestId,
    postId,
    status,
    callbackId,
    ...(status === "failed" && error ? { n8nError: error } : {}),
  });

  // Check post exists (internal webhook - no user filtering)
  const existingPostResult = await db
    .select()
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  const existingPost = existingPostResult[0];
  
  if (!existingPost) {
    log("warn", "Webhook callback for non-existent post", {
      requestId,
      postId,
    });
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

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

  try {
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

    log("info", "Post status updated via webhook", {
      requestId,
      postId,
      status,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    log("error", "Failed to update post status", {
      requestId,
      postId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}
