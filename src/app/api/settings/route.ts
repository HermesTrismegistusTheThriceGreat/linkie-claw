import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-utils";
import { getUserSettings, upsertUserSettings } from "@/lib/db/queries";
import { updateSettingsSchema } from "@/lib/validations/settings";

/**
 * GET /api/settings
 * Fetch current user's settings
 */
export async function GET() {
  const userId = await getAuthUserId();
  
  try {
    const settings = await getUserSettings(userId);
    
    // Return default values if no settings exist
    return NextResponse.json(
      settings ?? { 
        linkedinConnected: false, 
        linkedinProfileUrl: null 
      }
    );
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * Update user settings (LinkedIn URL)
 */
export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId();
  
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate with Zod
  const validated = updateSettingsSchema.safeParse(body);

  if (!validated.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await upsertUserSettings(userId, {
      linkedin_profile_url: validated.data.linkedinProfileUrl || null,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
