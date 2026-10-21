import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createUserSupabaseClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env";
import { newAttendanceToken } from "@/lib/qr/rotation";
import { attendanceSecret } from "@/lib/qr/secret";
import { signAttendanceToken } from "@/lib/qr/signing";
import { attendanceTokenSchema } from "@/lib/qr/token";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const origin = request.headers.get("origin");
    const requestOrigin = new URL(request.url).origin;
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== requestOrigin)) return NextResponse.json({ error: "Open attendance from TuRnMaRk.", code: "INVALID_ORIGIN" }, { status: 403, headers });
    if (!(await auth()).userId) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
    const { classId } = await params;
    if (!z.uuid().safeParse(classId).success) return NextResponse.json({ error: "Invalid class" }, { status: 400, headers });
    const secret = attendanceSecret();
    const draft = newAttendanceToken(classId, classId);
    const db = await createUserSupabaseClient();
    const { data, error } = await db.rpc("school_issue_qr", { p_class_id: classId, p_nonce: draft.nonce, p_expires_at: new Date(draft.expires_at * 1000).toISOString() });
    const issued = z.object({
      organization_id: z.uuid(),
      session_id: z.uuid(),
      nonce: z.uuid().optional(),
      issued_at: z.iso.datetime({ offset: true }).optional(),
      expires_at: z.iso.datetime({ offset: true }),
    }).refine((value) => Boolean(value.nonce) === Boolean(value.issued_at)).safeParse(data);
    if (error) {
      if (error.code === "22023") return NextResponse.json({ error: "Attendance is closed or this QR was revoked.", code: "ATTENDANCE_CLOSED" }, { status: 409, headers });
      if (error.code === "42501") return NextResponse.json({ error: "You don’t have permission to create this class QR.", code: "ACCESS_DENIED" }, { status: 403, headers });
      console.error("Attendance QR database request failed", { code: error.code });
      return NextResponse.json({ error: "Attendance QR is temporarily unavailable.", code: "DATABASE_UNAVAILABLE" }, { status: 503, headers });
    }
    if (!issued.success) {
      console.error("Attendance QR database response was invalid");
      return NextResponse.json({ error: "Attendance QR is temporarily unavailable.", code: "INVALID_RESPONSE" }, { status: 503, headers });
    }
    if (issued.data.session_id !== classId) return NextResponse.json({ error: "This class is unavailable or you do not have permission.", code: "ACCESS_DENIED" }, { status: 403, headers });
    // Older hosted school_issue_qr versions return the submitted expiry but not
    // the submitted nonce/issue time. The function stores p_nonce atomically, so
    // the signed fallback remains bound to the exact database row it just wrote.
    const payload = attendanceTokenSchema.parse({ version: 1, purpose: "CLASS_ATTENDANCE", organization_id: issued.data.organization_id, session_id: classId, nonce: issued.data.nonce ?? draft.nonce, issued_at: issued.data.issued_at ? Math.floor(Date.parse(issued.data.issued_at) / 1000) : draft.issued_at, expires_at: Math.floor(Date.parse(issued.data.expires_at) / 1000) });
    const token = signAttendanceToken(payload, secret);
    const url = new URL("/attend", publicEnv.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("token", token);
    return NextResponse.json({ url: url.href, expiresAt: issued.data.expires_at }, { headers });
  } catch (cause) {
    console.error("Attendance QR generation failed", { reason: cause instanceof Error ? cause.message : "unknown" });
    return NextResponse.json({ error: "Attendance QR is temporarily unavailable.", code: "QR_UNAVAILABLE" }, { status: 503, headers });
  }
}
