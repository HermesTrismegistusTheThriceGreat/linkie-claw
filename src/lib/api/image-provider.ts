import type { GeneratedImage } from "@/types/generation";

export interface ImageProvider {
  name: string;
  generateImages(prompt: string, count: number): Promise<GeneratedImage[]>;
  generateImagesWithStyles(prompts: string[]): Promise<GeneratedImage[]>;
}

export type ProviderName = "replicate" | "gemini";

/**
 * Async factory — uses dynamic import() to avoid loading unused SDKs.
 * Provider selected by: explicit param > IMAGE_PROVIDER env var > "replicate" default.
 */
export async function getImageProvider(
  provider?: ProviderName
): Promise<ImageProvider> {
  const selected =
    provider || (process.env.IMAGE_PROVIDER as ProviderName) || "replicate";

  switch (selected) {
    case "replicate": {
      const { ReplicateProvider } = await import("./replicate");
      return new ReplicateProvider();
    }
    case "gemini": {
      const { GeminiImageProvider } = await import("./gemini-image");
      return new GeminiImageProvider();
    }
    default:
      throw new Error(`Unknown image provider: ${selected}`);
  }
}
