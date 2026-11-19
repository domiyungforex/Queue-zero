import "server-only";
import { r2Delete, r2Get, r2Put, readR2Settings } from "./r2";
import { thumbnailKey } from "./keys";

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Buffer, options: { contentType: string; upsert: boolean }) => Promise<{ data: { path: string } | null; error: { message: string } | null }>;
      download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
      remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export async function storePrivateImage(db: StorageClient, input: { key: string; body: Buffer; type: string }) {
  if (readR2Settings()) {
    try {
      const saved = await r2Put(input.key, input.body, input.type);
      if (saved.ok) {
        if (input.body.byteLength <= 80_000) await r2Put(thumbnailKey(input.key), input.body, input.type).catch(() => undefined);
        return { ok: true as const, provider: "r2" as const, key: input.key };
      }
    } catch {
      // The private Supabase bucket remains the fallback so a capture is not lost.
    }
  }
  const uploaded = await db.storage.from("attendance-photos").upload(input.key, input.body, { contentType: input.type, upsert: true });
  if (uploaded.error || !uploaded.data) return { ok: false as const, message: "The photograph could not be stored." };
  return { ok: true as const, provider: "supabase" as const, key: uploaded.data.path || input.key };
}

export async function deletePrivateImage(db: StorageClient, key: string, provider: "r2" | "supabase") {
  if (provider === "r2") {
    await r2Delete(key).catch(() => undefined);
    await r2Delete(thumbnailKey(key)).catch(() => undefined);
    return;
  }
  await db.storage.from("attendance-photos").remove([key]).catch(() => undefined);
}

export async function readPrivateImage(db: StorageClient, key: string, variant: "full" | "thumb") {
  const thumb = variant === "thumb" ? thumbnailKey(key) : key;
  if (readR2Settings()) {
    const stored = await r2Get(thumb);
    if (stored) return stored;
    if (thumb !== key) {
      const full = await r2Get(key);
      if (full) return full;
    }
  }
  const downloaded = await db.storage.from("attendance-photos").download(variant === "thumb" ? thumb : key);
  if (!downloaded.error && downloaded.data) {
    return { body: new Uint8Array(await downloaded.data.arrayBuffer()), type: downloaded.data.type || "image/jpeg" };
  }
  if (variant === "thumb") {
    const full = await db.storage.from("attendance-photos").download(key);
    if (!full.error && full.data) return { body: new Uint8Array(await full.data.arrayBuffer()), type: full.data.type || "image/jpeg" };
  }
  return null;
}
