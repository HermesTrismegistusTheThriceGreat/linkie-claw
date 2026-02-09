import Replicate from "replicate";
import { createId } from "@paralleldrive/cuid2";
import { downloadAndSaveImage } from "@/lib/storage/images";
import { log } from "@/lib/logger";
import type { ImageProvider } from "./image-provider";
import type { GeneratedImage } from "@/types/generation";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

const MODELS = {
  schnell: "black-forest-labs/flux-schnell" as const,
  dev: "black-forest-labs/flux-dev" as const,
  pro: "black-forest-labs/flux-1.1-pro" as const,
};

type ModelTier = keyof typeof MODELS;

export class ReplicateProvider implements ImageProvider {
  name = "replicate";
  private model: string;

  constructor(tier?: ModelTier) {
    const selectedTier =
      tier || (process.env.FLUX_MODEL_TIER as ModelTier) || "schnell";
    this.model = MODELS[selectedTier] || MODELS.schnell;
  }

  async generateImages(
    prompt: string,
    count: number
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    log("info", `Generating ${count} images with Replicate FLUX`, {
      model: this.model,
      promptLength: prompt.length,
    });

    const enhancedPrompt = `Professional LinkedIn post image: ${prompt}. Style: Clean, modern, business-appropriate. High quality photography or illustration. No text overlays, no watermarks.`;

    try {
      // FLUX Schnell supports up to 4 images per call via num_outputs
      const maxPerCall = 4;
      const batches = Math.ceil(count / maxPerCall);
      const imagePromises: Promise<GeneratedImage[]>[] = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchCount = Math.min(maxPerCall, count - batch * maxPerCall);

        imagePromises.push(
          (async () => {
            const output = await replicate.run(this.model as `${string}/${string}`, {
              input: {
                prompt: enhancedPrompt,
                num_outputs: batchCount,
                aspect_ratio: "16:9",
                output_format: "webp",
                output_quality: 90,
              },
            });

            const urls = Array.isArray(output) ? output : [output];
            const results: GeneratedImage[] = [];

            for (const url of urls) {
              const id = `img-${createId()}`;
              const localUrl = await downloadAndSaveImage(
                typeof url === "string" ? url : String(url),
                id
              );
              results.push({ id, url: localUrl, prompt });
            }

            return results;
          })()
        );
      }

      const settled = await Promise.allSettled(imagePromises);
      const images = settled
        .filter(
          (r): r is PromiseFulfilledResult<GeneratedImage[]> =>
            r.status === "fulfilled"
        )
        .flatMap((r) => r.value);

      const failures = settled.filter((r) => r.status === "rejected").length;

      if (images.length === 0) {
        throw new Error("All image generation batches failed");
      }

      const duration = Date.now() - startTime;
      log("info", "Images generated via Replicate", {
        count: images.length,
        failures,
        duration,
        model: this.model,
      });

      return images;
    } catch (error) {
      log("error", "Replicate API error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        model: this.model,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
}
