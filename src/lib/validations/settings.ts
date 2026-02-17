import { z } from "zod";

export const updateSettingsSchema = z.object({
  linkedinProfileUrl: z.string().url().optional().or(z.literal("")),
});

export type UpdateSettingsRequest = z.infer<typeof updateSettingsSchema>;
