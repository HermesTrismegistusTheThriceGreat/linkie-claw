import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPostById, updatePost } from "@/lib/db/queries";
import { mapDbPostToFrontend, mapDbPostsToFrontend } from "@/lib/db/mappers";
import { scheduleWithScheduler } from "@/lib/api/scheduler";
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
export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const stuckPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.status, "publishing"),
          lt(posts.updated_at, oneHourAgo)
        )
      );

    const frontendPosts = mapDbPostsToFrontend(stuckPosts);

    log("info", "Stuck posts queried", {
      requestId,
      count: frontendPosts.length,
    });

    return NextResponse.json({
      posts: frontendPosts,
      count: frontendPosts.length,
    });
  } catch (error) {
    log("error", "Failed to query stuck posts", {
      requestId,
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
    // Check if post exists
    const existingPost = await getPostById(postId);
    if (!existingPost) {
      log("warn", "Recovery attempted on non-existent post", {
        requestId,
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
      });

      // Register with scheduler so the post actually gets picked up
      try {
        await scheduleWithScheduler(postId, scheduledAt.toISOString());
      } catch (schedulerError) {
        log("error", "Scheduler registration failed during recovery, reverting to publishing", {
          requestId,
          postId,
          error:
            schedulerError instanceof Error
              ? schedulerError.message
              : String(schedulerError),
        });

        // Revert back to publishing status since scheduler didn't accept it
        await updatePost(postId, {
          status: "publishing",
        });

        return NextResponse.json(
          { error: "Scheduler service is unavailable. Recovery failed." },
          { status: 503 }
        );
      }
    } else {
      dbPost = await updatePost(postId, {
        status: "failed",
        error_message: "Manual recovery: publishing timed out",
      });
    }

    if (!dbPost) {
      throw new Error("Failed to update post during recovery");
    }

    const post = mapDbPostToFrontend(dbPost);

    log("info", "Post recovered", {
      requestId,
      postId,
      action,
      previousStatus: "publishing",
      newStatus: post.status,
    });

    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to recover post", {
      requestId,
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
