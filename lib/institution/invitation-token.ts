import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

function key() {
 const value = z.string().min(32).safeParse(process.env.QUEUE_JOIN_SECRET);
 if (!value.success) throw new Error("Invitation signing is unavailable");
 return createHmac("sha256", value.data).update("turnmark:institution-invitations:v1").digest();
}
export function invitationToken(id: string) {
 return createHmac("sha256", key()).update(z.uuid().parse(id)).digest("base64url");
}
export function invitationDigest(token: string) {
 if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid invitation");
 return createHash("sha256").update(token).digest("hex");
}
export function signImportPreview(value: unknown) {
 const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
 return `${payload}.${createHmac("sha256", key()).update(`preview:${payload}`).digest("base64url")}`;
}
export function readImportPreview(value: string): unknown {
 if (value.length > 200_000) throw new Error("Import preview too large");
 const parts = value.split(".");
 if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) throw new Error("Invalid import preview");
 const signature = Buffer.from(parts[1], "base64url");
 const expected = createHmac("sha256", key()).update(`preview:${parts[0]}`).digest();
 if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new Error("Invalid import preview");
 return JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
}
