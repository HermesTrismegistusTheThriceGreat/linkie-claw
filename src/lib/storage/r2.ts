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

export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}

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

export function getR2PublicUrl(key: string): string {
  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return `${base}/${key}`;
}

export function extractR2KeyFromUrl(url: string): string | null {
  if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) {
    return null;
  }
  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return url.slice(base.length + 1);
}
