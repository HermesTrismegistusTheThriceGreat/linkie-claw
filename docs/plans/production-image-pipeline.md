# Production Image Pipeline — Agent Team Plan

Replace filesystem-based image storage with an ephemeral generation + Cloudflare R2 permanent storage architecture. Preview images are never stored server-side. Only the user's selected image is uploaded to R2 when saving a post.

## Overview

**Problem:** Images are saved to `public/uploads/` on the local filesystem. This breaks in serverless/containerized deployments, has no CDN, accumulates orphaned files, and can't provide public URLs for n8n/LinkedIn publishing.

**Solution (Hybrid Ephemeral + R2):**
1. **Generation phase:** Images are returned directly in the API response — base64 for Gemini, temp CDN URLs for Replicate. No server-side storage.
2. **Preview phase:** Frontend renders images from data URIs (Gemini) or temp URLs (Replicate). Images live only in browser memory.
3. **Save phase:** Only the ONE selected image is uploaded to Cloudflare R2. The permanent R2 CDN URL is stored in the database.
4. **Cleanup:** No cleanup needed for previews (they're ephemeral). R2 images are deleted when posts are deleted.

**Provider priority:** Gemini is the primary provider (`IMAGE_PROVIDER=gemini`). Replicate (FLUX) is configured and ready as a secondary option. Both providers are updated in this plan.

## Requirements Summary

- New R2 storage module (`src/lib/storage/r2.ts`) with upload/delete functions using `@aws-sdk/client-s3`
- New image upload API endpoint (`POST /api/images/upload`) that accepts base64 or temp URL, uploads to R2, returns permanent CDN URL
- Gemini provider returns raw base64 data instead of saving to disk
- Replicate provider returns temp CDN URLs instead of downloading to disk
- Image generation API route stops calling `cleanupOldImages()` and stops saving to filesystem
- `GeneratedImage` type gains optional `base64` field for Gemini image data
- Frontend `CreateView` uploads selected image to R2 before creating post
- Post delete endpoint cleans up associated R2 image
- Old `src/lib/storage/images.ts` filesystem module removed
- 5 new environment variables for R2 configuration

## Research Findings

### Current Image Flow (What Changes)

**Generation (current):**
```
Gemini API → base64 data → sharp decode → save PNG to public/uploads/ → return /uploads/img-xxx.png
Replicate API → temp CDN URL → fetch + download → save to public/uploads/ → return /uploads/img-xxx.webp
```

**Generation (new):**
```
Gemini API → base64 data → return base64 directly in API response (NO disk write)
Replicate API → temp CDN URL → pass through directly in API response (NO download)
```

**Post save (current):**
```
POST /api/posts { imageUrl: "/uploads/img-xxx.png" } → store path string in DB
```

**Post save (new):**
```
POST /api/images/upload { base64 OR tempUrl } → upload to R2 → return R2 CDN URL
POST /api/posts { imageUrl: "https://pub-xxx.r2.dev/posts/post-id/image.webp" } → store R2 URL in DB
```

### Key Files Involved

| File | Current Role | New Role |
|------|-------------|----------|
| `src/lib/storage/images.ts` | Save to filesystem, cleanup old files | **DELETED** — replaced by R2 module |
| `src/lib/api/gemini-image.ts` | Calls `saveImageFromBase64()` | Returns raw base64 data |
| `src/lib/api/replicate.ts` | Calls `downloadAndSaveImage()` | Returns temp CDN URL directly |
| `src/app/api/generate/image/route.ts` | Calls `cleanupOldImages()` | No cleanup needed |
| `src/components/studio/create-view.tsx` | Sends `/uploads/` URL on save | Uploads to R2 first, sends R2 URL |
| `src/app/api/posts/[id]/route.ts` | No image cleanup on delete | Deletes R2 image on post delete |

### Cloudflare R2 Configuration

R2 uses the S3-compatible API. The `@aws-sdk/client-s3` package works directly.

**Endpoint:** `https://{ACCOUNT_ID}.r2.cloudflarestorage.com`
**Public access:** Via R2.dev subdomain or custom domain (configured in Cloudflare dashboard)
**Pricing:** 10GB free tier, $0 egress, $0.015/GB/month storage beyond free tier
**CORS:** Must be configured on the bucket to allow uploads from the app domain

### Response Payload Analysis

Gemini images after sharp processing: ~1.7-2.3 MB binary = ~2.3-3.1 MB as base64.
6 images per generation: ~14-19 MB total API response.

This is acceptable because:
- Image generation itself takes 10-30 seconds (the bottleneck)
- 16MB transfers in ~2-3 seconds on modern connections
- DALL-E playground, Midjourney, and similar apps use the same pattern
- Alternative (R2 temp storage for previews) adds infrastructure complexity with minimal UX benefit

### n8n Publishing Requirement

The cron route (`src/app/api/cron/publish-scheduled/route.ts` line 79) sends `imageUrl: post.image_url` to n8n. n8n must be able to fetch this URL to attach the image to the LinkedIn post. R2 CDN URLs are publicly accessible, solving this for production.

## Agent Build Order & Communication

### Contract Chain

```
Agent 1 (R2 Infrastructure) ─┐
                              ├──→ Agent 3 (Frontend & Save Integration)
Agent 2 (Ephemeral Providers) ┘
```

Agents 1 and 2 work **in parallel** (no dependencies between them). Agent 3 depends on both Agent 1's upload endpoint and Agent 2's new response format.

### Agent Roles (3 Agents)

#### Agent 1: R2 Infrastructure
**Owns (creates):**
- `src/lib/storage/r2.ts` (NEW)
- `src/app/api/images/upload/route.ts` (NEW)

**Does NOT touch:**
- `src/lib/api/gemini-image.ts` (Agent 2 territory)
- `src/lib/api/replicate.ts` (Agent 2 territory)
- `src/app/api/generate/image/route.ts` (Agent 2 territory)
- `src/types/generation.ts` (Agent 2 territory)
- `src/components/studio/` (Agent 3 territory)
- `src/lib/queries/generations.ts` (Agent 3 territory)

**Responsibilities:**
1. Install `@aws-sdk/client-s3` dependency
2. Create R2 client module with upload, delete, and public URL functions
3. Create image upload API endpoint with auth validation
4. Document required environment variables

#### Agent 2: Ephemeral Provider Refactor
**Owns (modifies):**
- `src/types/generation.ts` — add `base64` field
- `src/lib/api/gemini-image.ts` — return base64 instead of saving
- `src/lib/api/replicate.ts` — return temp URLs instead of downloading
- `src/app/api/generate/image/route.ts` — remove cleanup, handle ephemeral response

**Does NOT touch:**
- `src/lib/storage/r2.ts` (Agent 1 territory)
- `src/app/api/images/upload/` (Agent 1 territory)
- `src/components/studio/` (Agent 3 territory)
- `src/lib/queries/generations.ts` (Agent 3 territory)
- `src/lib/storage/images.ts` (Agent 3 deletes this)

**Responsibilities:**
1. Add `base64` optional field to `GeneratedImage` type
2. Refactor Gemini provider to return base64 data (stop importing/calling `saveImageFromBase64`)
3. Refactor Replicate provider to return temp URLs (stop importing/calling `downloadAndSaveImage`)
4. Remove `cleanupOldImages()` call from image generation API route
5. Update API response to include ephemeral image data

#### Agent 3: Frontend & Save Integration
**Owns (modifies):**
- `src/lib/queries/generations.ts` — process new API response format
- `src/components/studio/create-view.tsx` — upload image on save
- `src/app/api/posts/[id]/route.ts` — delete R2 image on post delete

**Owns (deletes):**
- `src/lib/storage/images.ts` — remove filesystem storage module

**Does NOT touch:**
- `src/lib/storage/r2.ts` (Agent 1 territory)
- `src/app/api/images/upload/` (Agent 1 territory)
- `src/lib/api/gemini-image.ts` (Agent 2 territory)
- `src/lib/api/replicate.ts` (Agent 2 territory)
- `src/app/api/generate/image/route.ts` (Agent 2 territory)

**Responsibilities:**
1. Update `generateImages()` query to transform API response into display-ready URLs
2. Update `CreateView` to upload selected image before post creation
3. Add R2 image cleanup to post DELETE endpoint
4. Delete old filesystem storage module
5. Clean up any remaining `public/uploads/` references

### Cross-Cutting Concerns

| Concern | Owner | Detail |
|---------|-------|--------|
| R2 client config | Agent 1 | S3-compatible client in `src/lib/storage/r2.ts` |
| `GeneratedImage.base64` field | Agent 2 | Optional string field, only set for Gemini images |
| Image display URL construction | Agent 3 | Gemini: `data:image/png;base64,{base64}`, Replicate: use `url` directly |
| R2 upload on save | Agent 3 | Calls Agent 1's `/api/images/upload` before creating post |
| R2 cleanup on delete | Agent 3 | Calls Agent 1's `deleteImageFromR2()` on post delete |
| Environment variables | Agent 1 | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL |
| `public/uploads/` backward compat | Agent 3 | Existing posts with `/uploads/` URLs continue to work (files remain). Only new posts use R2. |

## Implementation Tasks

### Phase 1: Contracts (Agent 1 + Agent 2 publish in parallel)

**Agent 1 (R2 Infrastructure) publishes:**

1. **R2 module exports**
   ```typescript
   // src/lib/storage/r2.ts
   export async function uploadImageToR2(
     imageBuffer: Buffer,
     key: string,
     contentType: string
   ): Promise<string>  // Returns public URL

   export async function deleteImageFromR2(key: string): Promise<void>

   export function getR2PublicUrl(key: string): string

   export function extractR2KeyFromUrl(url: string): string | null
   ```

2. **Upload endpoint contract**
   ```
   POST /api/images/upload
   Auth: Required (session)
   Request body: {
     base64?: string,      // Raw base64 image data (from Gemini)
     tempUrl?: string,      // Temporary CDN URL (from Replicate)
     postId?: string,       // Optional post ID for organizing in R2
     contentType?: string   // e.g., "image/png", "image/webp"
   }
   Response: {
     url: string,           // Permanent R2 CDN URL
     key: string            // R2 object key (for deletion)
   }
   ```

3. **Environment variables**
   ```
   R2_ACCOUNT_ID=        # Cloudflare account ID
   R2_ACCESS_KEY_ID=     # R2 API token access key
   R2_SECRET_ACCESS_KEY= # R2 API token secret
   R2_BUCKET_NAME=       # e.g., "linkie-claw-images"
   R2_PUBLIC_URL=        # e.g., "https://images.linkie-claw.com" or "https://pub-xxx.r2.dev"
   ```

**Agent 2 (Ephemeral Providers) publishes:**

1. **Updated `GeneratedImage` type**
   ```typescript
   export interface GeneratedImage {
     id: string;
     url: string;          // Display URL: data URI (Gemini) or temp CDN URL (Replicate)
     base64?: string;       // Raw base64 data (Gemini only) — used for R2 upload on save
     prompt: string;
     styleId?: string;
     styleName?: string;
   }
   ```

2. **Updated API response format**
   ```
   POST /api/generate/image
   Response: {
     images: GeneratedImage[],   // url field is now data URI or temp URL (not /uploads/ path)
     provider: string,
     count: number
   }
   ```

### Phase 2: Implementation (Agent 1 + Agent 2 in parallel, then Agent 3)

---

**Agent 1 (R2 Infrastructure) Tasks:**

#### Task 1: Install `@aws-sdk/client-s3` dependency

```bash
npm install @aws-sdk/client-s3
```

- **Action**: Add dependency to package.json
- **No other dependencies**

#### Task 2: Create `src/lib/storage/r2.ts`

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { log } from "@/lib/logger";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 environment variables not configured");
    }
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Check if R2 is configured (env vars present).
 * Returns false in local dev if R2 vars are not set.
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

/**
 * Upload an image buffer to R2.
 * @returns The public CDN URL for the uploaded image.
 */
export async function uploadImageToR2(
  imageBuffer: Buffer,
  key: string,
  contentType: string = "image/webp"
): Promise<string> {
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
    })
  );

  const publicUrl = getR2PublicUrl(key);
  log("info", "Image uploaded to R2", { key, contentType, size: imageBuffer.length });
  return publicUrl;
}

/**
 * Delete an image from R2 by its object key.
 */
export async function deleteImageFromR2(key: string): Promise<void> {
  const client = getClient();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    log("info", "Image deleted from R2", { key });
  } catch (error) {
    log("error", "Failed to delete image from R2", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Construct the public CDN URL for an R2 object key.
 */
export function getR2PublicUrl(key: string): string {
  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return `${base}/${key}`;
}

/**
 * Extract the R2 object key from a full R2 public URL.
 * Returns null if the URL is not an R2 URL (e.g., a legacy /uploads/ path).
 */
export function extractR2KeyFromUrl(url: string): string | null {
  if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) {
    return null;
  }
  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return url.slice(base.length + 1); // +1 for the "/"
}
```

- **File**: `src/lib/storage/r2.ts` (NEW)
- **Dependencies**: `@aws-sdk/client-s3`, `src/lib/logger.ts`
- **Key design**: `isR2Configured()` allows graceful fallback in local dev without R2 credentials

#### Task 3: Create `src/app/api/images/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createId } from "@paralleldrive/cuid2";
import { uploadImageToR2, isR2Configured } from "@/lib/storage/r2";
import { log } from "@/lib/logger";

/**
 * POST /api/images/upload
 * Upload a single image to R2 permanent storage.
 * Accepts either base64 data (Gemini) or a temporary URL (Replicate).
 * Returns the permanent R2 CDN URL.
 */
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
      // Gemini path: decode base64 to buffer
      imageBuffer = Buffer.from(base64, "base64");
      finalContentType = contentType || "image/png";
    } else {
      // Replicate path: fetch from temporary CDN URL
      const response = await fetch(tempUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from temp URL: ${response.statusText}`);
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
      finalContentType = response.headers.get("content-type") || contentType || "image/webp";
    }

    // Determine file extension from content type
    const ext = finalContentType.includes("webp")
      ? "webp"
      : finalContentType.includes("png")
        ? "png"
        : "jpg";

    // Generate R2 key: posts/{userId}/{uniqueId}.{ext}
    const imageId = createId();
    const key = `posts/${session.user.id}/${imageId}.${ext}`;

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
```

- **File**: `src/app/api/images/upload/route.ts` (NEW)
- **Auth**: Session required (enforced)
- **R2 key format**: `posts/{userId}/{cuid2}.{ext}` — organized by user, unique IDs
- **Handles both providers**: base64 (Gemini) and tempUrl (Replicate)

---

**Agent 2 (Ephemeral Provider Refactor) Tasks:**

#### Task 4: Add `base64` field to `GeneratedImage` type

**Modify `src/types/generation.ts`:**

Replace the `GeneratedImage` interface with:

```typescript
export interface GeneratedImage {
  id: string;
  url: string;          // Display URL: data URI (Gemini) or temp CDN URL (Replicate)
  base64?: string;      // Raw base64 image data (Gemini only) — sent to R2 on save
  prompt: string;
  styleId?: string;
  styleName?: string;
}
```

- **File**: `src/types/generation.ts`
- **Change**: Add optional `base64` field
- **Backward compatibility**: Field is optional, existing code continues to work

#### Task 5: Refactor Gemini provider to return base64 (ephemeral)

**Modify `src/lib/api/gemini-image.ts`:**

**Remove** the import of `saveImageFromBase64`:
```typescript
// DELETE this line:
import { saveImageFromBase64 } from "@/lib/storage/images";
```

**Update `generateImages()` method** — replace the image processing logic. Where it currently does:
```typescript
const id = `img-${createId()}`;
const url = await saveImageFromBase64(part.inlineData.data ?? "", id);
return { id, url, prompt } as GeneratedImage;
```

Change to:
```typescript
const id = `img-${createId()}`;
const rawBase64 = part.inlineData.data ?? "";
const dataUri = `data:image/png;base64,${rawBase64}`;
return { id, url: dataUri, base64: rawBase64, prompt } as GeneratedImage;
```

**Apply the same change to `generateImagesWithStyles()` method** — same pattern: replace `saveImageFromBase64()` call with direct base64/data URI return.

- **File**: `src/lib/api/gemini-image.ts`
- **Key change**: No more filesystem writes. Returns data URI as `url` and raw base64 in `base64` field.
- **Performance**: Eliminates sharp re-encoding step (faster response)

#### Task 6: Refactor Replicate provider to return temp URLs (ephemeral)

**Modify `src/lib/api/replicate.ts`:**

**Remove** the import of `downloadAndSaveImage`:
```typescript
// DELETE this line:
import { downloadAndSaveImage } from "@/lib/storage/images";
```

**Update `generateImages()` method** — replace the download logic. Where it currently does:
```typescript
const id = `img-${createId()}`;
const localUrl = await downloadAndSaveImage(
  typeof url === "string" ? url : String(url),
  id
);
results.push({ id, url: localUrl, prompt });
```

Change to:
```typescript
const id = `img-${createId()}`;
const remoteUrl = typeof url === "string" ? url : String(url);
results.push({ id, url: remoteUrl, prompt });
```

**Apply the same change to `generateImagesWithStyles()` method** — same pattern: return the Replicate temp CDN URL directly instead of downloading.

- **File**: `src/lib/api/replicate.ts`
- **Key change**: No more downloading/saving. Returns Replicate's temporary CDN URL directly.
- **Note**: Replicate temp URLs are valid for ~24 hours — more than enough for a generation session.

#### Task 7: Update image generation API route (remove cleanup, ephemeral response)

**Modify `src/app/api/generate/image/route.ts`:**

**Remove** the import of `cleanupOldImages`:
```typescript
// DELETE this line:
import { cleanupOldImages } from "@/lib/storage/images";
```

**Remove** the cleanup block (approximately lines 87-89):
```typescript
// DELETE these lines:
const cleaned = await cleanupOldImages();
if (cleaned > 0) {
  log("info", "Cleaned up old images", { requestId, deleted: cleaned });
}
```

The rest of the route stays the same — it already calls `generateImagesWithStyles()` and attaches style metadata. The only change is removing the filesystem cleanup since we're no longer writing to the filesystem.

- **File**: `src/app/api/generate/image/route.ts`
- **Change**: Remove `cleanupOldImages` import and call
- **No other changes needed** — the providers now return ephemeral data, and the route passes it through

---

**Agent 3 (Frontend & Save Integration) Tasks:**

#### Task 8: Update `generateImages()` query to handle new response format

**Modify `src/lib/queries/generations.ts`:**

The API now returns images where:
- Gemini: `url` is a `data:image/png;base64,...` data URI, `base64` is the raw data
- Replicate: `url` is a `https://replicate.delivery/...` temp URL, no `base64`

The current `generateImages()` function already returns `data.images` directly, and the frontend already uses `image.url` for display. **No changes needed for the display path.**

However, we need to ensure the `base64` field is preserved in the returned data so `CreateView` can use it when uploading. Verify the function returns the full `GeneratedImage` objects including `base64`:

```typescript
export async function generateImages(idea: string): Promise<GeneratedImage[]> {
  try {
    const response = await fetch("/api/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Image generation API error:", error);
      throw new Error(error.error || "Image generation failed");
    }

    const data = await response.json();
    return data.images; // Already includes url, base64, styleId, styleName
  } catch (error) {
    console.error("Image generation failed, using mock data:", error);
    return mockImages.map((img) => ({
      ...img,
      id: `${img.id}-${Date.now()}`,
      prompt: idea,
    }));
  }
}
```

- **File**: `src/lib/queries/generations.ts`
- **Change**: Verify no transformation strips the `base64` field. The current code returns `data.images` directly, which is correct.
- **Action**: Read the file, confirm it passes through full objects. Likely no code changes needed — just verification.

#### Task 9: Update `CreateView` to upload image before saving post

**Modify `src/components/studio/create-view.tsx`:**

This is the most significant frontend change. The `handleSchedule` function currently sends `imageUrl: selectedImage?.url` directly to `/api/posts`. The `url` was a `/uploads/...` path. Now it's either a data URI (Gemini) or a temp URL (Replicate) — neither is suitable for permanent storage.

**Add a helper function** before `handleSchedule`:

```typescript
/** Upload the selected image to R2 and return the permanent URL */
const uploadImageToStorage = async (image: GeneratedImage): Promise<string | null> => {
  try {
    const response = await fetch("/api/images/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Gemini images have base64 data, Replicate images have temp URLs
        base64: image.base64 || undefined,
        tempUrl: !image.base64 ? image.url : undefined,
        contentType: image.base64 ? "image/png" : "image/webp",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Image upload failed:", error);
      return null;
    }

    const data = await response.json();
    return data.url; // Permanent R2 CDN URL
  } catch (error) {
    console.error("Image upload error:", error);
    return null;
  }
};
```

**Update `handleSchedule`** to use it — replace the post creation block:

```typescript
const handleSchedule = async (scheduledAt: Date) => {
    const content = selectedText?.content;
    if (!content) return;

    // Step 1: Upload selected image to R2 (if image selected)
    let permanentImageUrl: string | undefined;
    if (selectedImage) {
      const uploadedUrl = await uploadImageToStorage(selectedImage);
      if (uploadedUrl) {
        permanentImageUrl = uploadedUrl;
      } else {
        toast.error("Failed to save image", {
          description: "Post will be created without an image",
        });
      }
    }

    // Step 2: Create post as draft (with R2 URL instead of temp URL)
    const createResponse = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: idea.trim().slice(0, 200),
            content,
            imageUrl: permanentImageUrl,
            status: "draft",
        }),
    });

    // ... rest of the function unchanged (step 2: schedule the draft)
```

- **File**: `src/components/studio/create-view.tsx`
- **Key change**: Upload selected image to R2 BEFORE creating the post
- **Graceful degradation**: If upload fails, post is created without image (with toast notification)
- **No UI changes**: Image display still uses `<img src={image.url}>` which works for data URIs and temp URLs

#### Task 10: Add R2 image cleanup to post DELETE endpoint

**Modify `src/app/api/posts/[id]/route.ts`:**

**Add imports:**
```typescript
import { deleteImageFromR2, extractR2KeyFromUrl, isR2Configured } from "@/lib/storage/r2";
```

**Update the DELETE handler** — after confirming the post exists but before deleting, clean up the R2 image:

In the DELETE function, after `const existingPost = await getPostById(id, userId);` and the 404 check, add:

```typescript
// Clean up R2 image if present
if (isR2Configured() && existingPost.image_url) {
  const r2Key = extractR2KeyFromUrl(existingPost.image_url);
  if (r2Key) {
    await deleteImageFromR2(r2Key);
  }
}
```

Place this BEFORE the `await deletePost(id, userId)` call.

- **File**: `src/app/api/posts/[id]/route.ts`
- **Change**: Add R2 image cleanup before post deletion
- **Backward compat**: `extractR2KeyFromUrl()` returns null for old `/uploads/` paths — no cleanup attempted for legacy images
- **Non-blocking**: If R2 delete fails, it logs the error but doesn't block post deletion

#### Task 11: Delete old filesystem storage module

**Delete `src/lib/storage/images.ts`**

This file is no longer imported by any code after Agent 2's refactoring of the providers and route.

**Before deleting**, verify no remaining imports:
```bash
grep -r "lib/storage/images" src/
```

Expected: zero results (after Agent 2 removes imports from gemini-image.ts, replicate.ts, and route.ts).

- **File**: `src/lib/storage/images.ts` (DELETE)
- **Dependency check**: Must run AFTER Agent 2 has removed all imports
- **Note**: Do NOT delete `public/uploads/` directory — existing posts may still reference images there. Those will be served as static files by Next.js until a future migration moves them to R2.

### Phase 3: Contract Verification (Lead)

Before declaring complete, the lead verifies:

1. **TypeScript compiles**: `npm run typecheck` passes
2. **Lint clean**: `npm run lint:fix` passes
3. **Build succeeds**: `npm run build` passes
4. **No remaining imports of old storage**: `grep -r "lib/storage/images" src/` returns nothing
5. **R2 module exports correctly**: `isR2Configured()`, `uploadImageToR2()`, `deleteImageFromR2()`, `extractR2KeyFromUrl()`
6. **Image generation returns ephemeral data**: API response has data URIs (Gemini) or temp URLs (Replicate), not `/uploads/` paths
7. **Frontend renders images**: Both data URIs and temp URLs display correctly in ImageCard and LinkedInPreview
8. **Post save uploads to R2**: Creating a post with an image results in an R2 CDN URL stored in `image_url` column
9. **Post delete cleans R2**: Deleting a post with an R2 image removes the object from the bucket
10. **n8n publishing works**: The R2 CDN URL is sent to n8n in the cron route (no code change needed — it already uses `post.image_url`)
11. **Legacy images still display**: Existing posts with `/uploads/` paths continue to render (static file serving)

## Existing Files to Read First

All agents **MUST read these** before building:

| File | Why |
|------|-----|
| `src/lib/storage/images.ts` | **Current implementation** — understand what's being replaced |
| `src/lib/api/gemini-image.ts` | **Gemini provider** — Agent 2 refactors this |
| `src/lib/api/replicate.ts` | **Replicate provider** — Agent 2 refactors this |
| `src/app/api/generate/image/route.ts` | **Image generation route** — Agent 2 removes cleanup |
| `src/types/generation.ts` | **GeneratedImage type** — Agent 2 extends this |
| `src/components/studio/create-view.tsx` | **Main frontend view** — Agent 3 modifies save flow |
| `src/components/studio/image-card.tsx` | **Image display** — verify data URIs work with `<img>` |
| `src/app/api/posts/[id]/route.ts` | **Post CRUD** — Agent 3 adds R2 cleanup on delete |
| `src/app/api/cron/publish-scheduled/route.ts` | **Publishing flow** — verify image_url is sent to n8n |
| `src/lib/queries/generations.ts` | **Client-side query** — Agent 3 verifies passthrough |
| `CLAUDE.md` | **Project conventions** — all agents follow these |

## Files Summary

### New Files (2)
| File | Owner | Purpose |
|------|-------|---------|
| `src/lib/storage/r2.ts` | Agent 1 | R2 client, upload, delete, URL helpers |
| `src/app/api/images/upload/route.ts` | Agent 1 | Image upload endpoint (base64 or temp URL → R2) |

### Modified Files (5)
| File | Owner | Change |
|------|-------|--------|
| `src/types/generation.ts` | Agent 2 | Add optional `base64` field to `GeneratedImage` |
| `src/lib/api/gemini-image.ts` | Agent 2 | Return base64/data URI instead of saving to filesystem |
| `src/lib/api/replicate.ts` | Agent 2 | Return temp CDN URL instead of downloading to filesystem |
| `src/app/api/generate/image/route.ts` | Agent 2 | Remove `cleanupOldImages` import and call |
| `src/components/studio/create-view.tsx` | Agent 3 | Upload image to R2 before post creation |
| `src/app/api/posts/[id]/route.ts` | Agent 3 | Delete R2 image when post is deleted |

### Deleted Files (1)
| File | Owner | Reason |
|------|-------|--------|
| `src/lib/storage/images.ts` | Agent 3 | Replaced by R2 module; no longer imported |

### Verified Files (3)
| File | Owner | Action |
|------|-------|--------|
| `src/lib/queries/generations.ts` | Agent 3 | Verify `base64` field passes through (likely no changes) |
| `src/components/studio/image-card.tsx` | Agent 3 | Verify data URIs render in `<img>` tag (likely no changes) |
| `src/components/studio/linkedin-preview.tsx` | Agent 3 | Verify data URIs render in preview (likely no changes) |

### Dependencies Added (1)
| Package | Owner | Purpose |
|---------|-------|---------|
| `@aws-sdk/client-s3` | Agent 1 | S3-compatible client for Cloudflare R2 |

## Environment Variables

### New Variables (add to `.env.local`)

```bash
# Cloudflare R2 — Image Storage (Production)
R2_ACCOUNT_ID=           # Cloudflare account ID (from dashboard URL)
R2_ACCESS_KEY_ID=        # R2 API token → Access Key ID
R2_SECRET_ACCESS_KEY=    # R2 API token → Secret Access Key
R2_BUCKET_NAME=          # e.g., "linkie-claw-images"
R2_PUBLIC_URL=           # e.g., "https://pub-xxx.r2.dev" or custom domain
```

### Cloudflare R2 Setup Steps (Manual — before running the code)

1. Log in to Cloudflare Dashboard
2. Go to R2 Object Storage → Create Bucket → name it `linkie-claw-images`
3. Enable public access: Bucket Settings → Public Access → Allow Access (get the `r2.dev` subdomain URL)
4. Create API Token: R2 → Manage R2 API Tokens → Create API Token → Object Read & Write → scope to your bucket
5. Copy the Access Key ID and Secret Access Key
6. Configure CORS on the bucket:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
7. Add all 5 environment variables to `.env.local`

## Local Development Fallback

If R2 is not configured (env vars missing), the `isR2Configured()` check returns false and the `/api/images/upload` endpoint returns 503. For local development without R2:

**Option A (recommended):** Set up R2 with the free tier (10GB free, takes 5 minutes).

**Option B (temporary):** Keep the old filesystem flow for local dev by not making the changes. The old `public/uploads/` approach works fine for `npm run dev`. The R2 changes are specifically for production readiness.

The codebase should NOT crash if R2 is not configured. The upload endpoint returns a clear error, and the frontend gracefully handles it (post saved without image).

## Validation

### Agent 1 Validation
```bash
npm run typecheck
npm run lint:fix
# Verify R2 module imports resolve
# Verify upload endpoint returns 503 when R2 not configured (no crash)
# If R2 is configured: test upload with a small base64 image
```

### Agent 2 Validation
```bash
npm run typecheck
npm run lint:fix
# Verify NO remaining imports of src/lib/storage/images in provider files
grep -r "storage/images" src/lib/api/
# Expected: zero results
# Verify image generation returns data URIs (Gemini) by checking API response format
```

### Agent 3 Validation
```bash
npm run typecheck
npm run lint:fix
npm run build
# Verify NO remaining imports of src/lib/storage/images anywhere
grep -r "storage/images" src/
# Expected: zero results
# Verify src/lib/storage/images.ts is deleted
```

### End-to-End Validation (Lead)
1. Configure R2 environment variables
2. Start dev server: `npm run dev`
3. Log in and navigate to `/create`
4. Generate content with an idea
5. Verify 6 images display in the grid (from data URIs, not `/uploads/` paths)
6. Select a text variation and an image
7. Click Schedule → verify image uploads to R2 (check R2 bucket in Cloudflare dashboard)
8. Verify the post is created with an R2 CDN URL in the database
9. Navigate to calendar → verify the post image loads from R2
10. Delete the post → verify the R2 object is removed
11. Verify existing posts with `/uploads/` paths still display correctly
12. Run full validation: `npm run typecheck && npm run lint:fix && npm run build`

## Success Criteria

- [ ] `@aws-sdk/client-s3` installed
- [ ] `src/lib/storage/r2.ts` created with upload, delete, URL helpers
- [ ] `POST /api/images/upload` endpoint works (base64 and temp URL paths)
- [ ] R2 environment variables documented
- [ ] Gemini provider returns base64/data URIs (no filesystem writes)
- [ ] Replicate provider returns temp CDN URLs (no downloads)
- [ ] Image generation API route has no filesystem cleanup calls
- [ ] `GeneratedImage` type includes optional `base64` field
- [ ] Frontend renders generated images from data URIs and temp URLs
- [ ] Post save uploads selected image to R2 first
- [ ] Post delete cleans up R2 image
- [ ] Old `src/lib/storage/images.ts` deleted
- [ ] No remaining imports of old storage module
- [ ] Legacy `/uploads/` images still render for existing posts
- [ ] n8n receives R2 CDN URL for image publishing
- [ ] Graceful fallback when R2 is not configured (clear error, no crash)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint:fix` passes
- [ ] `npm run build` passes

## What This Achieves

- **Zero server-side storage for preview images** — only the selected image is ever persisted
- **Production-ready image delivery** — Cloudflare CDN with global edge caching, zero egress costs
- **Automatic cleanup** — no orphaned images (R2 images tied 1:1 to posts, deleted with posts)
- **Public URLs for n8n** — LinkedIn publishing works from any server (not just localhost)
- **Provider flexibility** — both Gemini and Replicate work with the new architecture
- **Minimal cost** — R2 free tier covers 10GB (~5,000 saved posts with images)
- **No lifecycle rules needed** — since we never store preview images, there's nothing to expire
