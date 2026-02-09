import type { Post as DbPost } from "@/lib/db/schema";
import type { Post as FrontendPost, PostStatus } from "@/types/post";

/**
 * Convert database post (snake_case) to frontend format (camelCase)
 */
export function mapDbPostToFrontend(dbPost: DbPost): FrontendPost {
  return {
    id: dbPost.id,
    title: dbPost.title,
    content: dbPost.content,
    imageUrl: dbPost.image_url ?? null,
    scheduledAt: dbPost.scheduled_at ?? undefined,
    publishedAt: dbPost.published_at ?? undefined,
    status: dbPost.status as PostStatus,
    linkedinPostUrn: dbPost.linkedin_post_urn ?? undefined,
    errorMessage: dbPost.error_message ?? undefined,
    createdAt: dbPost.created_at,
    updatedAt: dbPost.updated_at,
  };
}

/**
 * Convert array of database posts to frontend format
 */
export function mapDbPostsToFrontend(dbPosts: DbPost[]): FrontendPost[] {
  return dbPosts.map(mapDbPostToFrontend);
}

/**
 * Input type for API requests (uses strings for dates)
 */
export interface ApiPostInput {
  title?: string;
  content?: string;
  imageUrl?: string | null;
  scheduledAt?: string | null;
  status?: PostStatus;
}

/**
 * Convert API request data to database format (snake_case)
 * Handles string dates from API and converts to Date objects for DB
 */
export function mapApiInputToDb(data: ApiPostInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (data.title !== undefined) result.title = data.title;
  if (data.content !== undefined) result.content = data.content;
  if (data.imageUrl !== undefined) {
    result.image_url = data.imageUrl === null ? null : data.imageUrl;
  }
  if (data.scheduledAt !== undefined) {
    result.scheduled_at =
      data.scheduledAt === null ? null : new Date(data.scheduledAt);
  }
  if (data.status !== undefined) result.status = data.status;

  return result;
}

/**
 * Convert frontend post data (camelCase) to database format (snake_case)
 * Used for creating and updating posts via API
 */
export function mapFrontendPostToDb(
  data: Partial<Omit<FrontendPost, "id" | "createdAt" | "updatedAt">>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (data.title !== undefined) result.title = data.title;
  if (data.content !== undefined) result.content = data.content;
  if (data.imageUrl !== undefined) result.image_url = data.imageUrl;
  if (data.scheduledAt !== undefined) {
    result.scheduled_at =
      data.scheduledAt instanceof Date
        ? data.scheduledAt
        : new Date(data.scheduledAt as unknown as string);
  }
  if (data.publishedAt !== undefined) {
    result.published_at =
      data.publishedAt instanceof Date
        ? data.publishedAt
        : new Date(data.publishedAt as unknown as string);
  }
  if (data.status !== undefined) result.status = data.status;
  if (data.linkedinPostUrn !== undefined)
    result.linkedin_post_urn = data.linkedinPostUrn;
  if (data.errorMessage !== undefined)
    result.error_message = data.errorMessage;

  return result;
}
