import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { mapDbPostToFrontend } from "@/lib/db/mappers";
import { log } from "@/lib/logger";

/**
 * Escape reserved characters for LinkedIn's 'little' text format.
 * LinkedIn's Posts API `commentary` field uses the 'little' format, which
 * interprets unescaped ( ) [ ] { } @ # * ~ < > | \ _ as syntax elements
 * (mentions, hashtags, templates). Without escaping, the parser silently
 * truncates content at the first unrecognized syntax pattern.
 *
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
 */
function escapeForLinkedIn(text: string): string {
  return text.replace(/[|{}@[\]()<>#\\*_~]/g, "\\$&");
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/internal/posts/[id]
 * Internal endpoint for n8n to fetch post data.
 * Protected by CRON_SECRET bearer token, not session auth.
 * Returns the same camelCase JSON format as the public posts API.
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

  const { id } = await context.params;

  try {
    const result = await db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);

    const dbPost = result[0];
    if (!dbPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = mapDbPostToFrontend(dbPost);

    // Escape content for LinkedIn's 'little' text format.
    // This endpoint is used exclusively by n8n for LinkedIn publishing.
    // The n8n Code node sets commentary: post.content, so pre-escaping
    // here means the escaped content flows through automatically.
    post.content = escapeForLinkedIn(post.content);

    log("info", "Internal post fetch", { postId: id });
    return NextResponse.json(post);
  } catch (error) {
    log("error", "Internal post fetch failed", {
      postId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}
