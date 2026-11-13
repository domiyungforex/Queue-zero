import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { z } from "zod";
import { attendanceSecret } from "@/lib/qr/secret";

export async function attendanceDeviceHash(organizationId: string) {
  let id: string = randomUUID();
  try {
    const jar = await cookies();
    const existing = z.uuid().safeParse(jar.get("turnmark-attendance-device")?.value);
    if (existing.success) {
      id = existing.data;
    } else {
      try {
        jar.set("turnmark-attendance-device", id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      } catch {
        // Safe fallback if cookies cannot be written in this context
      }
    }
  } catch {
    // Cookie store access unavailable; fallback to isolated UUID
  }
  return createHmac("sha256", attendanceSecret()).update(`device:${organizationId}:${id}`).digest("hex");
}

export async function attendanceNetworkHash(organizationId: string) {
  let address = "unknown";
  try {
    const values = await headers();
    const forwarded = values.get("x-forwarded-for")?.split(",")[0]?.trim();
    address = values.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
  } catch {
    // Headers access unavailable
  }
  return createHmac("sha256", attendanceSecret()).update(`network:${organizationId}:${address}`).digest("hex");
}
