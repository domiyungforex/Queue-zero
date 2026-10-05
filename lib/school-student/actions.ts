"use server";

import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceScanSchema } from "@/lib/qr/replay-protection";
import { attendanceSecret } from "@/lib/qr/secret";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";
import { attendanceDeviceHash } from "./device";

const resultSchema = z.object({
  ok: z.boolean(),
  action: z.enum(["CHECK_IN", "CHECK_OUT", "BLOCKED"]),
  status: z.string(),
  message: z.string(),
});

export type ScanResult = {
  ok: boolean;
  action?: "CHECK_IN" | "CHECK_OUT" | "BLOCKED";
  message: string;
  expired?: boolean;
};

export async function recordAttendance(input: unknown): Promise<ScanResult> {
  const parsed = attendanceScanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter your full name and matric number, then scan the current classroom QR." };
  }

  try {
    const token = validateAttendanceToken(parsed.data.token, attendanceSecret());
    const db = createJoinSupabaseClient();

    const { data, error } = await db.rpc("school_scan_open", {
      p_organization_id: token.organization_id,
      p_class_id: token.session_id,
      p_nonce: token.nonce,
      p_full_name: parsed.data.fullName,
      p_matric_number: parsed.data.matricNumber,
      p_device_hash: await attendanceDeviceHash(token.organization_id),
      p_request_id: parsed.data.requestId,
    });

    if (error) {
      return {
        ok: false,
        message: "Attendance could not be recorded. Check your details and scan the current QR again.",
      };
    }

    const result = resultSchema.safeParse(data);
    return result.success
      ? result.data
      : { ok: false, message: "Attendance could not be confirmed. Please try again." };
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) {
      return { ok: false, expired: true, message: "This QR has expired. Scan the current classroom QR." };
    }
    return {
      ok: false,
      message: "Attendance could not be confirmed. Check your connection and try again.",
    };
  }
}
