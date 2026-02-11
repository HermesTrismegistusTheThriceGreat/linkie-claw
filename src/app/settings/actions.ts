"use server";

import { getAuthUserId } from "@/lib/auth-utils";
import { upsertUserSettings } from "@/lib/db/queries";

export async function updateLinkedInUrl(url: string): Promise<void> {
  const userId = await getAuthUserId();
  
  await upsertUserSettings(userId, {
    linkedin_profile_url: url || null,
  });
}
