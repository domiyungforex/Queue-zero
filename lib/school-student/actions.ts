"use server";

import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceScanSchema } from "@/lib/qr/replay-protection";
import { attendanceSecret } from "@/lib/qr/secret";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";
import { attendanceDeviceHash, attendanceNetworkHash } from "./device";

const resultSchema = z.object({ ok: z.boolean(), status: z.string(), message: z.string(), full_name: z.string().optional(), matric_number: z.string().optional(), course_code: z.string().optional(), recorded_at: z.string().optional(), needs_review: z.boolean().optional() });
export type ScanResult = z.infer<typeof resultSchema> & { expired?: boolean };
export async function recordAttendance(input: unknown): Promise<ScanResult> {
  const parsed = attendanceScanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: "INVALID", message: "Enter your full name and matric number." };
  try {
    const token = validateAttendanceToken(parsed.data.token, attendanceSecret());
    const db = createJoinSupabaseClient();
    const [deviceHash, networkHash] = await Promise.all([attendanceDeviceHash(token.organization_id), attendanceNetworkHash(token.organization_id)]);
    const { data, error } = await db.rpc("school_attend_accountless", { p_organization_id: token.organization_id, p_class_id: token.session_id, p_nonce: token.nonce, p_full_name: parsed.data.fullName, p_matric_number: parsed.data.matricNumber, p_device_hash: deviceHash, p_network_hash: networkHash, p_request_id: parsed.data.requestId });
    if (error) return { ok: false, status: "UNAVAILABLE", message: "Attendance could not be recorded. Check your connection and try again." };
    const result = resultSchema.safeParse(data);
    return result.success ? result.data : { ok: false, status: "UNAVAILABLE", message: "Attendance could not be confirmed. Retry this submission." };
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) return { ok: false, status: "CLOSED", expired: true, message: "Attendance for this class is closed." };
    return { ok: false, status: "UNAVAILABLE", message: "Attendance could not be confirmed. Check your connection and try again." };
  }
}
