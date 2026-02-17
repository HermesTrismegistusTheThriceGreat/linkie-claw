import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import sharp from "sharp";
import { uploadImageToR2, isR2Configured } from "@/lib/storage/r2";
import { log } from "@/lib/logger";

/**
 * Re-encode image to strip all metadata (C2PA, EXIF, IPTC, XMP).
 * LinkedIn detects C2PA metadata embedded by AI providers (e.g. Google Gemini)
 * and displays a "CR" (Content Credentials) badge. Re-encoding removes it.
 * PNG re-encoding is lossless; WebP/JPEG use quality 90 (imperceptible loss).
 */
async function stripImageMetadata(buffer: Buffer, contentType: string): Promise<Buffer> {
  const image = sharp(buffer);
  if (contentType.includes("png")) {
    return image.png().toBuffer();
  }
  if (contentType.includes("webp")) {
    return image.webp({ quality: 90 }).toBuffer();
  }
  return image.jpeg({ quality: 90 }).toBuffer();
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Image storage not configured (R2 environment variables missing)" },
      { status: 503 }
    );
  }

  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();
    const { base64, tempUrl, contentType } = body;

    if (!base64 && !tempUrl) {
      return NextResponse.json(
        { error: "Either base64 or tempUrl is required" },
        { status: 400 }
      );
    }

    let imageBuffer: Buffer;
    let finalContentType: string;

    if (base64) {
      imageBuffer = Buffer.from(base64, "base64");
      finalContentType = contentType || "image/png";
    } else {
      const response = await fetch(tempUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from temp URL: ${response.statusText}`);
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
      finalContentType = response.headers.get("content-type") || contentType || "image/webp";
    }

    const ext = finalContentType.includes("webp")
      ? "webp"
      : finalContentType.includes("png")
        ? "png"
        : "jpg";

    const imageId = createId();
    const key = `posts/${session.user.id}/${imageId}.${ext}`;

    imageBuffer = await stripImageMetadata(imageBuffer, finalContentType);

    const publicUrl = await uploadImageToR2(imageBuffer, key, finalContentType);

    log("info", "Image uploaded via API", {
      requestId,
      key,
      size: imageBuffer.length,
      contentType: finalContentType,
      userId: session.user.id,
    });

    return NextResponse.json({ url: publicUrl, key });
  } catch (error) {
    log("error", "Image upload failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      userId: session.user.id,
    });

    return NextResponse.json(
      {
        error: "Image upload failed",
        details: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
