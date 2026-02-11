import {
  getScheduledPosts as dbGetScheduledPosts,
  getAllPosts as dbGetAllPosts,
  getPostById as dbGetPostById,
  getRecentDrafts as dbGetRecentDrafts,
  getPostsByMonth as dbGetPostsByMonth,
} from "@/lib/db/queries";
import { mapDbPostToFrontend, mapDbPostsToFrontend } from "@/lib/db/mappers";
import type { Post, Draft } from "@/types/post";

/**
 * Get all scheduled posts for a user, optionally filtered by month.
 * @param userId - The user ID
 * @param month - Optional month string in "YYYY-MM" format
 */
export async function getScheduledPosts(
  userId: string,
  month?: string
): Promise<Post[]> {
  const dbPosts = await dbGetScheduledPosts(userId, month);
  return mapDbPostsToFrontend(dbPosts);
}

/**
 * Get all published posts for a user.
 * @param userId - The user ID
 */
export async function getPublishedPosts(userId: string): Promise<Post[]> {
  const dbPosts = await dbGetAllPosts(userId);
  return mapDbPostsToFrontend(
    dbPosts.filter((p) => p.status === "published")
  );
}

/**
 * Get recent drafts for a user.
 * @param userId - The user ID
 * @param limit - Maximum number of drafts to return (default: 4)
 */
export async function getRecentDrafts(
  userId: string,
  limit = 4
): Promise<Draft[]> {
  const dbPosts = await dbGetRecentDrafts(limit, userId);
  return dbPosts.map((dbPost) => {
    const post = mapDbPostToFrontend(dbPost);
    return {
      ...post,
      status: "draft" as const,
      characterCount: post.content.length,
    };
  });
}

/**
 * Get a single post by ID for a user.
 * @param id - The post ID
 * @param userId - The user ID
 */
export async function getPostById(
  id: string,
  userId: string
): Promise<Post | undefined> {
  const dbPost = await dbGetPostById(id, userId);
  if (!dbPost) return undefined;
  return mapDbPostToFrontend(dbPost);
}

/**
 * Get upcoming scheduled posts for a user within the specified number of days.
 * @param userId - The user ID
 * @param days - Number of days to look ahead (default: 7)
 */
export async function getUpcomingPosts(
  userId: string,
  days = 7
): Promise<Post[]> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);

  const dbPosts = await dbGetScheduledPosts(userId);
  const posts = mapDbPostsToFrontend(dbPosts);

  return posts
    .filter((p) => {
      if (p.status !== "scheduled" || !p.scheduledAt) return false;
      return p.scheduledAt >= now && p.scheduledAt <= endDate;
    })
    .sort((a, b) => {
      if (!a.scheduledAt || !b.scheduledAt) return 0;
      return a.scheduledAt.getTime() - b.scheduledAt.getTime();
    });
}

/**
 * Get all posts for a user.
 * @param userId - The user ID
 */
export async function getAllPosts(userId: string): Promise<Post[]> {
  const dbPosts = await dbGetAllPosts(userId);
  return mapDbPostsToFrontend(dbPosts);
}

/**
 * Get posts for the calendar view for a user (all statuses with a date).
 * @param userId - The user ID
 * @param month - Optional month string in "YYYY-MM" format
 */
export async function getPostsForCalendar(
  userId: string,
  month?: string
): Promise<Post[]> {
  if (month) {
    const dbPosts = await dbGetPostsByMonth(month, userId);
    return mapDbPostsToFrontend(dbPosts);
  }

  // If no month specified, get all posts with dates
  const dbPosts = await dbGetAllPosts(userId);
  const posts = mapDbPostsToFrontend(dbPosts);

  return posts.filter((p) => {
    const postDate = p.scheduledAt ?? p.publishedAt;
    return !!postDate;
  });
}
