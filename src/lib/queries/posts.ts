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
 * Get all scheduled posts, optionally filtered by month.
 * @param month - Optional month string in "YYYY-MM" format
 */
export async function getScheduledPosts(month?: string): Promise<Post[]> {
  const dbPosts = await dbGetScheduledPosts(month);
  return mapDbPostsToFrontend(dbPosts);
}

/**
 * Get all published posts.
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const dbPosts = await dbGetAllPosts();
  return mapDbPostsToFrontend(
    dbPosts.filter((p) => p.status === "published")
  );
}

/**
 * Get recent drafts for the dashboard.
 * @param limit - Maximum number of drafts to return (default: 4)
 */
export async function getRecentDrafts(limit = 4): Promise<Draft[]> {
  const dbPosts = await dbGetRecentDrafts(limit);
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
 * Get a single post by ID.
 * @param id - The post ID
 */
export async function getPostById(id: string): Promise<Post | undefined> {
  const dbPost = await dbGetPostById(id);
  if (!dbPost) return undefined;
  return mapDbPostToFrontend(dbPost);
}

/**
 * Get upcoming scheduled posts within the specified number of days.
 * @param days - Number of days to look ahead (default: 7)
 */
export async function getUpcomingPosts(days = 7): Promise<Post[]> {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);

  const dbPosts = await dbGetScheduledPosts();
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
 * Get all posts.
 */
export async function getAllPosts(): Promise<Post[]> {
  const dbPosts = await dbGetAllPosts();
  return mapDbPostsToFrontend(dbPosts);
}

/**
 * Get posts for the calendar view (all statuses with a date).
 * @param month - Optional month string in "YYYY-MM" format
 */
export async function getPostsForCalendar(month?: string): Promise<Post[]> {
  if (month) {
    const dbPosts = await dbGetPostsByMonth(month);
    return mapDbPostsToFrontend(dbPosts);
  }

  // If no month specified, get all posts with dates
  const dbPosts = await dbGetAllPosts();
  const posts = mapDbPostsToFrontend(dbPosts);

  return posts.filter((p) => {
    const postDate = p.scheduledAt ?? p.publishedAt;
    return !!postDate;
  });
}
