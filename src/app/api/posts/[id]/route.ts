import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updatePostSchema } from "@/lib/validations/post";
import { getPostById, updatePost, deletePost } from "@/lib/db/queries";
import { mapDbPostToFrontend, mapApiInputToDb } from "@/lib/db/mappers";
import { log } from "@/lib/logger";
import { deleteImageFromR2, extractR2KeyFromUrl, isR2Configured } from "@/lib/storage/r2";
import type { NewPost } from "@/lib/db/schema";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/posts/[id]
 * Get a single post by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
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
    const dbPost = await getPostById(id, userId);

    if (!dbPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = mapDbPostToFrontend(dbPost);
    log("info", "Post fetched", { postId: id, userId });
    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to fetch post", {
      postId: id,
      userId,
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
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  log("info", "[DEBUG] PATCH raw body received", { postId: id, body: JSON.stringify(body) });

  const result = updatePostSchema.safeParse(body);

  if (!result.success) {
    log("error", "[DEBUG] PATCH validation failed", { postId: id, errors: JSON.stringify(result.error.flatten()) });
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  log("info", "[DEBUG] PATCH validated data", { postId: id, data: JSON.stringify(result.data) });

  try {
    // Check if post exists for this user
    const existingPost = await getPostById(id, userId);
    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    log("info", "[DEBUG] PATCH existing image_url", { postId: id, existingImageUrl: existingPost.image_url });

    // Map API input to snake_case for DB
    const dbData = mapApiInputToDb(result.data) as Partial<NewPost>;

    log("info", "[DEBUG] PATCH mapped dbData", { postId: id, dbData: JSON.stringify(dbData) });

    const dbPost = await updatePost(id, dbData, userId);

    if (!dbPost) {
      throw new Error("Failed to update post");
    }

    log("info", "[DEBUG] PATCH post after update", { postId: id, newImageUrl: dbPost.image_url });

    const post = mapDbPostToFrontend(dbPost);
    log("info", "Post updated", { postId: id, userId });
    return NextResponse.json(post);
  } catch (error) {
    log("error", "Failed to update post", {
      postId: id,
      userId,
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

    // Clean up R2 image if present
    if (isR2Configured() && existingPost.image_url) {
      const r2Key = extractR2KeyFromUrl(existingPost.image_url);
      if (r2Key) {
        await deleteImageFromR2(r2Key);
      }
    }

    const deletedPost = await deletePost(id, userId);

    if (!deletedPost) {
      throw new Error("Failed to delete post");
    }

    log("info", "Post deleted", { postId: id, userId });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    log("error", "Failed to delete post", {
      postId: id,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
