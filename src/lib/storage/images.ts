import { writeFile, mkdir, unlink, readdir, stat } from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** Ensure upload directory exists */
async function ensureDir(): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

/** Download image from a remote URL (Replicate) and save locally */
export async function downloadAndSaveImage(
  remoteUrl: string,
  id: string
): Promise<string> {
  await ensureDir();

  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const contentType = response.headers.get("content-type") || "";
  const ext = contentType.includes("webp")
    ? "webp"
    : contentType.includes("png")
      ? "png"
      : "jpg";

  const filename = `${id}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);

  return `/uploads/${filename}`;
}

/** Save base64-encoded image data (Gemini) — re-encodes to strip C2PA metadata */
export async function saveImageFromBase64(
  base64Data: string,
  id: string
): Promise<string> {
  await ensureDir();

  const raw = Buffer.from(base64Data, "base64");
  const buffer = await sharp(raw).png().toBuffer();
  const filename = `${id}.png`;
  const filepath = path.join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);

  return `/uploads/${filename}`;
}

/** Delete a single image by its URL path */
export async function deleteImage(url: string): Promise<void> {
  const filename = url.replace("/uploads/", "");

  // Prevent path traversal attacks
  if (!/^[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(filename)) {
    return;
  }

  const filepath = path.join(UPLOAD_DIR, filename);

  try {
    await unlink(filepath);
  } catch {
    // Ignore if file doesn't exist
  }
}

/** Clean up images older than maxAgeMs (default: 24 hours) */
export async function cleanupOldImages(
  maxAgeMs: number = 24 * 60 * 60 * 1000
): Promise<number> {
  await ensureDir();

  const files = await readdir(UPLOAD_DIR);
  const now = Date.now();
  let deleted = 0;

  for (const file of files) {
    const filepath = path.join(UPLOAD_DIR, file);
    try {
      const fileStat = await stat(filepath);
      if (now - fileStat.mtimeMs > maxAgeMs) {
        await unlink(filepath);
        deleted++;
      }
    } catch {
      // Skip files we can't stat
    }
  }

  return deleted;
}
