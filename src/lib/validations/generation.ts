import { z } from "zod";

export const generateTextSchema = z.object({
  idea: z.string().min(10, "Idea must be at least 10 characters"),
});

export const generateImageSchema = z.object({
  idea: z.string().min(10, "Idea must be at least 10 characters"),
  count: z.number().int().min(1).max(6).optional(),
  provider: z.enum(["replicate", "gemini"]).optional(),
});

export type GenerateTextRequest = z.infer<typeof generateTextSchema>;
export type GenerateImageRequest = z.infer<typeof generateImageSchema>;
