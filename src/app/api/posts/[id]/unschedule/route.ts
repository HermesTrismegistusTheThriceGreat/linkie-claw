import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPostById, updatePost } from "@/lib/db/queries";
import { mapDbPostToFrontend } from "@/lib/db/mappers";
import { log } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/posts/[id]/unschedule
 * Cancel a scheduled post (revert to draft)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  const { id } = await context.params;

  try {
    // Check if post exists for this user
    const existingPost = await getPostById(id, userId);
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
      retry_count: 0,
    }, userId);

    if (!dbPost) {
      throw new Error("Failed to unschedule post");
    }

    const post = mapDbPostToFrontend(dbPost);
    log("info", "Post unscheduled", { postId: id, userId });
    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to unschedule post", {
      postId: id,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to unschedule post" },
      { status: 500 }
    );
  }
}
