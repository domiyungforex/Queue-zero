import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { attendanceSecret } from "@/lib/qr/secret";

export async function attendanceDeviceHash(organizationId: string) {
  const jar = await cookies();
  const existing = z.uuid().safeParse(jar.get("turnmark-attendance-device")?.value);
  const id = existing.success ? existing.data : randomUUID();
  if (!existing.success) jar.set("turnmark-attendance-device", id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  // Organization-scoped opaque risk signal, not a fingerprint or proof of presence.
  return createHmac("sha256", attendanceSecret()).update(`device:${organizationId}:${id}`).digest("hex");
}
