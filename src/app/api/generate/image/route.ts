import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateImageSchema } from "@/lib/validations/generation";
import { getImageProvider } from "@/lib/api/image-provider";
import { log } from "@/lib/logger";
import { getUserImageStyles } from "@/lib/db/queries";
import { buildImagePrompt } from "@/lib/image-styles";

const DEFAULT_COUNT = 6;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const requestId = crypto.randomUUID();
  log("info", "Image generation request received", { requestId });

  try {
    const body = await request.json();
    const result = generateImageSchema.safeParse(body);

    if (!result.success) {
      log("warn", "Validation failed", {
        requestId,
        errors: result.error.flatten(),
      });
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    // Check if the resolved provider has a valid API key
    const resolvedProvider =
      result.data.provider ||
      (process.env.IMAGE_PROVIDER as "replicate" | "gemini") ||
      "replicate";
    const hasReplicateKey = !!process.env.REPLICATE_API_TOKEN;
    const hasGeminiKey = !!(
      process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
    );

    if (
      (resolvedProvider === "replicate" && !hasReplicateKey) ||
      (resolvedProvider === "gemini" && !hasGeminiKey)
    ) {
      log("warn", "Image provider API key not set", {
        requestId,
        provider: resolvedProvider,
      });
      return NextResponse.json(
        {
          error: "Image generation not configured",
          details: `${resolvedProvider === "replicate" ? "REPLICATE_API_TOKEN" : "GEMINI_API_KEY"} environment variable is not set`,
        },
        { status: 503 }
      );
    }

    const imageCount = result.data.count ?? DEFAULT_COUNT;
    const imageProvider = await getImageProvider(result.data.provider);

    // Fetch user's image styles
    const imageStyles = await getUserImageStyles(session.user.id satisfies string);

    // Build per-style prompts
    // We strictly use the first N styles for now (normally 6)
    const prompts = imageStyles.slice(0, imageCount).map((style) =>
      buildImagePrompt(result.data.idea, style)
    );

    log("info", "Starting styled image generation", {
      requestId,
      provider: imageProvider.name,
      count: imageCount,
      ideaLength: result.data.idea.length,
    });

    const images = await imageProvider.generateImagesWithStyles(prompts);

    // Attach style metadata to images
    const imagesWithStyles = images.map((img, i) => ({
      ...img,
      styleId: imageStyles[i]?.id,
      styleName: imageStyles[i]?.name,
    }));

    log("info", "Image generation successful", {
      requestId,
      provider: imageProvider.name,
      count: imagesWithStyles.length,
    });

    return NextResponse.json({
      images: imagesWithStyles,
      provider: imageProvider.name,
      count: images.length,
    });
  } catch (error) {
    log("error", "Image generation failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Image generation failed",
        details:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
