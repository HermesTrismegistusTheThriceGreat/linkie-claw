import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateTextSchema } from "@/lib/validations/generation";
import { generateTextVariations } from "@/lib/api/anthropic";
import { log } from "@/lib/logger";
import { getUserVoiceTones } from "@/lib/db/queries";
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();

    // Validate request
    const result = generateTextSchema.safeParse(body);
    if (!result.success) {
      log("warn", "Text generation validation failed", {
        requestId,
        errors: result.error.flatten()
      });
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    log("info", "Text generation started", { requestId, ideaLength: result.data.idea.length });

    const start = Date.now();
    const voiceTones = await getUserVoiceTones(session.user.id);
    const variations = await generateTextVariations(result.data.idea, voiceTones);
    const duration = Date.now() - start;

    log("info", "Text generation completed", {
      requestId,
      duration,
      variationCount: variations.length
    });

    return NextResponse.json({ variations });
  } catch (error) {
    log("error", "Text generation failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: "Text generation failed" },
      { status: 500 }
    );
  }
}
