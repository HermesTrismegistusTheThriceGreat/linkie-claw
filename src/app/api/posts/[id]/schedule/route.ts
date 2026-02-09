import { NextRequest, NextResponse } from "next/server";
import { schedulePostSchema } from "@/lib/validations/post";
import { getPostById, updatePost } from "@/lib/db/queries";
import { mapDbPostToFrontend } from "@/lib/db/mappers";
import { scheduleWithScheduler } from "@/lib/api/scheduler";
import { log } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/posts/[id]/schedule
 * Schedule a post for publishing
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = schedulePostSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Check if post exists
    const existingPost = await getPostById(id);
    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Validate post can be scheduled
    if (existingPost.status === "published") {
      return NextResponse.json(
        { error: "Cannot schedule a published post" },
        { status: 400 }
      );
    }

    if (existingPost.status === "publishing") {
      return NextResponse.json(
        { error: "Cannot reschedule a post that is currently publishing" },
        { status: 400 }
      );
    }

    // Validate scheduled time is in the future
    const scheduledAt = new Date(result.data.scheduledAt);
    if (scheduledAt <= new Date()) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }

    // Update post status and scheduled_at
    const dbPost = await updatePost(id, {
      status: "scheduled",
      scheduled_at: scheduledAt,
    });

    if (!dbPost) {
      throw new Error("Failed to schedule post");
    }

    // Register with FastAPI scheduler service
    try {
      await scheduleWithScheduler(id, result.data.scheduledAt);
    } catch (schedulerError) {
      log("error", "Scheduler registration failed, reverting post status", {
        postId: id,
        previousStatus: existingPost.status,
        error:
          schedulerError instanceof Error
            ? schedulerError.message
            : String(schedulerError),
      });

      // Revert DB status to what it was before
      await updatePost(id, {
        status: existingPost.status as "draft" | "scheduled" | "publishing" | "published" | "failed",
        scheduled_at: existingPost.scheduled_at,
      });

      return NextResponse.json(
        { error: "Scheduler service is unavailable. Post was not scheduled." },
        { status: 503 }
      );
    }

    const post = mapDbPostToFrontend(dbPost);
    log("info", "Post scheduled", {
      postId: id,
      scheduledAt: result.data.scheduledAt,
    });
    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to schedule post", {
      postId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to schedule post" },
      { status: 500 }
    );
  }
}
