import { z } from "zod";

export const generateTextSchema = z.object({
  idea: z.string().min(10, "Idea must be at least 10 characters").max(1000, "Idea cannot exceed 1000 characters"),
});

export const generateImageSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters").max(500, "Prompt cannot exceed 500 characters"),
  count: z.number().int().min(1).max(6).optional(),
  provider: z.enum(["replicate", "gemini"]).optional(),
});

export type GenerateTextRequest = z.infer<typeof generateTextSchema>;
export type GenerateImageRequest = z.infer<typeof generateImageSchema>;
