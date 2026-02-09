import { GoogleGenAI } from "@google/genai";
import { createId } from "@paralleldrive/cuid2";
import { saveImageFromBase64 } from "@/lib/storage/images";
import { log } from "@/lib/logger";
import type { ImageProvider } from "./image-provider";
import type { GeneratedImage } from "@/types/generation";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
});

export class GeminiImageProvider implements ImageProvider {
  name = "gemini";

  async generateImages(
    prompt: string,
    count: number
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    log("info", `Generating ${count} images with Gemini Flash Image`, {
      promptLength: prompt.length,
    });

    const enhancedPrompt = `Professional LinkedIn post image: ${prompt}. Style: Clean, modern, business-appropriate. No text overlays.`;

    try {
      // Gemini Flash Image generates ONE image per call — fire N calls in parallel
      const imagePromises = Array.from({ length: count }, async (_, i) => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: enhancedPrompt,
        });

        const candidates = response.candidates;
        if (!candidates?.[0]?.content?.parts) {
          throw new Error(`No candidates in Gemini response (image ${i})`);
        }

        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            const id = `img-${createId()}`;
            const url = await saveImageFromBase64(
              part.inlineData.data ?? "",
              id
            );
            return { id, url, prompt } as GeneratedImage;
          }
        }

        throw new Error(`No image data in Gemini response (image ${i})`);
      });

      // Use allSettled so partial failures don't lose all images
      const results = await Promise.allSettled(imagePromises);
      const images = results
        .filter(
          (r): r is PromiseFulfilledResult<GeneratedImage> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value);

      const failures = results.filter((r) => r.status === "rejected").length;

      if (images.length === 0) {
        throw new Error("All image generations failed");
      }

      const duration = Date.now() - startTime;
      log("info", "Images generated via Gemini", {
        count: images.length,
        failures,
        duration,
      });

      return images;
    } catch (error) {
      log("error", "Gemini Image API error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
}
