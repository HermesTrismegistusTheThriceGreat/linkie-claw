import { NextRequest, NextResponse } from "next/server";
import { updatePostSchema } from "@/lib/validations/post";
import { getPostById, updatePost, deletePost } from "@/lib/db/queries";
import { mapDbPostToFrontend, mapApiInputToDb } from "@/lib/db/mappers";
import { log } from "@/lib/logger";
import type { NewPost } from "@/lib/db/schema";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/posts/[id]
 * Get a single post by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const dbPost = await getPostById(id);

    if (!dbPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = mapDbPostToFrontend(dbPost);
    log("info", "Post fetched", { postId: id });
    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to fetch post", {
      postId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/posts/[id]
 * Update a post
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = updatePostSchema.safeParse(body);

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

    // Map API input to snake_case for DB
    const dbData = mapApiInputToDb(result.data) as Partial<NewPost>;

    const dbPost = await updatePost(id, dbData);

    if (!dbPost) {
      throw new Error("Failed to update post");
    }

    const post = mapDbPostToFrontend(dbPost);
    log("info", "Post updated", { postId: id });
    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to update post", {
      postId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/posts/[id]
 * Delete a post
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    // Check if post exists
    const existingPost = await getPostById(id);
    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const deletedPost = await deletePost(id);

    if (!deletedPost) {
      throw new Error("Failed to delete post");
    }

    log("info", "Post deleted", { postId: id });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    log("error", "Failed to delete post", {
      postId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
