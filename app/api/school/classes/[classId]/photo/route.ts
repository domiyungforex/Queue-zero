import { NextResponse } from "next/server";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceSecret } from "@/lib/qr/secret";
import { validateAttendanceToken, ExpiredAttendanceQr } from "@/lib/qr/validation";

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
  photo: z.string().min(100).max(600_000), // base64 data URL, max ~450 KB
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
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

    // Extract the base64 data
    const dataUrlMatch = parsed.data.photo.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!dataUrlMatch) {
      return NextResponse.json({ error: "Invalid image format. Use JPEG, PNG or WebP." }, { status: 400, headers });
    }
    const mimeType = dataUrlMatch[1];
    const base64Data = dataUrlMatch[2];

    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(base64Data, "base64");
    } catch {
      return NextResponse.json({ error: "Could not decode image." }, { status: 400, headers });
    }

    if (imageBuffer.length > 450_000) {
      return NextResponse.json({ error: "Photo must be under 450 KB." }, { status: 413, headers });
    }

    // Tenant-aware private path: attendance/org/class/nonce.ext
    const fileExt = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const fileName = `attendance/${orgId}/${classId}/${parsed.data.nonce}.${fileExt}`;

    const db = createJoinSupabaseClient();

    // Verify the class is open and nonce is valid
    const { data: nonceOk } = await db
      .from("attendance_qr_nonces")
      .select("class_session_id")
      .eq("nonce", parsed.data.nonce)
      .eq("class_session_id", classId)
      .eq("organization_id", orgId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!nonceOk) {
      return NextResponse.json({ error: "Attendance session is closed or QR has expired." }, { status: 410, headers });
    }

    // Upload to Supabase Storage
    const { data: uploaded, error: uploadError } = await db.storage
      .from("attendance-photos")
      .upload(fileName, imageBuffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError || !uploaded) {
      // Storage may not be configured — return a data URL as fallback
      // This keeps the system functional even without storage bucket
      console.warn("Photo storage upload failed:", uploadError?.message);
      return NextResponse.json(
        { url: parsed.data.photo, fallback: true },
        { status: 200, headers }
      );
    }

    // Get a signed URL (valid 7 days) so the lecturer dashboard can display it
    const { data: signedData } = await db.storage
      .from("attendance-photos")
      .createSignedUrl(uploaded.path, 60 * 60 * 24 * 7);

    const photoUrl = signedData?.signedUrl ?? parsed.data.photo;

    return NextResponse.json({ url: photoUrl }, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Photo upload failed." }, { status: 500, headers });
  }
}
