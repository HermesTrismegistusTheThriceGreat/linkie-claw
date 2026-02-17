import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getPostById, updatePost } from "@/lib/db/queries";
import { mapDbPostToFrontend, mapDbPostsToFrontend } from "@/lib/db/mappers";
import { log } from "@/lib/logger";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, and, lt } from "drizzle-orm";

const recoverPostSchema = z.object({
  postId: z.string().min(1),
  action: z.enum(["retry", "fail"]),
});

/**
 * GET /api/posts/recover
 * List all posts stuck in "publishing" status for more than 1 hour.
 * Returns { posts: Post[], count: number } in frontend camelCase format.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  const requestId = crypto.randomUUID();

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const stuckPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.user_id, userId),
          eq(posts.status, "publishing"),
          lt(posts.updated_at, oneHourAgo)
        )
      );

    const frontendPosts = mapDbPostsToFrontend(stuckPosts);

    log("info", "Stuck posts queried", {
      requestId,
      userId,
      count: frontendPosts.length,
    });

    return NextResponse.json({
      posts: frontendPosts,
      count: frontendPosts.length,
    });
  } catch (error) {
    log("error", "Failed to query stuck posts", {
      requestId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to query stuck posts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts/recover
 * Recover a stuck post by retrying (reset to scheduled) or failing it.
 *
 * Body: { postId: string, action: "retry" | "fail" }
 * - "retry": resets post to "scheduled" so the scheduler can re-trigger
 * - "fail": sets post to "failed" with error message
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const result = recoverPostSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { postId, action } = result.data;

  try {
    // Check if post exists for this user
    const existingPost = await getPostById(postId, userId);
    if (!existingPost) {
      log("warn", "Recovery attempted on non-existent post", {
        requestId,
        userId,
        postId,
      });
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      );
    }

    // Verify post is in "publishing" status
    if (existingPost.status !== "publishing") {
      log("warn", "Recovery attempted on non-stuck post", {
        requestId,
        userId,
        postId,
        currentStatus: existingPost.status,
      });
      return NextResponse.json(
        {
          error: `Cannot recover a post with status "${existingPost.status}". Only posts with "publishing" status can be recovered.`,
        },
        { status: 409 }
      );
    }

    let dbPost;

    if (action === "retry") {
      const scheduledAt = new Date();
      dbPost = await updatePost(postId, {
        status: "scheduled",
        scheduled_at: scheduledAt,
        retry_count: 0,
      }, userId);
    } else {
      dbPost = await updatePost(postId, {
        status: "failed",
        error_message: "Manual recovery: publishing timed out",
      }, userId);
    }

    if (!dbPost) {
      throw new Error("Failed to update post during recovery");
    }

    const post = mapDbPostToFrontend(dbPost);

    log("info", "Post recovered", {
      requestId,
      userId,
      postId,
      action,
      previousStatus: "publishing",
      newStatus: post.status,
    });

    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to recover post", {
      requestId,
      userId,
      postId,
      action,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to recover post" },
      { status: 500 }
    );
  }
}
