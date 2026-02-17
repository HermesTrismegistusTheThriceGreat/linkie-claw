"use server";

import { auth } from "@/lib/auth";
import { saveUserVoiceTones, upsertUserSettings } from "@/lib/db/queries";
import { validateVoiceTones, type VoiceTone } from "@/lib/voice-tones";
import { revalidatePath } from "next/cache";

export async function updateVoiceTones(tones: VoiceTone[]): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }
    const userId = session.user.id;

    const validation = validateVoiceTones(tones);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    await saveUserVoiceTones(userId, tones);
    revalidatePath("/voice-tones");
    return { success: true };
}

export async function resetVoiceTones(): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }
    const userId = session.user.id;

    await upsertUserSettings(userId, { voice_tones_json: null });
    revalidatePath("/voice-tones");
    return { success: true };
}
