import { NextRequest, NextResponse } from "next/server";
import { getPostById, updatePost } from "@/lib/db/queries";
import { mapDbPostToFrontend } from "@/lib/db/mappers";
import { cancelSchedule } from "@/lib/api/scheduler";
import { log } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/posts/[id]/unschedule
 * Cancel a scheduled post (revert to draft)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    // Check if post exists
    const existingPost = await getPostById(id);
    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Validate post can be unscheduled
    if (existingPost.status !== "scheduled") {
      return NextResponse.json(
        {
          error: `Cannot unschedule a post with status "${existingPost.status}". Only scheduled posts can be unscheduled.`,
        },
        { status: 400 }
      );
    }

    // Update post status back to draft, clear scheduled_at
    const dbPost = await updatePost(id, {
      status: "draft",
      scheduled_at: null,
    });

    if (!dbPost) {
      throw new Error("Failed to unschedule post");
    }

    // Remove from FastAPI scheduler service
    try {
      await cancelSchedule(id);
    } catch (schedulerError) {
      log("warn", "Scheduler cancellation failed, post unscheduled locally", {
        postId: id,
        error:
          schedulerError instanceof Error
            ? schedulerError.message
            : String(schedulerError),
      });
    }

    const post = mapDbPostToFrontend(dbPost);
    log("info", "Post unscheduled", { postId: id });
    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to unschedule post", {
      postId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to unschedule post" },
      { status: 500 }
    );
  }
}
