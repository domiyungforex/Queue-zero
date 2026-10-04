"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceScanSchema } from "@/lib/qr/replay-protection";
import { attendanceSecret } from "@/lib/qr/secret";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";
import { attendanceDeviceHash } from "./device";

const resultSchema = z.object({ ok: z.boolean(), action: z.enum(["CHECK_IN", "CHECK_OUT", "BLOCKED"]), status: z.string(), message: z.string() });
export type ScanResult = { ok: boolean; action?: "CHECK_IN" | "CHECK_OUT" | "BLOCKED"; message: string; expired?: boolean };
export async function recordAttendance(input: unknown): Promise<ScanResult> {
  const parsed = attendanceScanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid scan. Please scan the current classroom QR." };
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, message: "Sign in before recording attendance." };
    const token = validateAttendanceToken(parsed.data.token, attendanceSecret(), { allowExpiredReplay: true });
    if (token.expires_at <= Math.floor(Date.now() / 1000)) {
      // An expired QR may only retrieve a previously committed result. It must
      // never claim identity, register a device or start another transition.
      const { data, error } = await createJoinSupabaseClient().rpc("school_replay", { p_organization_id: token.organization_id, p_class_id: token.session_id, p_nonce: token.nonce, p_user_id: userId, p_request_id: parsed.data.requestId });
      const prior = resultSchema.safeParse(data);
      if (!error && prior.success) return prior.data;
      return { ok: false, expired: true, message: "This QR has expired. Scan the current classroom QR." };
    }
    const user = await currentUser();
    if (!user || user.id !== userId) return { ok: false, message: "Your session has expired. Please sign in again." };
    const emails = user.emailAddresses.filter(email => email.verification?.status === "verified");
    if (!emails.length) return { ok: false, message: "Verify your school email address before scanning." };
    const db = createJoinSupabaseClient();
    let claimed = false;
    for (const email of emails) {
      const claim = await db.rpc("school_claim_student", { p_organization_id: token.organization_id, p_user_id: userId, p_verified_email: email.emailAddress });
      if (!claim.error && claim.data) { claimed = true; break; }
    }
    if (!claimed) return { ok: false, message: "No enrollment was found for your verified email. Ask your lecturer to check your enrollment." };
    const { data, error } = await db.rpc("school_scan", { p_organization_id: token.organization_id, p_class_id: token.session_id, p_nonce: token.nonce, p_user_id: userId, p_device_hash: await attendanceDeviceHash(token.organization_id), p_request_id: parsed.data.requestId });
    if (error) return { ok: false, message: "Attendance could not be recorded. Check enrollment and scan the current QR; contact your lecturer if this continues." };
    const result = resultSchema.safeParse(data);
    return result.success ? result.data : { ok: false, message: "Attendance could not be confirmed. Retry this scan." };
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) return { ok: false, expired: true, message: error.message };
    return { ok: false, message: "Attendance could not be confirmed. Check your connection and retry, or scan the current QR." };
  }
}
