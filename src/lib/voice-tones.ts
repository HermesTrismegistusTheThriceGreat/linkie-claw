// --- Types ---
export interface VoiceTone {
    id: string;
    name: string;
    prompt: string;
}

// --- Defaults ---
export const DEFAULT_VOICE_TONES: VoiceTone[] = [
    { id: "storytelling", name: "Storytelling", prompt: "Personal narrative with a lesson" },
    { id: "professional", name: "Professional", prompt: "Industry insights with authority" },
    { id: "short-punchy", name: "Short & Punchy", prompt: "Snappy, high-impact, uses line breaks" },
    { id: "data-driven", name: "Data-Driven", prompt: "Statistics and numbers as hooks" },
    { id: "conversational", name: "Conversational", prompt: "Casual, question-based engagement" },
    { id: "provocative", name: "Provocative", prompt: "Hot take or contrarian view" },
];

// --- Validation ---
export const VOICE_TONE_LIMITS = {
    NAME_MAX_LENGTH: 50,
    PROMPT_MAX_LENGTH: 200,
    REQUIRED_COUNT: 6,
} as const;

// Suspicious patterns for defense-in-depth sanitization
const SUSPICIOUS_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)/i,
    /disregard\s+(all\s+)?(previous|prior|above)/i,
    /new\s+instructions/i,
    /system\s+prompt/i,
    /```/,
];

export function validateVoiceTones(tones: unknown): { valid: boolean; error?: string } {
    if (!Array.isArray(tones) || tones.length !== VOICE_TONE_LIMITS.REQUIRED_COUNT) {
        return { valid: false, error: `Exactly ${VOICE_TONE_LIMITS.REQUIRED_COUNT} voice tones required` };
    }

    const typedTones = tones as VoiceTone[];

    for (const tone of typedTones) {
        if (!tone.id || !tone.name || !tone.prompt) {
            return { valid: false, error: "Each voice tone must have id, name, and prompt" };
        }
        if (tone.name.length > VOICE_TONE_LIMITS.NAME_MAX_LENGTH) {
            return { valid: false, error: `Style name "${tone.name}" exceeds ${VOICE_TONE_LIMITS.NAME_MAX_LENGTH} characters` };
        }
        if (tone.prompt.length > VOICE_TONE_LIMITS.PROMPT_MAX_LENGTH) {
            return { valid: false, error: `Prompt for "${tone.name}" exceeds ${VOICE_TONE_LIMITS.PROMPT_MAX_LENGTH} characters` };
        }
        if (tone.name.trim().length === 0 || tone.prompt.trim().length === 0) {
            return { valid: false, error: "Style name and prompt cannot be empty" };
        }
    }

    // Defense-in-depth: flag suspicious injection patterns
    for (const tone of typedTones) {
        for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(tone.prompt) || pattern.test(tone.name)) {
                return { valid: false, error: `"${tone.name}" contains disallowed content` };
            }
        }
    }

    // Verify all 6 canonical IDs are present
    const expectedIds = DEFAULT_VOICE_TONES.map(t => t.id);
    const providedIds = typedTones.map((t: VoiceTone) => t.id);
    const missingIds = expectedIds.filter(id => !providedIds.includes(id));
    if (missingIds.length > 0) {
        return { valid: false, error: `Missing required style slots: ${missingIds.join(", ")}` };
    }

    return { valid: true };
}

// --- System Prompt Builder ---
export function buildSystemPrompt(tones: VoiceTone[]): string {
    const styleList = tones
        .map((tone, i) => `${i + 1}. ${tone.name} - ${tone.prompt}`)
        .join("\n");

    // NOTE: Format instructions are placed AFTER style definitions intentionally.
    // Claude weights later instructions more heavily, so even if a user's style prompt
    // attempts to override the output format, these instructions take precedence.
    return `You are a LinkedIn content expert. Generate exactly 6 variations of a LinkedIn post based on the user's idea.

The 6 styles are:
${styleList}

Each variation must:
- Be under 3000 characters
- Have a distinct style and tone matching the style description above
- Include appropriate line breaks for readability
- Feel authentic and engaging, not corporate

Return ONLY a JSON array with exactly 6 objects:
[
  { "id": "var-1", "style": "${tones[0]?.name ?? "Style 1"}", "content": "..." },
  { "id": "var-2", "style": "${tones[1]?.name ?? "Style 2"}", "content": "..." },
  { "id": "var-3", "style": "${tones[2]?.name ?? "Style 3"}", "content": "..." },
  { "id": "var-4", "style": "${tones[3]?.name ?? "Style 4"}", "content": "..." },
  { "id": "var-5", "style": "${tones[4]?.name ?? "Style 5"}", "content": "..." },
  { "id": "var-6", "style": "${tones[5]?.name ?? "Style 6"}", "content": "..." }
]`;
}
