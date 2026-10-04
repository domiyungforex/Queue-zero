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
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(publicEnv.NEXT_PUBLIC_APP_URL).origin)) return NextResponse.json({ error: "Open attendance from TuRnMaRk." }, { status: 403, headers });
    if (!(await auth()).userId) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers });
    const { classId } = await params;
    if (!z.uuid().safeParse(classId).success) return NextResponse.json({ error: "Invalid class" }, { status: 400, headers });
    const secret = attendanceSecret();
    const draft = newAttendanceToken(classId, classId);
    const db = await createUserSupabaseClient();
    const { data, error } = await db.rpc("school_issue_qr", { p_class_id: classId, p_nonce: draft.nonce, p_expires_at: new Date(draft.expires_at * 1000).toISOString() });
    const issued = z.object({ organization_id: z.uuid(), session_id: z.uuid(), nonce: z.uuid(), issued_at: z.iso.datetime(), expires_at: z.iso.datetime() }).safeParse(data);
    if (error || !issued.success || issued.data.session_id !== classId) return NextResponse.json({ error: "This class is unavailable or you do not have permission." }, { status: 403, headers });
    const payload = attendanceTokenSchema.parse({ version: 1, purpose: "CLASS_ATTENDANCE", organization_id: issued.data.organization_id, session_id: classId, nonce: issued.data.nonce, issued_at: Math.floor(Date.parse(issued.data.issued_at) / 1000), expires_at: Math.floor(Date.parse(issued.data.expires_at) / 1000) });
    const token = signAttendanceToken(payload, secret);
    const url = new URL("/attend", publicEnv.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("token", token);
    return NextResponse.json({ url: url.href, expiresAt: issued.data.expires_at }, { headers });
  } catch {
    return NextResponse.json({ error: "Attendance QR is temporarily unavailable." }, { status: 503, headers });
  }
}
