import { db } from "@/lib/db";
import { posts, generations } from "@/lib/db/schema";
import type { NewPost, NewGeneration } from "@/lib/db/schema";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

// ============================================================================
// Posts Queries
// ============================================================================

/**
 * Get all posts with scheduled status, optionally filtered by month.
 * @param month - Optional month string in "YYYY-MM" format
 */
export async function getScheduledPosts(month?: string) {
  if (month) {
    const monthDate = parseISO(`${month}-01`);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    return db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.status, "scheduled"),
          gte(posts.scheduled_at, monthStart),
          lt(posts.scheduled_at, monthEnd)
        )
      )
      .orderBy(posts.scheduled_at);
  }

  return db
    .select()
    .from(posts)
    .where(eq(posts.status, "scheduled"))
    .orderBy(posts.scheduled_at);
}

/**
 * Get all posts ordered by creation date (newest first).
 */
export async function getAllPosts() {
  return db.select().from(posts).orderBy(desc(posts.created_at));
}

/**
 * Get a single post by ID.
 * @param id - The post ID
 */
export async function getPostById(id: string) {
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result[0] ?? null;
}

/**
 * Create a new post.
 * @param data - The post data
 */
export async function createPost(data: NewPost) {
  const result = await db.insert(posts).values(data).returning();
  return result[0];
}

/**
 * Update an existing post.
 * @param id - The post ID
 * @param data - The fields to update
 */
export async function updatePost(id: string, data: Partial<NewPost>) {
  const result = await db
    .update(posts)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();
  return result[0] ?? null;
}

/**
 * Delete a post by ID.
 * @param id - The post ID
 */
export async function deletePost(id: string) {
  const result = await db.delete(posts).where(eq(posts.id, id)).returning();
  return result[0] ?? null;
}

/**
 * Get recent drafts for the dashboard.
 * @param limit - Maximum number of drafts to return (default: 5)
 */
export async function getRecentDrafts(limit = 5) {
  return db
    .select()
    .from(posts)
    .where(eq(posts.status, "draft"))
    .orderBy(desc(posts.updated_at))
    .limit(limit);
}

/**
 * Get posts for a specific month (all statuses).
 * Used for calendar view.
 * @param month - Month string in "YYYY-MM" format
 */
export async function getPostsByMonth(month: string) {
  const monthDate = parseISO(`${month}-01`);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  return db
    .select()
    .from(posts)
    .where(
      and(gte(posts.scheduled_at, monthStart), lt(posts.scheduled_at, monthEnd))
    )
    .orderBy(posts.scheduled_at);
}

/**
 * Get posts that are ready to be published (scheduled and past due).
 */
export async function getPostsReadyToPublish() {
  const now = new Date();
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.status, "scheduled"), lt(posts.scheduled_at, now)))
    .orderBy(posts.scheduled_at);
}

/**
 * Update post status to publishing.
 * @param id - The post ID
 */
export async function markPostAsPublishing(id: string) {
  return updatePost(id, { status: "publishing" });
}

/**
 * Mark post as published with LinkedIn URN.
 * @param id - The post ID
 * @param linkedinPostUrn - The LinkedIn post URN
 */
export async function markPostAsPublished(id: string, linkedinPostUrn: string) {
  return updatePost(id, {
    status: "published",
    linkedin_post_urn: linkedinPostUrn,
    published_at: new Date(),
  });
}

/**
 * Mark post as failed with error message.
 * @param id - The post ID
 * @param errorMessage - The error message
 */
export async function markPostAsFailed(id: string, errorMessage: string) {
  return updatePost(id, {
    status: "failed",
    error_message: errorMessage,
  });
}

// ============================================================================
// Generations Queries
// ============================================================================

/**
 * Create a new generation record.
 * @param data - The generation data
 */
export async function createGeneration(data: NewGeneration) {
  const result = await db.insert(generations).values(data).returning();
  return result[0];
}

/**
 * Get a generation by ID.
 * @param id - The generation ID
 */
export async function getGenerationById(id: string) {
  const result = await db
    .select()
    .from(generations)
    .where(eq(generations.id, id))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Update generation selections.
 * @param id - The generation ID
 * @param selectedTextId - The selected text variation ID
 * @param selectedImageId - The selected image ID
 */
export async function updateGenerationSelections(
  id: string,
  selectedTextId?: string,
  selectedImageId?: string
) {
  const result = await db
    .update(generations)
    .set({
      selected_text_id: selectedTextId,
      selected_image_id: selectedImageId,
    })
    .where(eq(generations.id, id))
    .returning();
  return result[0] ?? null;
}

/**
 * Get recent generations.
 * @param limit - Maximum number of generations to return (default: 10)
 */
export async function getRecentGenerations(limit = 10) {
  return db
    .select()
    .from(generations)
    .orderBy(desc(generations.created_at))
    .limit(limit);
}
