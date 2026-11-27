import { NextResponse } from "next/server";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { decodeAttendancePhoto } from "@/lib/school/photo-quality";
import { attendanceObjectKey } from "@/lib/storage/keys";
import { storePrivateImage } from "@/lib/storage/store-image";
import { attendanceSecret } from "@/lib/qr/secret";
import { validateAttendanceToken, ExpiredAttendanceQr } from "@/lib/qr/validation";
import { checkRateLimit, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 10;

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const bodySchema = z.object({
  token: z.string().min(10),
  nonce: z.string().uuid(),
  photo: z.string().min(100).max(3_000_000), // base64 data URL
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const ip = clientIpFromRequest(request);
    const rate = checkRateLimit(`photo:${ip}`, { limit: 20, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please wait a moment and try again." },
        { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const { classId } = await params;
    if (!z.uuid().safeParse(classId).success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload data" }, { status: 400, headers });
    }

    // Validate the attendance token - ensures the class is real and open
    let orgId: string;
    let sessionId: string;
    try {
      const token = validateAttendanceToken(parsed.data.token, attendanceSecret());
      orgId = token.organization_id;
      sessionId = token.session_id;
    } catch (err) {
      if (err instanceof ExpiredAttendanceQr) {
        return NextResponse.json({ error: "Attendance session is closed." }, { status: 410, headers });
      }
      return NextResponse.json({ error: "Invalid attendance token." }, { status: 401, headers });
    }

    if (sessionId !== classId) {
      return NextResponse.json({ error: "Token does not match this class." }, { status: 403, headers });
    }

    const photo = decodeAttendancePhoto(parsed.data.photo);
    if (!photo.ok) {
      const status = photo.message.includes("450") ? 413 : 400;
      return NextResponse.json({ error: photo.message }, { status, headers });
    }

    let fileName: string;
    try {
      fileName = attendanceObjectKey(orgId, classId, parsed.data.nonce, photo.ext);
    } catch {
      return NextResponse.json({ error: "Invalid upload data" }, { status: 400, headers });
    }

    const db = createJoinSupabaseClient();

    // Verify the class is open and nonce is valid via the SECURITY DEFINER RPC
    // (direct SELECT on attendance_qr_nonces is revoked from service_role by RLS hardening).
    const { data: sessionInfo, error: sessionErr } = await db.rpc("school_public_class", {
      p_organization_id: orgId,
      p_class_id: classId,
      p_nonce: parsed.data.nonce,
    });

    if (sessionErr) {
      return NextResponse.json(
        { error: "Unable to verify attendance session right now. Please try again." },
        { status: 503, headers },
      );
    }

    const sessionOpen =
      sessionInfo &&
      typeof sessionInfo === "object" &&
      "open" in sessionInfo &&
      (sessionInfo as { open?: unknown }).open === true;

    if (!sessionOpen) {
      return NextResponse.json(
        { error: "Attendance session is closed or QR has expired." },
        { status: 410, headers },
      );
    }

    const stored = await storePrivateImage(db, { key: fileName, body: photo.buffer, type: photo.mime });
    if (!stored.ok) {
      return NextResponse.json({ error: "Photo storage is unavailable. Attendance can still be recorded without a stored selfie." }, { status: 503, headers });
    }

    return NextResponse.json({ path: stored.key }, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Photo upload failed." }, { status: 500, headers });
  }
}
