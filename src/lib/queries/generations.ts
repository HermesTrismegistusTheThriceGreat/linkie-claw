import {
  mockTextVariations,
  mockImages,
  mockGenerationSession,
} from "@/lib/mock-data/generations";
import type {
  TextVariation,
  GeneratedImage,
  GenerationSession,
} from "@/types/generation";

export async function generateTextVariations(
  idea: string
): Promise<TextVariation[]> {
  try {
    const response = await fetch("/api/generate/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Text generation API error:", error);
      throw new Error(error.error || "Text generation failed");
    }

    const data = await response.json();
    return data.variations;
  } catch (error) {
    console.error("Text generation failed, using mock data:", error);
    // Fallback to mock data for development without API key
    return mockTextVariations.map((v) => ({
      ...v,
      id: `${v.id}-${Date.now()}`,
    }));
  }
}

export async function generateImages(prompt: string): Promise<GeneratedImage[]> {
  try {
    const response = await fetch("/api/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Image generation API error:", error);
      throw new Error(error.error || "Image generation failed");
    }

    const data = await response.json();
    return data.images;
  } catch (error) {
    console.error("Image generation failed, using mock data:", error);
    return mockImages.map((img) => ({
      ...img,
      id: `${img.id}-${Date.now()}`,
      prompt,
    }));
  }
}

export async function getGenerationSession(
  id: string
): Promise<GenerationSession | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (id === mockGenerationSession.id) {
    return mockGenerationSession;
  }

  return undefined;
}

export async function createGenerationSession(
  idea: string
): Promise<GenerationSession> {
  // Generate both text and images in parallel
  const [textVariations, images] = await Promise.all([
    generateTextVariations(idea),
    generateImages(idea),
  ]);

  return {
    id: `session-${Date.now()}`,
    idea,
    textVariations,
    images,
    createdAt: new Date(),
  };
}
