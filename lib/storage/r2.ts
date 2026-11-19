import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readR2Settings } from "./r2-env";

export { readR2Settings } from "./r2-env";

let cached: { client: S3Client; bucket: string; endpoint: string } | null = null;

export function r2Bucket() {
  const settings = readR2Settings();
  if (!settings) return null;
  if (!cached || cached.bucket !== settings.bucket || cached.endpoint !== settings.endpoint) {
    cached = {
      bucket: settings.bucket,
      endpoint: settings.endpoint,
      client: new S3Client({
        region: "auto",
        endpoint: settings.endpoint,
        credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      }),
    };
  }
  return cached;
}

export function resetR2Client() {
  cached = null;
}

export async function r2Put(key: string, body: Uint8Array, contentType: string) {
  const bucket = r2Bucket();
  if (!bucket) return { ok: false as const, reason: "unconfigured" as const };
  await bucket.client.send(new PutObjectCommand({ Bucket: bucket.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=31536000" }));
  return { ok: true as const };
}

export async function r2Get(key: string) {
  const bucket = r2Bucket();
  if (!bucket) return null;
  try {
    const result = await bucket.client.send(new GetObjectCommand({ Bucket: bucket.bucket, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) return null;
    return { body: bytes, type: result.ContentType || "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function r2SignedGet(key: string, seconds = 300) {
  const bucket = r2Bucket();
  if (!bucket) return null;
  return getSignedUrl(bucket.client, new GetObjectCommand({ Bucket: bucket.bucket, Key: key }), { expiresIn: seconds });
}

export async function r2Delete(key: string) {
  const bucket = r2Bucket();
  if (!bucket) return;
  await bucket.client.send(new DeleteObjectCommand({ Bucket: bucket.bucket, Key: key }));
}
