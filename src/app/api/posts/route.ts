import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createPostSchema,
  listPostsQuerySchema,
} from "@/lib/validations/post";
import {
  getAllPosts,
  getScheduledPosts,
  getPostsByMonth,
  createPost,
} from "@/lib/db/queries";
import {
  mapDbPostToFrontend,
  mapDbPostsToFrontend,
  mapApiInputToDb,
} from "@/lib/db/mappers";
import { log } from "@/lib/logger";
import type { NewPost } from "@/lib/db/schema";

/**
 * GET /api/posts
 * List posts with optional filters
 *
 * Query params:
 * - status: Filter by status (draft, scheduled, publishing, published, failed)
 * - month: Filter by month (YYYY-MM format)
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
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const month = searchParams.get("month");

  // Validate query params
  const queryResult = listPostsQuerySchema.safeParse({
    status: status ?? undefined,
    month: month ?? undefined,
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  try {
    let dbPosts;

    if (status === "scheduled") {
      dbPosts = await getScheduledPosts(userId, month ?? undefined);
    } else if (month) {
      dbPosts = await getPostsByMonth(month, userId);
    } else {
      dbPosts = await getAllPosts(userId);
    }

    const posts = mapDbPostsToFrontend(dbPosts);
    log("info", "Posts fetched", { count: posts.length, status, month, userId });
    return NextResponse.json(posts);
  } catch (error) {
    log("error", "Failed to fetch posts", {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts
 * Create a new post
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const result = createPostSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Map API input to snake_case for DB and add user_id
    const dbData = {
      ...mapApiInputToDb(result.data),
      user_id: userId,
    } as NewPost & { user_id: string };

    const dbPost = await createPost(dbData);

    if (!dbPost) {
      throw new Error("Failed to create post");
    }

    const post = mapDbPostToFrontend(dbPost);
    log("info", "Post created", { postId: post.id, title: post.title, userId });
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    log("error", "Failed to create post", {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
