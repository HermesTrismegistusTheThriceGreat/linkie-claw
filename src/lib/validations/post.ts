import { z } from "zod";

/**
 * Valid post status values
 */
export const postStatusSchema = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
]);

/**
 * Schema for creating a new post
 */
export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(3000, "Content exceeds LinkedIn limit"),
  imageUrl: z.string().min(1, "Image URL is required").optional(),
  status: postStatusSchema.default("draft"),
  scheduledAt: z.string().datetime().optional(),
});

/**
 * Schema for updating an existing post
 */
export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(3000).optional(),
  imageUrl: z.string().min(1).nullable().optional(),
  status: postStatusSchema.optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

/**
 * Schema for scheduling a post
 */
export const schedulePostSchema = z.object({
  scheduledAt: z.string().datetime("Invalid datetime format"),
});

/**
 * Schema for list posts query params
 */
export const listPostsQuerySchema = z.object({
  status: postStatusSchema.optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM format")
    .optional(),
});

// Type exports
export type PostStatus = z.infer<typeof postStatusSchema>;
export type CreatePostRequest = z.infer<typeof createPostSchema>;
export type UpdatePostRequest = z.infer<typeof updatePostSchema>;
export type SchedulePostRequest = z.infer<typeof schedulePostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
