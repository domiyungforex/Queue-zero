import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { createUserSupabaseClient } from "@/lib/db/server";
import { getSupabaseEnv } from "@/lib/db/env";
import { privatePhotoObjectPath } from "@/lib/school/photo-src";
import { objectKeyOrganization } from "@/lib/storage/keys";
import { readPrivateImage } from "@/lib/storage/store-image";

export const runtime = "nodejs";
export const maxDuration = 15;

const headers = {
  "Cache-Control": "private, max-age=120",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function imageResponse(bytes: Uint8Array, type: string) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(type) || bytes.byteLength < 32 || bytes.byteLength > 500_000) {
    return new NextResponse(null, { status: 404, headers });
  }
  return new NextResponse(Buffer.from(bytes), { status: 200, headers: { ...headers, "Content-Type": type } });
}

function fromDataUrl(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) return null;
  try {
    return imageResponse(Buffer.from(match[2].replace(/\s/g, ""), "base64"), match[1]);
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  if (!z.uuid().safeParse(recordId).success) return new NextResponse(null, { status: 404, headers });

  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();
  const { data, error } = await db
    .from("attendance_records")
    .select("id, organization_id, photo_url")
    .eq("id", recordId)
    .maybeSingle();
  if (error || !data?.photo_url || data.organization_id !== membership.businessId) {
    return new NextResponse(null, { status: 404, headers });
  }

  const stored = data.photo_url;
  if (stored.startsWith("data:")) return fromDataUrl(stored) ?? new NextResponse(null, { status: 404, headers });

  const objectPath = privatePhotoObjectPath(stored);
  const variant = new URL(request.url).searchParams.get("variant") === "thumb" ? "thumb" : "full";
  if (objectPath) {
    const owner = objectKeyOrganization(objectPath);
    if (owner && owner !== membership.businessId.toLowerCase()) return new NextResponse(null, { status: 404, headers });
    try {
      const admin = createJoinSupabaseClient();
      const downloaded = await readPrivateImage(admin, objectPath, variant);
      if (downloaded) {
        const type = downloaded.type.split(";")[0].trim() || (objectPath.endsWith(".png") ? "image/png" : objectPath.endsWith(".webp") ? "image/webp" : "image/jpeg");
        return imageResponse(downloaded.body, type);
      }
    } catch {
      // Fall through to a still-valid signed URL for this project only.
    }
  }

  if (stored.startsWith("https://")) {
    try {
      const target = new URL(stored);
      const project = new URL(getSupabaseEnv().NEXT_PUBLIC_SUPABASE_URL);
      if (target.origin === project.origin) {
        const fetched = await fetch(target, { cache: "no-store" });
        if (fetched.ok) {
          const type = (fetched.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
          return imageResponse(new Uint8Array(await fetched.arrayBuffer()), type);
        }
      }
    } catch {
      return new NextResponse(null, { status: 404, headers });
    }
  }

  return new NextResponse(null, { status: 404, headers });
}
