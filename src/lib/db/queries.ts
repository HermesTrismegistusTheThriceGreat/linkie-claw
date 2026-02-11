import { db } from "@/lib/db";
import { posts, generations, userSettings, linkedinOauthStates } from "@/lib/db/schema";
import type { NewPost, NewGeneration, NewUserSettings, UserSettings } from "@/lib/db/schema";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";
import { startOfMonth, endOfMonth, parseISO, subMinutes } from "date-fns";

// ============================================================================
// Posts Queries
// ============================================================================

/**
 * Get all posts for a user, ordered by creation date (newest first).
 * @param userId - The user ID
 */
export async function getAllPosts(userId: string) {
  return db
    .select()
    .from(posts)
    .where(eq(posts.user_id, userId))
    .orderBy(desc(posts.created_at));
}

/**
 * Get a single post by ID for a specific user.
 * @param id - The post ID
 * @param userId - The user ID
 */
export async function getPostById(id: string, userId: string) {
  const result = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.user_id, userId)))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Create a new post for a user.
 * @param data - The post data (must include user_id)
 */
export async function createPost(data: NewPost & { user_id: string }) {
  const result = await db.insert(posts).values(data).returning();
  return result[0];
}

/**
 * Update an existing post for a user.
 * @param id - The post ID
 * @param data - The fields to update
 * @param userId - The user ID
 */
export async function updatePost(
  id: string,
  data: Partial<NewPost>,
  userId: string
) {
  const result = await db
    .update(posts)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(and(eq(posts.id, id), eq(posts.user_id, userId)))
    .returning();
  return result[0] ?? null;
}

/**
 * Delete a post by ID for a specific user.
 * @param id - The post ID
 * @param userId - The user ID
 */
export async function deletePost(id: string, userId: string) {
  const result = await db
    .delete(posts)
    .where(and(eq(posts.id, id), eq(posts.user_id, userId)))
    .returning();
  return result[0] ?? null;
}

/**
 * Get scheduled posts for a user, optionally filtered by month.
 * @param userId - The user ID
 * @param month - Optional month string in "YYYY-MM" format
 */
export async function getScheduledPosts(userId: string, month?: string) {
  if (month) {
    const monthDate = parseISO(`${month}-01`);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    return db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.user_id, userId),
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
    .where(and(eq(posts.user_id, userId), eq(posts.status, "scheduled")))
    .orderBy(posts.scheduled_at);
}

/**
 * Get posts for a specific month for a user (all statuses).
 * Used for calendar view.
 * @param month - Month string in "YYYY-MM" format
 * @param userId - The user ID
 */
export async function getPostsByMonth(month: string, userId: string) {
  const monthDate = parseISO(`${month}-01`);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  return db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.user_id, userId),
        gte(posts.scheduled_at, monthStart),
        lt(posts.scheduled_at, monthEnd)
      )
    )
    .orderBy(posts.scheduled_at);
}

/**
 * Get recent drafts for a user.
 * @param limit - Maximum number of drafts to return (default: 5)
 * @param userId - The user ID
 */
export async function getRecentDrafts(limit = 5, userId: string) {
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.user_id, userId), eq(posts.status, "draft")))
    .orderBy(desc(posts.updated_at))
    .limit(limit);
}

// ============================================================================
// Scheduler Queries (global - no user filtering)
// ============================================================================

const MAX_RETRIES = 3;

/**
 * Get posts ready to publish (scheduled and past due).
 * Global query - scheduler runs across all users.
 */
export async function getPostsReadyToPublish() {
  const now = new Date();
  return db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        lt(posts.scheduled_at, now),
        lt(posts.retry_count, MAX_RETRIES)
      )
    )
    .orderBy(posts.scheduled_at);
}

/**
 * Get posts stuck in "publishing" state for too long (likely failed).
 * Global query - scheduler runs across all users.
 */
export async function getStalePublishingPosts() {
  const fiveMinutesAgo = subMinutes(new Date(), 5);
  return db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.status, "publishing"),
        lt(posts.updated_at, fiveMinutesAgo),
        lt(posts.retry_count, MAX_RETRIES)
      )
    )
    .orderBy(posts.scheduled_at);
}

/**
 * Increment retry count for a post.
 * @param postId - The post ID
 */
export async function incrementPostRetryCount(postId: string) {
  await db
    .update(posts)
    .set({ retry_count: sql`${posts.retry_count} + 1` })
    .where(eq(posts.id, postId));
}

// ============================================================================
// Post Status Update Queries (for scheduler and webhooks)
// ============================================================================

/**
 * Update post status to publishing.
 * @param id - The post ID
 */
export async function markPostAsPublishing(id: string) {
  const result = await db
    .update(posts)
    .set({ status: "publishing", updated_at: new Date() })
    .where(eq(posts.id, id))
    .returning();
  return result[0] ?? null;
}

/**
 * Mark post as published with LinkedIn URN.
 * @param id - The post ID
 * @param linkedinPostUrn - The LinkedIn post URN
 */
export async function markPostAsPublished(id: string, linkedinPostUrn: string) {
  const result = await db
    .update(posts)
    .set({
      status: "published",
      linkedin_post_urn: linkedinPostUrn,
      published_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();
  return result[0] ?? null;
}

/**
 * Mark post as failed with error message.
 * @param id - The post ID
 * @param errorMessage - The error message
 */
export async function markPostAsFailed(id: string, errorMessage: string) {
  const result = await db
    .update(posts)
    .set({
      status: "failed",
      error_message: errorMessage,
      updated_at: new Date(),
    })
    .where(eq(posts.id, id))
    .returning();
  return result[0] ?? null;
}

// ============================================================================
// Generations Queries
// ============================================================================

/**
 * Create a new generation record for a user.
 * @param data - The generation data (must include user_id)
 */
export async function createGeneration(data: NewGeneration & { user_id: string }) {
  const result = await db.insert(generations).values(data).returning();
  return result[0];
}

/**
 * Get a generation by ID for a specific user.
 * @param id - The generation ID
 * @param userId - The user ID
 */
export async function getGenerationById(id: string, userId: string) {
  const result = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.user_id, userId)))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Update generation selections for a user.
 * @param id - The generation ID
 * @param userId - The user ID
 * @param selectedTextId - The selected text variation ID
 * @param selectedImageId - The selected image ID
 */
export async function updateGenerationSelections(
  id: string,
  userId: string,
  selectedTextId?: string,
  selectedImageId?: string
) {
  const result = await db
    .update(generations)
    .set({
      selected_text_id: selectedTextId,
      selected_image_id: selectedImageId,
    })
    .where(and(eq(generations.id, id), eq(generations.user_id, userId)))
    .returning();
  return result[0] ?? null;
}

/**
 * Get recent generations for a user.
 * @param limit - Maximum number of generations to return (default: 10)
 * @param userId - The user ID
 */
export async function getRecentGenerations(limit = 10, userId: string) {
  return db
    .select()
    .from(generations)
    .where(eq(generations.user_id, userId))
    .orderBy(desc(generations.created_at))
    .limit(limit);
}

// ============================================================================
// User Settings Queries
// ============================================================================

/**
 * Get user settings by user ID.
 * @param userId - The user ID
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.user_id, userId))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Upsert user settings (insert or update).
 * @param userId - The user ID
 * @param data - The settings data to upsert
 */
export async function upsertUserSettings(
  userId: string,
  data: Partial<NewUserSettings>
): Promise<UserSettings> {
  const existing = await getUserSettings(userId);

  if (existing) {
    const result = await db
      .update(userSettings)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(userSettings.user_id, userId))
      .returning();
    return result[0]!;
  }

  const result = await db
    .insert(userSettings)
    .values({
      user_id: userId,
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning();
  return result[0]!;
}

// ============================================================================
// LinkedIn OAuth State Queries
// ============================================================================

/**
 * Store OAuth state for CSRF protection.
 * @param state - The random state string
 * @param userId - The user ID
 * @param expiresAt - When the state expires
 */
export async function createLinkedinOauthState(
  state: string,
  userId: string,
  expiresAt: Date
) {
  await db.insert(linkedinOauthStates).values({
    state,
    user_id: userId,
    expires_at: expiresAt,
  });
}

/**
 * Get and validate OAuth state.
 * @param state - The state string from callback
 * @returns The user ID if valid, null otherwise
 */
export async function getLinkedinOauthState(state: string): Promise<string | null> {
  const result = await db
    .select()
    .from(linkedinOauthStates)
    .where(eq(linkedinOauthStates.state, state))
    .limit(1);

  if (!result[0]) return null;

  // Check if expired
  if (result[0].expires_at < new Date()) {
    // Clean up expired state
    await db.delete(linkedinOauthStates).where(eq(linkedinOauthStates.state, state));
    return null;
  }

  return result[0].user_id;
}

/**
 * Delete OAuth state after use.
 * @param state - The state string
 */
export async function deleteLinkedinOauthState(state: string) {
  await db.delete(linkedinOauthStates).where(eq(linkedinOauthStates.state, state));
}

/**
 * Clean up all expired OAuth states.
 */
export async function cleanupExpiredLinkedinOauthStates() {
  await db
    .delete(linkedinOauthStates)
    .where(lt(linkedinOauthStates.expires_at, new Date()));
}
