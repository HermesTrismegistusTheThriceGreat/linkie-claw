import Anthropic from "@anthropic-ai/sdk";
import { log } from "@/lib/logger";
import type { TextVariation } from "@/types/generation";

import { buildSystemPrompt, DEFAULT_VOICE_TONES, type VoiceTone } from "@/lib/voice-tones";

const client = new Anthropic();

/**
 * Generate 6 LinkedIn post variations from a user's idea using Claude.
 *
 * @param idea - The user's post idea or topic
 * @param voiceTones - Optional custom voice tones (defaults used if omitted)
 * @returns Array of 6 TextVariation objects with different styles
 * @throws Error if API call fails or response is invalid
 */
export async function generateTextVariations(
  idea: string,
  voiceTones?: VoiceTone[]
): Promise<TextVariation[]> {
  const startTime = Date.now();

  log("info", "Text generation started", {
    ideaLength: idea.length,
  });

  try {
    const tones = voiceTones ?? DEFAULT_VOICE_TONES;
    const systemPrompt = buildSystemPrompt(tones);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: idea }],
    });

    // Extract text content from response
    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    if (!text) {
      throw new Error("No text content in Claude response");
    }

    // Parse JSON, handling potential markdown code blocks
    let variations: TextVariation[];
    try {
      // Remove markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
        null,
        text,
      ];
      const jsonText = jsonMatch[1]?.trim() || text.trim();

      variations = JSON.parse(jsonText) as TextVariation[];
    } catch (parseError) {
      log("error", "Failed to parse Claude response as JSON", {
        error:
          parseError instanceof Error ? parseError.message : String(parseError),
        responsePreview: text.substring(0, 200),
      });
      throw new Error("Invalid JSON response from Claude");
    }

    // Validate we got exactly 6 variations
    if (!Array.isArray(variations) || variations.length !== 6) {
      throw new Error(
        `Expected 6 variations, got ${Array.isArray(variations) ? variations.length : "non-array"}`
      );
    }

    // Validate each variation has required fields
    for (const variation of variations) {
      if (!variation.id || !variation.style || !variation.content) {
        throw new Error(
          "Variation missing required fields (id, style, content)"
        );
      }
      if (variation.content.length > 3000) {
        log("warn", "Variation exceeds 3000 character limit", {
          variationId: variation.id,
          length: variation.content.length,
        });
      }
    }

    const duration = Date.now() - startTime;

    log("info", "Text generation completed", {
      duration,
      variationCount: variations.length,
      totalChars: variations.reduce((sum, v) => sum + v.content.length, 0),
    });

    return variations;
  } catch (error) {
    const duration = Date.now() - startTime;

    log("error", "Text generation failed", {
      duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}
