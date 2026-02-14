

// --- Types ---

export interface ImageStyle {
    id: string;
    name: string;
    prompt: string;
}

// --- Defaults ---

export const DEFAULT_IMAGE_STYLES: ImageStyle[] = [
    {
        id: "photography",
        name: "Photography",
        prompt:
            "Clean professional photography, natural lighting, realistic, shot on Canon EOS R5",
    },
    {
        id: "illustration",
        name: "Illustration",
        prompt:
            "Digital illustration, hand-drawn feel, warm colors, artistic brushwork",
    },
    {
        id: "minimalist",
        name: "Minimalist",
        prompt:
            "Minimalist flat design, simple geometric shapes, limited color palette, clean lines",
    },
    {
        id: "abstract",
        name: "Abstract",
        prompt:
            "Abstract conceptual art, bold color blocking, dynamic geometric composition",
    },
    {
        id: "infographic",
        name: "Infographic",
        prompt:
            "Data visualization style, structured layouts, charts and diagrams, technical precision",
    },
    {
        id: "three-dimensional",
        name: "3D Render",
        prompt:
            "Modern 3D render, soft lighting, clean materials, isometric perspective",
    },
];

// --- Validation ---

export const IMAGE_STYLE_LIMITS = {
    NAME_MAX_LENGTH: 50,
    PROMPT_MAX_LENGTH: 700,
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

export function validateImageStyles(styles: unknown): {
    valid: boolean;
    error?: string;
} {
    if (
        !Array.isArray(styles) ||
        styles.length !== IMAGE_STYLE_LIMITS.REQUIRED_COUNT
    ) {
        return {
            valid: false,
            error: `Exactly ${IMAGE_STYLE_LIMITS.REQUIRED_COUNT} image styles required`,
        };
    }

    const typedStyles = styles as ImageStyle[];

    for (const style of typedStyles) {
        if (!style.id || !style.name || !style.prompt) {
            return {
                valid: false,
                error: "Each image style must have id, name, and prompt",
            };
        }
        if (style.name.length > IMAGE_STYLE_LIMITS.NAME_MAX_LENGTH) {
            return {
                valid: false,
                error: `Style name "${style.name}" exceeds ${IMAGE_STYLE_LIMITS.NAME_MAX_LENGTH} characters`,
            };
        }
        if (style.prompt.length > IMAGE_STYLE_LIMITS.PROMPT_MAX_LENGTH) {
            return {
                valid: false,
                error: `Prompt for "${style.name}" exceeds ${IMAGE_STYLE_LIMITS.PROMPT_MAX_LENGTH} characters`,
            };
        }
        if (style.name.trim().length === 0 || style.prompt.trim().length === 0) {
            return { valid: false, error: "Style name and prompt cannot be empty" };
        }
    }

    // Defense-in-depth: flag suspicious injection patterns
    for (const style of typedStyles) {
        for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(style.prompt) || pattern.test(style.name)) {
                return {
                    valid: false,
                    error: `"${style.name}" contains disallowed content`,
                };
            }
        }
    }

    // Verify all 6 canonical IDs are present
    const expectedIds = DEFAULT_IMAGE_STYLES.map((s) => s.id);
    const providedIds = typedStyles.map((s: ImageStyle) => s.id);
    const missingIds = expectedIds.filter((id) => !providedIds.includes(id));
    if (missingIds.length > 0) {
        return {
            valid: false,
            error: `Missing required style slots: ${missingIds.join(", ")}`,
        };
    }

    return { valid: true };
}

// --- Prompt Builder ---

export function buildImagePrompt(idea: string, style: ImageStyle): string {
    return `Professional LinkedIn post image about: ${idea}.
Visual style: ${style.prompt}.
Requirements: High quality, business-appropriate, no text overlays, no watermarks. Aspect ratio optimized for LinkedIn feed (landscape 16:9).`;
}

// Helper to create a fresh set of default styles with unique IDs if needed (though IDs are fixed for slots)
// For this system, we use fixed IDs for the 6 slots, so we just return a deep copy
export function getDefaultImageStyles(): ImageStyle[] {
    return JSON.parse(JSON.stringify(DEFAULT_IMAGE_STYLES));
}
