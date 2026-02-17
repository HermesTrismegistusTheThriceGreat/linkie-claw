"use server";

import { auth } from "@/lib/auth";
import { saveUserImageStyles, upsertUserSettings } from "@/lib/db/queries";
import { validateImageStyles, type ImageStyle } from "@/lib/image-styles";
import { revalidatePath } from "next/cache";

export async function updateImageStyles(styles: ImageStyle[]): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }
    const userId = session.user.id;

    const validation = validateImageStyles(styles);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    await saveUserImageStyles(userId, styles);
    revalidatePath("/image-styles");
    return { success: true };
}

export async function resetImageStyles(): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }
    const userId = session.user.id;

    await upsertUserSettings(userId, { image_styles_json: null });
    revalidatePath("/image-styles");
    return { success: true };
}
