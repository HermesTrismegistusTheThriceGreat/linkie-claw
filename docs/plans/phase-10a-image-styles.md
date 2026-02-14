# Phase 10a: Image Styles — Agent Team Plan

Add user-customizable "Image Styles" system to generate 6 images with different visual mediums (Photography, Illustration, Minimalist, Abstract, Infographic, 3D Render). Each image uses a different prompt based on user-editable image style definitions.

## Overview

Currently, image generation produces 6 identical images using the same generic prompt. This phase makes image generation as smart as text generation — each of the 6 images uses a different visual style defined by user-customizable prompts. The system mirrors the voice tones architecture exactly: default styles, user customization, database storage, and a settings page.

**CRITICAL: This is independent of voice tones. Image styles are visual mediums, not writing tones.**

## Requirements Summary

- New `ImageStyle` type with `id`, `name`, `prompt` fields (mirrors `VoiceTone` structure)
- 6 default image styles: Photography, Illustration, Minimalist, Abstract, Infographic, 3D Render
- `buildImagePrompt(idea, style)` function constructs enhanced prompts optimized for Gemini
- `image_styles_json` column in `userSettings` table (new Drizzle migration required)
- `getUserImageStyles()` / `saveUserImageStyles()` database queries
- Image Styles settings page at `/image-styles` (mirrors `/voice-tones` page exactly)
- Update image generation API route to use per-style prompts
- Add `generateImagesWithStyles(prompts[])` method to both Gemini and Replicate providers
- Update `GeneratedImage` type to include `styleId` and `styleName`
- Update image cards in studio to display style badges
- Client-side query changes to send `idea` instead of flat `prompt`

## Research Findings

### Voice Tones Architecture (Exact Pattern to Follow)

The voice tones system (`src/lib/voice-tones.ts`) provides the complete blueprint:

| Component | Voice Tones | Image Styles (New) |
|-----------|-------------|-------------------|
| **Type definition** | `VoiceTone { id, name, prompt }` | `ImageStyle { id, name, prompt }` |
| **Defaults** | 6 voice tones with canonical IDs | 6 image styles with canonical IDs |
| **Validation** | `validateVoiceTones()` enforces count, lengths, suspicious patterns, canonical IDs | `validateImageStyles()` — same enforcement |
| **System prompt** | `buildSystemPrompt(tones)` for Claude | `buildImagePrompt(idea, style)` for Gemini/FLUX |
| **Database** | `voice_tones_json` TEXT column, null = defaults | `image_styles_json` TEXT column, null = defaults |
| **Queries** | `getUserVoiceTones(userId)`, `saveUserVoiceTones(userId, tones)` | `getUserImageStyles(userId)`, `saveUserImageStyles(userId, styles)` |
| **Settings page** | `/voice-tones` page + server actions | `/image-styles` page + server actions |
| **Editor component** | `voice-tones-editor.tsx` with unsaved changes guard | `image-styles-editor.tsx` with same guard |

**Key insight:** Voice tones validation (lines 34-74) has 4 layers:
1. Array length check (exactly 6)
2. Field presence and type validation
3. Max length enforcement (NAME_MAX_LENGTH, PROMPT_MAX_LENGTH)
4. Suspicious pattern detection (prompt injection defense)
5. Canonical ID enforcement (all 6 default IDs must be present)

Image styles validation must follow this exact pattern.

### Database Storage Pattern

Voice tones use `voice_tones_json: text("voice_tones_json")` (line 151, schema.ts) with:
- Null = use defaults (no DB row overhead for default users)
- JSON serialization of full array
- upsert pattern in `saveUserVoiceTones()` (queries.ts line 435)

Migration required:
```typescript
// New migration: drizzle/0XXX_add_image_styles_column.sql
ALTER TABLE user_settings ADD COLUMN image_styles_json TEXT;
```

### Image Generation Current State

**Route:** `src/app/api/generate/image/route.ts`
- Takes `{ prompt, count?, provider? }` (line 25)
- Calls `imageProvider.generateImages(prompt, count)` (lines 81-84)
- Returns `{ images, provider, count }`

**Gemini Provider:** `src/lib/api/gemini-image.ts`
- Generates N images in parallel (lines 28-51)
- Current prompt: `"Professional LinkedIn post image: ${prompt}. Style: Clean, modern, business-appropriate. No text overlays."` (line 24)
- Uses `Promise.allSettled()` for partial failure tolerance (line 54)

**Replicate Provider:** `src/lib/api/replicate.ts`
- Batches requests (4 images per API call) (lines 44-78)
- Current prompt: `"Professional LinkedIn post image: ${prompt}. Style: Clean, modern, business-appropriate. High quality photography or illustration. No text overlays, no watermarks."` (line 40)
- Uses `Promise.allSettled()` for partial failure tolerance (line 80)

**Problem:** All N images use the same prompt. No per-image customization.

### Image Provider Interface

Current interface (`src/lib/api/image-provider.ts`, lines 3-6):
```typescript
export interface ImageProvider {
  name: string;
  generateImages(prompt: string, count: number): Promise<GeneratedImage[]>;
}
```

**New method needed:**
```typescript
generateImagesWithStyles(prompts: string[]): Promise<GeneratedImage[]>;
// Takes array of different prompts, returns same count of images
// Each image matches its corresponding prompt from the array
```

Keep the old `generateImages()` method for backward compatibility (fallback).

### GeneratedImage Type

Current type (`src/types/generation.ts`, lines 9-13):
```typescript
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
}
```

**Enhancement needed:**
```typescript
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  styleId?: string;    // e.g., "photography"
  styleName?: string;  // e.g., "Photography"
}
```

This lets the UI show which style generated each image (as a badge on the image card).

### Client-Side Generation Flow

Current flow (`src/lib/queries/generations.ts`, lines 40-64):
1. Client calls `generateImages(prompt)`
2. Sends `{ prompt }` to `/api/generate/image`
3. API route enhances prompt and generates images

**New flow:**
1. Client calls `generateImages(idea)` — now sends the raw idea, not a pre-built prompt
2. Sends `{ idea }` to `/api/generate/image`
3. API route fetches user's image styles
4. API route builds 6 different prompts via `buildImagePrompt(idea, style)`
5. API route calls `generateImagesWithStyles([prompt1, prompt2, ..., prompt6])`

### Image Card UI

Current component (`src/components/studio/image-card.tsx`):
- Shows image with select overlay (lines 14-44)
- No style metadata displayed

**Enhancement needed:**
- Add style badge similar to text variation cards (voice tone badge)
- Display `image.styleName` (e.g., "Photography") as a label
- Use `data-testid="image-style-badge-${image.id}"`

### Sidebar Navigation

Current nav items (`src/components/layout/sidebar.tsx`, lines 15-22):
```typescript
const navItems: NavItem[] = [
  { href: "/", icon: "dashboard", label: "Dashboard" },
  { href: "/calendar", icon: "calendar_month", label: "Content Calendar" },
  { href: "/analytics", icon: "insights", label: "Analytics" },
  { href: "/create", icon: "auto_fix", label: "AI Writer" },
  { href: "/voice-tones", icon: "record_voice_over", label: "Voice & Tones" },
  { href: "/settings", icon: "settings", label: "Settings" },
];
```

**Add after voice-tones:**
```typescript
{ href: "/image-styles", icon: "palette", label: "Image Styles" },
```

## Agent Build Order & Communication

### Contract Chain

```
Image Styles Core (Agent 1) → publishes ImageStyle type + DB queries + API contracts → Image Styles Settings Page (Agent 2) + Studio Integration (Agent 3)
```

Agent 1 is upstream — creates core library, database changes, and API modifications. Agents 2 and 3 can work **in parallel** after Agent 1 publishes its contracts.

### Agent Roles (3 Agents)

#### Agent 1: Image Styles Core
**Owns (creates):**
- `src/lib/image-styles.ts` (NEW)
- Drizzle migration file `drizzle/XXXX_add_image_styles_column.sql` (NEW)

**Owns (modifies):**
- `src/lib/db/schema.ts` — add `image_styles_json` column to `userSettings`
- `src/lib/db/queries.ts` — add `getUserImageStyles()` and `saveUserImageStyles()`
- `src/lib/api/image-provider.ts` — add `generateImagesWithStyles()` to interface
- `src/lib/api/gemini-image.ts` — implement `generateImagesWithStyles()`
- `src/lib/api/replicate.ts` — implement `generateImagesWithStyles()`
- `src/app/api/generate/image/route.ts` — use image styles for per-prompt generation
- `src/lib/validations/generation.ts` — update `generateImageSchema` to accept `idea`
- `src/types/generation.ts` — add `styleId` and `styleName` to `GeneratedImage`

**Does NOT touch:**
- `src/app/image-styles/` (Agent 2 territory)
- `src/components/image-styles/` (Agent 2 territory)
- `src/components/layout/sidebar.tsx` (Agent 2 territory)
- `src/lib/queries/generations.ts` (Agent 3 territory)
- `src/components/studio/image-card.tsx` (Agent 3 territory)
- `src/components/studio/image-grid.tsx` (Agent 3 territory)

**Responsibilities:**
1. Create `src/lib/image-styles.ts` with types, defaults, validation, and `buildImagePrompt()`
2. Add `image_styles_json` column to `userSettings` schema and create migration
3. Add `getUserImageStyles()` and `saveUserImageStyles()` query functions
4. Add `generateImagesWithStyles()` to `ImageProvider` interface
5. Implement `generateImagesWithStyles()` in both Gemini and Replicate providers
6. Update image generation API route to fetch user styles and build per-style prompts
7. Update validation schema to accept `idea` field
8. Enhance `GeneratedImage` type with style metadata

#### Agent 2: Image Styles Settings Page
**Owns (creates):**
- `src/app/image-styles/page.tsx` (NEW)
- `src/app/image-styles/actions.ts` (NEW)
- `src/components/image-styles/image-styles-editor.tsx` (NEW)

**Owns (modifies):**
- `src/components/layout/sidebar.tsx` — add "Image Styles" nav item

**Does NOT touch:**
- `src/lib/image-styles.ts` (Agent 1 territory)
- `src/lib/db/queries.ts` (Agent 1 territory)
- `src/app/api/generate/image/route.ts` (Agent 1 territory)
- `src/lib/queries/generations.ts` (Agent 3 territory)
- `src/components/studio/` (Agent 3 territory)

**Responsibilities:**
1. Create Image Styles settings page (server component) — mirrors voice-tones page exactly
2. Create server actions for update/reset — mirrors voice-tones actions exactly
3. Create editor component with unsaved changes guard — mirrors voice-tones-editor exactly
4. Add "Image Styles" nav item to sidebar (after "Voice & Tones")

#### Agent 3: Studio Integration
**Owns (modifies):**
- `src/lib/queries/generations.ts` — update `generateImages()` to send `idea` instead of `prompt`
- `src/components/studio/image-card.tsx` — display style badge
- `src/components/studio/image-grid.tsx` — pass style info through to cards

**Does NOT touch:**
- `src/lib/image-styles.ts` (Agent 1 territory)
- `src/app/api/generate/image/route.ts` (Agent 1 territory)
- `src/app/image-styles/` (Agent 2 territory)
- `src/components/layout/sidebar.tsx` (Agent 2 territory)

**Responsibilities:**
1. Update client-side `generateImages()` query to send `{ idea }` instead of `{ prompt }`
2. Update image card to show style name badge (like text variation cards show voice tone)
3. Update image grid to pass style metadata through to image cards

### Cross-Cutting Concerns

| Concern | Owner | Detail |
|---------|-------|--------|
| `ImageStyle` type | Agent 1 | Exported from `src/lib/image-styles.ts`. Agents 2 and 3 import this. |
| Validation rules | Agent 1 | Max lengths: `NAME_MAX_LENGTH: 50`, `PROMPT_MAX_LENGTH: 300`. REQUIRED_COUNT: 6. Canonical IDs enforced. |
| Database migration | Agent 1 | Creates migration file. Must be backward compatible (null = defaults). |
| `image_styles_json` column | Agent 1 | Added to schema. Agent 2 uses via query functions only. |
| `buildImagePrompt()` | Agent 1 | Server-side only. Constructs enhanced prompts for Gemini/FLUX. Used by API route, not client code. |
| Unsaved changes guard | Agent 2 | Uses `useUnsavedChanges` hook (already exists in voice-tones-editor). |
| Style badge UI | Agent 3 | Displays `image.styleName` on image cards. Uses same badge design as text variation cards. |
| Backward compatibility | Agent 1 | Old `generateImages(prompt, count)` method must still work. New `generateImagesWithStyles(prompts[])` is additive. |

## Implementation Tasks

### Phase 1: Contracts (Sequential — Agent 1 first)

**Agent 1 (Image Styles Core) publishes:**

1. **ImageStyle type contract**
   ```typescript
   export interface ImageStyle {
     id: string;       // Canonical identifier (e.g., "photography")
     name: string;     // User-editable display name (e.g., "Photography")
     prompt: string;   // User-editable prompt description for image generation
   }
   ```

2. **Default image styles**
   ```typescript
   export const DEFAULT_IMAGE_STYLES: ImageStyle[] = [
     { id: "photography", name: "Photography", prompt: "Clean professional photography, natural lighting, realistic, shot on Canon EOS R5" },
     { id: "illustration", name: "Illustration", prompt: "Digital illustration, hand-drawn feel, warm colors, artistic brushwork" },
     { id: "minimalist", name: "Minimalist", prompt: "Minimalist flat design, simple geometric shapes, limited color palette, clean lines" },
     { id: "abstract", name: "Abstract", prompt: "Abstract conceptual art, bold color blocking, dynamic geometric composition" },
     { id: "infographic", name: "Infographic", prompt: "Data visualization style, structured layouts, charts and diagrams, technical precision" },
     { id: "three-dimensional", name: "3D Render", prompt: "Modern 3D render, soft lighting, clean materials, isometric perspective" },
   ];
   ```

3. **Validation limits**
   ```typescript
   export const IMAGE_STYLE_LIMITS = {
     NAME_MAX_LENGTH: 50,
     PROMPT_MAX_LENGTH: 300,
     REQUIRED_COUNT: 6,
   } as const;
   ```

4. **Validation function signature**
   ```typescript
   export function validateImageStyles(styles: unknown): { valid: boolean; error?: string }
   // Enforces: exactly 6 styles, all fields present, max lengths, no suspicious patterns, canonical IDs present
   ```

5. **Prompt builder signature**
   ```typescript
   export function buildImagePrompt(idea: string, style: ImageStyle): string
   // Constructs: "Professional LinkedIn post image about: {idea}. Visual style: {style.prompt}. Requirements: High quality, business-appropriate, no text overlays, no watermarks. Aspect ratio optimized for LinkedIn feed (landscape 16:9)."
   ```

6. **Database query signatures**
   ```typescript
   export async function getUserImageStyles(userId: string): Promise<ImageStyle[]>
   // Returns user's custom styles or DEFAULT_IMAGE_STYLES if null

   export async function saveUserImageStyles(userId: string, styles: ImageStyle[]): Promise<void>
   // Upserts image_styles_json column
   ```

7. **ImageProvider interface extension**
   ```typescript
   export interface ImageProvider {
     name: string;
     generateImages(prompt: string, count: number): Promise<GeneratedImage[]>; // Keep for backward compat
     generateImagesWithStyles(prompts: string[]): Promise<GeneratedImage[]>;   // NEW
   }
   ```

8. **GeneratedImage type enhancement**
   ```typescript
   export interface GeneratedImage {
     id: string;
     url: string;
     prompt: string;
     styleId?: string;    // NEW — which image style generated this
     styleName?: string;  // NEW — display name (e.g., "Photography")
   }
   ```

9. **API route contract change**
   ```
   POST /api/generate/image
   Request body (NEW): { idea: string, count?: number, provider?: "replicate" | "gemini" }
   Response (ENHANCED): { images: GeneratedImage[], provider: string, count: number }
   Side effects:
     1. Fetch user's image styles via getUserImageStyles(userId)
     2. Build 6 prompts via buildImagePrompt(idea, style) for each style
     3. Call provider.generateImagesWithStyles([prompt1, ..., prompt6])
     4. Return images with styleId and styleName metadata
   ```

10. **Validation schema change**
    ```typescript
    export const generateImageSchema = z.object({
      idea: z.string().min(10).max(1000),  // CHANGED from "prompt"
      count: z.number().int().min(1).max(6).optional(),
      provider: z.enum(["replicate", "gemini"]).optional(),
    });
    ```

### Phase 2: Implementation (Parallel after Agent 1 publishes)

---

**Agent 1 (Image Styles Core) Tasks:**

#### Task 1: Create `src/lib/image-styles.ts`

```typescript
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
    prompt: "Clean professional photography, natural lighting, realistic, shot on Canon EOS R5",
  },
  {
    id: "illustration",
    name: "Illustration",
    prompt: "Digital illustration, hand-drawn feel, warm colors, artistic brushwork",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    prompt: "Minimalist flat design, simple geometric shapes, limited color palette, clean lines",
  },
  {
    id: "abstract",
    name: "Abstract",
    prompt: "Abstract conceptual art, bold color blocking, dynamic geometric composition",
  },
  {
    id: "infographic",
    name: "Infographic",
    prompt: "Data visualization style, structured layouts, charts and diagrams, technical precision",
  },
  {
    id: "three-dimensional",
    name: "3D Render",
    prompt: "Modern 3D render, soft lighting, clean materials, isometric perspective",
  },
];

// --- Validation ---
export const IMAGE_STYLE_LIMITS = {
  NAME_MAX_LENGTH: 50,
  PROMPT_MAX_LENGTH: 300,
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

export function validateImageStyles(styles: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(styles) || styles.length !== IMAGE_STYLE_LIMITS.REQUIRED_COUNT) {
    return { valid: false, error: `Exactly ${IMAGE_STYLE_LIMITS.REQUIRED_COUNT} image styles required` };
  }

  const typedStyles = styles as ImageStyle[];

  for (const style of typedStyles) {
    if (!style.id || !style.name || !style.prompt) {
      return { valid: false, error: "Each image style must have id, name, and prompt" };
    }
    if (style.name.length > IMAGE_STYLE_LIMITS.NAME_MAX_LENGTH) {
      return { valid: false, error: `Style name "${style.name}" exceeds ${IMAGE_STYLE_LIMITS.NAME_MAX_LENGTH} characters` };
    }
    if (style.prompt.length > IMAGE_STYLE_LIMITS.PROMPT_MAX_LENGTH) {
      return { valid: false, error: `Prompt for "${style.name}" exceeds ${IMAGE_STYLE_LIMITS.PROMPT_MAX_LENGTH} characters` };
    }
    if (style.name.trim().length === 0 || style.prompt.trim().length === 0) {
      return { valid: false, error: "Style name and prompt cannot be empty" };
    }
  }

  // Defense-in-depth: flag suspicious injection patterns
  for (const style of typedStyles) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(style.prompt) || pattern.test(style.name)) {
        return { valid: false, error: `"${style.name}" contains disallowed content` };
      }
    }
  }

  // Verify all 6 canonical IDs are present
  const expectedIds = DEFAULT_IMAGE_STYLES.map((s) => s.id);
  const providedIds = typedStyles.map((s: ImageStyle) => s.id);
  const missingIds = expectedIds.filter((id) => !providedIds.includes(id));
  if (missingIds.length > 0) {
    return { valid: false, error: `Missing required style slots: ${missingIds.join(", ")}` };
  }

  return { valid: true };
}

// --- Prompt Builder ---
export function buildImagePrompt(idea: string, style: ImageStyle): string {
  return `Professional LinkedIn post image about: ${idea}.
Visual style: ${style.prompt}.
Requirements: High quality, business-appropriate, no text overlays, no watermarks. Aspect ratio optimized for LinkedIn feed (landscape 16:9).`;
}
```

- **File**: `src/lib/image-styles.ts` (NEW)
- **Dependencies**: None (standalone library)
- **Pattern**: Exact mirror of `src/lib/voice-tones.ts` structure

#### Task 2: Add `image_styles_json` column to schema and create migration

**Modify `src/lib/db/schema.ts`:**

Add after line 151 (after `voice_tones_json`):
```typescript
image_styles_json: text("image_styles_json"), // JSON array of 6 ImageStyle objects, null = defaults
```

**Create migration file `drizzle/XXXX_add_image_styles_column.sql`:**
```sql
-- Add image styles customization column to user_settings
ALTER TABLE user_settings ADD COLUMN image_styles_json TEXT;
```

- **Files Modified**: `src/lib/db/schema.ts`
- **Files Created**: `drizzle/XXXX_add_image_styles_column.sql` (use next sequential number)
- **Dependencies**: Existing schema structure

#### Task 3: Add image styles query functions to `src/lib/db/queries.ts`

Add after line 439 (after `saveUserVoiceTones`), in the User Settings Queries section:

```typescript
/**
 * Get user image styles (or defaults if not set).
 * @param userId - The user ID
 */
export async function getUserImageStyles(userId: string): Promise<ImageStyle[]> {
  const settings = await getUserSettings(userId);
  if (!settings?.image_styles_json) {
    return DEFAULT_IMAGE_STYLES;
  }
  try {
    return JSON.parse(settings.image_styles_json) as ImageStyle[];
  } catch {
    return DEFAULT_IMAGE_STYLES;
  }
}

/**
 * Save user image styles.
 * @param userId - The user ID
 * @param styles - The image styles to save
 */
export async function saveUserImageStyles(userId: string, styles: ImageStyle[]): Promise<void> {
  await upsertUserSettings(userId, {
    image_styles_json: JSON.stringify(styles),
  });
}
```

**Add imports at top of file:**
```typescript
import { DEFAULT_IMAGE_STYLES, type ImageStyle } from "@/lib/image-styles";
```

- **File**: `src/lib/db/queries.ts`
- **Location**: After line 439
- **Dependencies**: Uses existing `getUserSettings()` and `upsertUserSettings()`

#### Task 4: Add `generateImagesWithStyles()` to `ImageProvider` interface

**Modify `src/lib/api/image-provider.ts`:**

```typescript
export interface ImageProvider {
  name: string;
  generateImages(prompt: string, count: number): Promise<GeneratedImage[]>;
  generateImagesWithStyles(prompts: string[]): Promise<GeneratedImage[]>;  // NEW
}
```

- **File**: `src/lib/api/image-provider.ts`
- **Change**: Add new method to interface (both providers must implement it)

#### Task 5: Implement `generateImagesWithStyles()` in Gemini provider

**Modify `src/lib/api/gemini-image.ts`:**

Add after the `generateImages()` method (after line 84):

```typescript
async generateImagesWithStyles(
  prompts: string[]
): Promise<GeneratedImage[]> {
  const startTime = Date.now();
  log("info", `Generating ${prompts.length} images with Gemini Flash Image (styled)`, {
    promptCount: prompts.length,
  });

  try {
    // Gemini generates ONE image per call — fire N calls in parallel
    const imagePromises = prompts.map(async (prompt, i) => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
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
    log("info", "Styled images generated via Gemini", {
      count: images.length,
      failures,
      duration,
    });

    return images;
  } catch (error) {
    log("error", "Gemini Image API error (styled)", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime,
    });
    throw error;
  }
}
```

- **File**: `src/lib/api/gemini-image.ts`
- **Location**: After `generateImages()` method
- **Dependencies**: Uses existing imports and helpers

#### Task 6: Implement `generateImagesWithStyles()` in Replicate provider

**Modify `src/lib/api/replicate.ts`:**

Add after the `generateImages()` method (after line 112):

```typescript
async generateImagesWithStyles(
  prompts: string[]
): Promise<GeneratedImage[]> {
  const startTime = Date.now();
  log("info", `Generating ${prompts.length} images with Replicate FLUX (styled)`, {
    model: this.model,
    promptCount: prompts.length,
  });

  try {
    // FLUX doesn't support different prompts in one batch — fire N separate calls
    const imagePromises = prompts.map(async (prompt) => {
      const output = await replicate.run(this.model as `${string}/${string}`, {
        input: {
          prompt,
          num_outputs: 1,
          aspect_ratio: "16:9",
          output_format: "webp",
          output_quality: 90,
        },
      });

      const urls = Array.isArray(output) ? output : [output];
      const url = urls[0];
      const id = `img-${createId()}`;
      const localUrl = await downloadAndSaveImage(
        typeof url === "string" ? url : String(url),
        id
      );
      return { id, url: localUrl, prompt } as GeneratedImage;
    });

    const settled = await Promise.allSettled(imagePromises);
    const images = settled
      .filter(
        (r): r is PromiseFulfilledResult<GeneratedImage> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);

    const failures = settled.filter((r) => r.status === "rejected").length;

    if (images.length === 0) {
      throw new Error("All styled image generations failed");
    }

    const duration = Date.now() - startTime;
    log("info", "Styled images generated via Replicate", {
      count: images.length,
      failures,
      duration,
      model: this.model,
    });

    return images;
  } catch (error) {
    log("error", "Replicate API error (styled)", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      model: this.model,
      duration: Date.now() - startTime,
    });
    throw error;
  }
}
```

- **File**: `src/lib/api/replicate.ts`
- **Location**: After `generateImages()` method
- **Dependencies**: Uses existing imports and helpers

#### Task 7: Update image generation API route

**Modify `src/app/api/generate/image/route.ts`:**

**Add imports at top:**
```typescript
import { getUserImageStyles } from "@/lib/db/queries";
import { buildImagePrompt } from "@/lib/image-styles";
```

**Replace lines 24-84 (validation + generation block) with:**

```typescript
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

// Fetch user's image styles
const imageStyles = await getUserImageStyles(session.user.id);
const imageCount = result.data.count ?? 6;

// Build per-style prompts
const prompts = imageStyles.slice(0, imageCount).map((style) =>
  buildImagePrompt(result.data.idea, style)
);

const imageProvider = await getImageProvider(result.data.provider);

log("info", "Starting styled image generation", {
  requestId,
  provider: imageProvider.name,
  count: imageCount,
  ideaLength: result.data.idea.length,
});

// Clean up old images before generating new ones
const cleaned = await cleanupOldImages();
if (cleaned > 0) {
  log("info", "Cleaned up old images", { requestId, deleted: cleaned });
}

const images = await imageProvider.generateImagesWithStyles(prompts);

// Attach style metadata to images
const imagesWithStyles = images.map((img, i) => ({
  ...img,
  styleId: imageStyles[i]?.id,
  styleName: imageStyles[i]?.name,
}));

log("info", "Styled image generation successful", {
  requestId,
  provider: imageProvider.name,
  count: imagesWithStyles.length,
});

return NextResponse.json({
  images: imagesWithStyles,
  provider: imageProvider.name,
  count: imagesWithStyles.length,
});
```

- **File**: `src/app/api/generate/image/route.ts`
- **Changes**: Fetch user styles, build per-style prompts, attach metadata
- **Dependencies**: Uses new query functions and `buildImagePrompt()`

#### Task 8: Update validation schema

**Modify `src/lib/validations/generation.ts`:**

Replace `generateImageSchema` (lines 7-11) with:

```typescript
export const generateImageSchema = z.object({
  idea: z.string().min(10, "Idea must be at least 10 characters").max(1000, "Idea cannot exceed 1000 characters"),
  count: z.number().int().min(1).max(6).optional(),
  provider: z.enum(["replicate", "gemini"]).optional(),
});
```

- **File**: `src/lib/validations/generation.ts`
- **Change**: Replace `prompt` field with `idea` field
- **Backward compatibility**: Old `prompt` field no longer accepted (breaking change, but only internal API)

#### Task 9: Enhance `GeneratedImage` type

**Modify `src/types/generation.ts`:**

Replace `GeneratedImage` interface (lines 9-13) with:

```typescript
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  styleId?: string;    // Which image style generated this (e.g., "photography")
  styleName?: string;  // Display name (e.g., "Photography")
}
```

- **File**: `src/types/generation.ts`
- **Change**: Add optional `styleId` and `styleName` fields
- **Backward compatibility**: Existing code continues to work (fields are optional)

---

**Agent 2 (Image Styles Settings Page) Tasks:**

#### Task 10: Create `src/app/image-styles/page.tsx`

```typescript
import { AuroraBackground } from "@/components/layout/aurora-background";
import { getAuthUser } from "@/lib/auth-utils";
import { getUserImageStyles } from "@/lib/db/queries";
import { ImageStylesEditor } from "@/components/image-styles/image-styles-editor";
import { updateImageStyles, resetImageStyles } from "./actions";

export default async function ImageStylesPage() {
  const user = await getAuthUser();
  const imageStyles = await getUserImageStyles(user.id);

  return (
    <AuroraBackground className="min-h-screen">
      <div className="flex">
        <ImageStylesEditor
          initialStyles={imageStyles}
          onSave={updateImageStyles}
          onReset={resetImageStyles}
          user={user}
        />
      </div>
    </AuroraBackground>
  );
}
```

- **File**: `src/app/image-styles/page.tsx` (NEW)
- **Pattern**: Exact mirror of `src/app/voice-tones/page.tsx`
- **Dependencies**: Uses Agent 1's `getUserImageStyles()` query

#### Task 11: Create `src/app/image-styles/actions.ts`

```typescript
"use server";

import { auth } from "@/lib/auth";
import { saveUserImageStyles, upsertUserSettings } from "@/lib/db/queries";
import { validateImageStyles, type ImageStyle } from "@/lib/image-styles";
import { revalidatePath } from "next/cache";

export async function updateImageStyles(styles: ImageStyle[]): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  const userId = session.user.id;

  const validation = validateImageStyles(styles);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  await saveUserImageStyles(userId, styles);
  revalidatePath("/image-styles");
  return { success: true };
}

export async function resetImageStyles(): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  const userId = session.user.id;

  await upsertUserSettings(userId, { image_styles_json: null });
  revalidatePath("/image-styles");
  return { success: true };
}
```

- **File**: `src/app/image-styles/actions.ts` (NEW)
- **Pattern**: Exact mirror of `src/app/voice-tones/actions.ts`
- **Dependencies**: Uses Agent 1's validation and query functions

#### Task 12: Create `src/components/image-styles/image-styles-editor.tsx`

```typescript
"use client";

import { useState } from "react";
import type { ImageStyle } from "@/lib/image-styles";
import { DEFAULT_IMAGE_STYLES, IMAGE_STYLE_LIMITS } from "@/lib/image-styles";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { Sidebar } from "@/components/layout/sidebar";

interface ImageStylesEditorProps {
  initialStyles: ImageStyle[];
  onSave: (styles: ImageStyle[]) => Promise<{ success: boolean; error?: string }>;
  onReset: () => Promise<{ success: boolean; error?: string }>;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function ImageStylesEditor({ initialStyles, onSave, onReset, user }: ImageStylesEditorProps) {
  const [styles, setStyles] = useState<ImageStyle[]>(initialStyles);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track if user has made changes
  const hasChanges = JSON.stringify(styles) !== JSON.stringify(initialStyles);

  // Check if current styles match defaults
  const isDefault = JSON.stringify(styles) === JSON.stringify(DEFAULT_IMAGE_STYLES);

  // Unsaved changes guard
  const {
    showDialog,
    handleDiscard,
    handleSave: handleDialogSave,
    handleCancel,
    guardNavigation,
  } = useUnsavedChanges({
    hasChanges,
    onSave: async () => {
      await handleSave();
    },
  });

  function updateStyle(id: string, field: "name" | "prompt", value: string) {
    setStyles((prev) =>
      prev.map((style) => (style.id === id ? { ...style, [field]: value } : style))
    );
    setSaveStatus("idle");
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveStatus("idle");
    setErrorMessage(null);

    try {
      const result = await onSave(styles);
      if (result.success) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setErrorMessage(result.error ?? "Failed to save");
      }
    } catch {
      setSaveStatus("error");
      setErrorMessage("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Are you sure you want to reset all image styles to their defaults? This cannot be undone.")) {
      return;
    }

    setIsResetting(true);
    try {
      const result = await onReset();
      if (result.success) {
        setStyles(DEFAULT_IMAGE_STYLES);
        setSaveStatus("idle");
        setErrorMessage(null);
      } else {
        setSaveStatus("error");
        setErrorMessage(result.error ?? "Failed to reset");
      }
    } catch {
      setSaveStatus("error");
      setErrorMessage("Failed to reset");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <>
      {/* Sidebar with navigation guard */}
      <Sidebar user={user} onBeforeNavigate={guardNavigation} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto z-10">
        <div className="max-w-5xl mx-auto p-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold">Image Styles</h1>
            <p className="text-slate-500 mt-2">
              Customize the visual styles for your AI-generated images.
              Each style defines a different visual medium for your content.
            </p>
          </div>

          <div className="space-y-6" data-testid="image-styles-editor">
            {/* Editor cards - 2 column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {styles.map((style, index) => (
                <div
                  key={style.id}
                  className="glass-card p-6 rounded-3xl border border-white/50 shadow-sm space-y-4"
                  data-testid={`image-style-card-${style.id}`}
                >
                  {/* Slot number badge */}
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Style Slot
                    </span>
                  </div>

                  {/* Visual style name input */}
                  <div>
                    <label
                      htmlFor={`style-name-${style.id}`}
                      className="block text-sm font-bold text-slate-600 mb-1"
                    >
                      Visual Style Name
                    </label>
                    <input
                      id={`style-name-${style.id}`}
                      data-testid={`style-name-${style.id}`}
                      type="text"
                      value={style.name}
                      onChange={(e) => updateStyle(style.id, "name", e.target.value)}
                      maxLength={IMAGE_STYLE_LIMITS.NAME_MAX_LENGTH}
                      className="w-full px-4 py-2 rounded-xl border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold"
                      placeholder="e.g., Photography"
                    />
                    <span className="text-xs text-slate-400 mt-1">
                      {style.name.length}/{IMAGE_STYLE_LIMITS.NAME_MAX_LENGTH}
                    </span>
                  </div>

                  {/* Image prompt textarea */}
                  <div>
                    <label
                      htmlFor={`style-prompt-${style.id}`}
                      className="block text-sm font-bold text-slate-600 mb-1"
                    >
                      Image Prompt
                    </label>
                    <textarea
                      id={`style-prompt-${style.id}`}
                      data-testid={`style-prompt-${style.id}`}
                      value={style.prompt}
                      onChange={(e) => updateStyle(style.id, "prompt", e.target.value)}
                      maxLength={IMAGE_STYLE_LIMITS.PROMPT_MAX_LENGTH}
                      rows={3}
                      className="w-full px-4 py-2 rounded-xl border border-white/50 bg-white/60 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      placeholder="Describe the visual style for this image..."
                    />
                    <span className="text-xs text-slate-400 mt-1">
                      {style.prompt.length}/{IMAGE_STYLE_LIMITS.PROMPT_MAX_LENGTH}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between glass-card p-4 rounded-2xl border border-white/50 shadow-sm sticky bottom-6 bg-white/80 backdrop-blur-md z-20">
              <div className="flex items-center gap-3">
                {/* Reset button */}
                <button
                  data-testid="reset-image-styles"
                  onClick={handleReset}
                  disabled={isDefault || isResetting}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isResetting ? "Resetting..." : "Reset to Defaults"}
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Status feedback */}
                {saveStatus === "success" && (
                  <span className="text-sm font-bold text-green-600 animate-pulse" aria-live="polite">
                    Saved successfully
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-sm font-bold text-red-600" aria-live="polite">
                    {errorMessage}
                  </span>
                )}

                {/* Save button */}
                <button
                  data-testid="save-image-styles"
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  aria-busy={isSaving}
                  className="px-6 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary/20"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Unsaved changes confirmation dialog */}
      <UnsavedChangesDialog
        open={showDialog}
        onDiscard={handleDiscard}
        onSave={handleDialogSave}
        onCancel={handleCancel}
        isSaving={isSaving}
      />
    </>
  );
}
```

- **File**: `src/components/image-styles/image-styles-editor.tsx` (NEW)
- **Pattern**: Exact mirror of `src/components/voice-tones/voice-tones-editor.tsx`
- **Field labels**: "Visual Style Name", "Image Prompt" (instead of "Style Name", "Prompt Description")
- **Dependencies**: Uses existing `useUnsavedChanges` hook and `UnsavedChangesDialog` component

#### Task 13: Add "Image Styles" nav item to sidebar

**Modify `src/components/layout/sidebar.tsx`:**

Insert after line 20 (after voice-tones nav item):

```typescript
{ href: "/image-styles", icon: "palette", label: "Image Styles" },
```

- **File**: `src/components/layout/sidebar.tsx`
- **Location**: After line 20
- **Icon**: `palette` (Material Symbols icon)

---

**Agent 3 (Studio Integration) Tasks:**

#### Task 14: Update client-side `generateImages()` query

**Modify `src/lib/queries/generations.ts`:**

Replace the `generateImages` function (lines 40-64) with:

```typescript
export async function generateImages(idea: string): Promise<GeneratedImage[]> {
  try {
    const response = await fetch("/api/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),  // CHANGED from { prompt }
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
      prompt: idea,  // CHANGED from prompt
    }));
  }
}
```

- **File**: `src/lib/queries/generations.ts`
- **Change**: Send `{ idea }` instead of `{ prompt }`
- **Dependencies**: API route now expects `idea` field (Agent 1's work)

#### Task 15: Update image card to show style badge

**Modify `src/components/studio/image-card.tsx`:**

Add after line 27 (inside the image container, before the selection overlay):

```typescript
{/* Style badge */}
{image.styleName && (
  <div className="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg border border-white/50 shadow-sm">
    <span className="text-xs font-bold text-slate-600" data-testid={`image-style-badge-${image.id}`}>
      {image.styleName}
    </span>
  </div>
)}
```

- **File**: `src/components/studio/image-card.tsx`
- **Location**: After line 27 (after the `<img>` tag)
- **Styling**: Matches text variation card badge design
- **Conditional**: Only shows if `image.styleName` exists (backward compatibility)

#### Task 16: Update image grid to pass style info through

**Verify `src/components/studio/image-grid.tsx`:**

No changes needed — the component already passes full `image` objects to `ImageCard`, which now includes `styleId` and `styleName` (from Agent 1's API route changes).

**Action**: Read the file to confirm structure, then document "No changes required — already passes full image objects."

- **File**: `src/components/studio/image-grid.tsx`
- **Verification**: Confirm no changes needed
- **Reason**: Already passes `image` prop which now includes style metadata

### Phase 3: Contract Verification (Lead)

Before declaring complete, the lead verifies:

1. **TypeScript compiles**: `npm run typecheck` passes
2. **Lint clean**: `npm run lint:fix` passes
3. **Build succeeds**: `npm run build` passes
4. **Migration created**: Drizzle migration file exists for `image_styles_json` column
5. **Database schema updated**: `image_styles_json` column added to `userSettings` table
6. **All 6 images generate with different prompts**: Test in create/studio flow
7. **Image styles page works**: Navigate to `/image-styles`, edit styles, save, reset
8. **Style badges display**: Image cards show style names (e.g., "Photography")
9. **Sidebar nav updated**: "Image Styles" appears in sidebar navigation
10. **Validation enforces constraints**: Try saving <6 styles, >300 char prompt, suspicious patterns
11. **Defaults work**: New users see 6 default image styles (no custom data)
12. **Backward compatibility**: Old `generateImages(prompt, count)` still works (if called directly)

## Existing Files to Read First

All agents **MUST read these** before building:

| File | Why |
|------|-----|
| `src/lib/voice-tones.ts` | **Blueprint** — Agent 1 mirrors this exact structure for image-styles.ts |
| `src/app/voice-tones/page.tsx` | **Blueprint** — Agent 2 mirrors this for image-styles page |
| `src/app/voice-tones/actions.ts` | **Blueprint** — Agent 2 mirrors this for image-styles actions |
| `src/components/voice-tones/voice-tones-editor.tsx` | **Blueprint** — Agent 2 mirrors this for image-styles-editor |
| `src/lib/db/schema.ts` | Schema structure for adding `image_styles_json` column |
| `src/lib/db/queries.ts` | Query patterns for `getUserImageStyles()` / `saveUserImageStyles()` |
| `src/app/api/generate/image/route.ts` | Current image generation route (Agent 1 modifies) |
| `src/lib/api/image-provider.ts` | Provider interface (Agent 1 extends) |
| `src/lib/api/gemini-image.ts` | Gemini provider (Agent 1 adds styled method) |
| `src/lib/api/replicate.ts` | Replicate provider (Agent 1 adds styled method) |
| `src/types/generation.ts` | GeneratedImage type (Agent 1 enhances) |
| `src/lib/validations/generation.ts` | Validation schemas (Agent 1 updates) |
| `src/lib/queries/generations.ts` | Client-side queries (Agent 3 modifies) |
| `src/components/studio/image-card.tsx` | Image card UI (Agent 3 adds badge) |
| `src/components/studio/image-grid.tsx` | Image grid (Agent 3 verifies) |
| `src/components/layout/sidebar.tsx` | Navigation (Agent 2 adds nav item) |
| `src/hooks/use-unsaved-changes.ts` | Unsaved changes hook (Agent 2 uses) |
| `src/components/ui/unsaved-changes-dialog.tsx` | Dialog component (Agent 2 uses) |

## Files Summary

### New Files (5)
| File | Owner | Purpose |
|------|-------|---------|
| `src/lib/image-styles.ts` | Agent 1 | ImageStyle type, defaults, validation, buildImagePrompt() |
| `drizzle/XXXX_add_image_styles_column.sql` | Agent 1 | Database migration for image_styles_json column |
| `src/app/image-styles/page.tsx` | Agent 2 | Image styles settings page (server component) |
| `src/app/image-styles/actions.ts` | Agent 2 | Server actions for update/reset |
| `src/components/image-styles/image-styles-editor.tsx` | Agent 2 | Editor component with unsaved changes guard |

### Modified Files (11)
| File | Owner | Change |
|------|-------|--------|
| `src/lib/db/schema.ts` | Agent 1 | Add `image_styles_json: text("image_styles_json")` to userSettings |
| `src/lib/db/queries.ts` | Agent 1 | Add `getUserImageStyles()` and `saveUserImageStyles()` |
| `src/lib/api/image-provider.ts` | Agent 1 | Add `generateImagesWithStyles()` to interface |
| `src/lib/api/gemini-image.ts` | Agent 1 | Implement `generateImagesWithStyles()` |
| `src/lib/api/replicate.ts` | Agent 1 | Implement `generateImagesWithStyles()` |
| `src/app/api/generate/image/route.ts` | Agent 1 | Fetch user styles, build per-style prompts, attach metadata |
| `src/lib/validations/generation.ts` | Agent 1 | Change `prompt` field to `idea` in generateImageSchema |
| `src/types/generation.ts` | Agent 1 | Add `styleId` and `styleName` to GeneratedImage |
| `src/components/layout/sidebar.tsx` | Agent 2 | Add "Image Styles" nav item |
| `src/lib/queries/generations.ts` | Agent 3 | Send `{ idea }` instead of `{ prompt }` |
| `src/components/studio/image-card.tsx` | Agent 3 | Add style badge display |

### Deleted Files (0)
No files deleted.

### Verified Files (1)
| File | Owner | Action |
|------|-------|--------|
| `src/components/studio/image-grid.tsx` | Agent 3 | Verify no changes needed (already passes full image objects) |

## Validation

### Agent 1 (Image Styles Core) Validation
```bash
# TypeScript compiles
npm run typecheck

# New library exports correctly
node -e "const { DEFAULT_IMAGE_STYLES, validateImageStyles, buildImagePrompt } = require('./src/lib/image-styles.ts'); console.log(DEFAULT_IMAGE_STYLES.length);"
# Expected: 6

# Migration file exists
ls drizzle/ | grep image_styles
# Expected: filename listed

# Database updated (after running migration)
npx drizzle-kit push
# Expected: No errors, column added

# API route accepts new schema
curl -X POST http://localhost:3000/api/generate/image \
  -H "Content-Type: application/json" \
  -d '{"idea":"AI in healthcare"}'
# Expected: 401 (auth required) or valid response with 6 images
```

### Agent 2 (Image Styles Settings Page) Validation
```bash
# TypeScript compiles (no broken imports)
npm run typecheck

# Page accessible
curl -I http://localhost:3000/image-styles
# Expected: 200 OK (if authenticated)

# Sidebar nav updated
grep -A 1 "palette" src/components/layout/sidebar.tsx
# Expected: Image Styles nav item found

# Lint passes
npm run lint:fix

# Build succeeds
npm run build
```

### Agent 3 (Studio Integration) Validation
```bash
# TypeScript compiles
npm run typecheck

# Client query updated
grep "idea" src/lib/queries/generations.ts
# Expected: generateImages function sends { idea }

# Image card has badge
grep "styleName" src/components/studio/image-card.tsx
# Expected: Badge rendering logic found

# Lint passes
npm run lint:fix
```

### End-to-End Validation (Lead)
1. Run database migration: `npx drizzle-kit push`
2. Start dev server: `npm run dev`
3. Navigate to `/image-styles`
4. Verify 6 default styles displayed (Photography, Illustration, Minimalist, Abstract, Infographic, 3D Render)
5. Edit "Photography" style name to "Pro Photography"
6. Edit "Photography" prompt to "Professional DSLR photography with bokeh effect"
7. Save changes
8. Navigate to `/create` (AI Writer)
9. Generate content with idea: "The future of remote work"
10. Verify 6 images generated with different visual styles
11. Verify first image has badge "Pro Photography" (custom name)
12. Verify other images have default style names
13. Select image and create post
14. Navigate back to `/image-styles`
15. Click "Reset to Defaults"
16. Verify "Photography" reverts to default name and prompt
17. Test validation: try to save styles with <6 items → error
18. Test validation: try to save style with >300 char prompt → error
19. Test validation: try to save style with "ignore all previous instructions" in prompt → error
20. Run full validation: `npm run typecheck && npm run lint:fix && npm run build`

## Success Criteria

- [ ] `src/lib/image-styles.ts` created with 6 default styles, validation, and `buildImagePrompt()`
- [ ] `image_styles_json` column added to `userSettings` table with migration
- [ ] `getUserImageStyles()` and `saveUserImageStyles()` query functions work
- [ ] `generateImagesWithStyles()` implemented in both Gemini and Replicate providers
- [ ] Image generation API route uses per-style prompts
- [ ] `GeneratedImage` type includes `styleId` and `styleName` fields
- [ ] Image Styles settings page accessible at `/image-styles`
- [ ] Editor component allows editing style names and prompts
- [ ] Save/reset functionality works (with validation)
- [ ] Unsaved changes guard prevents accidental navigation loss
- [ ] "Image Styles" appears in sidebar navigation
- [ ] Image cards display style badges (e.g., "Photography")
- [ ] 6 images generate with different visual styles
- [ ] Validation enforces exactly 6 styles, max lengths, no suspicious patterns, canonical IDs
- [ ] New users see default styles (null DB value = defaults)
- [ ] Custom styles persist across sessions
- [ ] `npm run typecheck` passes
- [ ] `npm run lint:fix` passes
- [ ] `npm run build` passes
- [ ] All interactive elements have `data-testid` attributes
- [ ] Design language preserved (Aurora backgrounds, glass cards, Plus Jakarta Sans)
- [ ] No broken imports or missing dependencies

## What Gets Added

- **New customization dimension**: Users can now customize both text generation (voice tones) AND image generation (image styles)
- **6 visual mediums**: Photography, Illustration, Minimalist, Abstract, Infographic, 3D Render
- **Prompt optimization**: Each image gets a tailored prompt optimized for Gemini Flash Image
- **User control**: Full editing of style names and prompts (like voice tones)
- **Style metadata**: Images tagged with which style generated them
- **UI feedback**: Style badges on image cards show visual variety
- **Settings page**: Dedicated UI for customizing image generation behavior
- **Validation safeguards**: Prompt injection defense, length limits, canonical ID enforcement
- **Database persistence**: User preferences saved and loaded automatically
- **Parallel generation**: All 6 images still fire in parallel (no performance loss)
