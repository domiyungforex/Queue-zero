"use server";

import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceScanSchema } from "@/lib/qr/replay-protection";
import { attendanceSecret } from "@/lib/qr/secret";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";
import { attendanceDeviceHash, attendanceNetworkHash } from "./device";

const resultSchema = z.object({
  ok: z.boolean(),
  status: z.string(),
  message: z.string(),
  full_name: z.string().optional(),
  matric_number: z.string().optional(),
  course_code: z.string().optional(),
  recorded_at: z.string().optional(),
  needs_review: z.boolean().optional(),
  photo_url: z.string().optional(),
  identity_status: z.string().optional(),
  location_verified: z.boolean().optional(),
});
export type ScanResult = z.infer<typeof resultSchema> & { expired?: boolean };

export type LookupResult = {
  ok: boolean;
  found: boolean;
  full_name?: string;
  matric_number?: string;
  level?: string;
  programme?: string;
  message?: string;
};

export async function lookupVerifiedStudent(tokenString: string, matricNumber: string): Promise<LookupResult> {
  try {
    const token = validateAttendanceToken(tokenString, attendanceSecret());
    const db = createJoinSupabaseClient();
    const { data, error } = await db.rpc("school_student_lookup", {
      p_organization_id: token.organization_id,
      p_class_id: token.session_id,
      p_matric_number: matricNumber,
    });
    if (error || !data) return { ok: false, found: false, message: "Lookup service unavailable." };
    const parsed = z.object({
      found: z.boolean(),
      full_name: z.string().optional(),
      matric_number: z.string().optional(),
      level: z.string().optional(),
      programme: z.string().optional(),
      message: z.string().optional(),
    }).safeParse(data);
    if (!parsed.success) return { ok: false, found: false, message: "Lookup response invalid." };
    return { ok: true, ...parsed.data };
  } catch {
    return { ok: false, found: false, message: "Unable to verify student at this time." };
  }
}

export async function recordAttendance(input: unknown): Promise<ScanResult> {
  const parsed = attendanceScanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: "INVALID", message: "Enter your full name and matric number." };
  try {
    const token = validateAttendanceToken(parsed.data.token, attendanceSecret());
    const db = createJoinSupabaseClient();
    const [deviceHash, networkHash] = await Promise.all([attendanceDeviceHash(token.organization_id), attendanceNetworkHash(token.organization_id)]);
    const { data, error } = await db.rpc("school_attend_accountless", {
      p_organization_id: token.organization_id,
      p_class_id: token.session_id,
      p_nonce: token.nonce,
      p_full_name: parsed.data.fullName,
      p_matric_number: parsed.data.matricNumber,
      p_device_hash: deviceHash,
      p_network_hash: networkHash,
      p_request_id: parsed.data.requestId,
      p_photo_url: parsed.data.photo ?? null,
      p_location_lat: parsed.data.latitude ?? null,
      p_location_lng: parsed.data.longitude ?? null,
      p_location_accuracy_meters: parsed.data.accuracy ?? null,
    });
    if (error) return { ok: false, status: "UNAVAILABLE", message: "Attendance could not be recorded. Check your connection and try again." };
    const result = resultSchema.safeParse(data);
    return result.success ? result.data : { ok: false, status: "UNAVAILABLE", message: "Attendance could not be confirmed. Retry this submission." };
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) return { ok: false, status: "CLOSED", expired: true, message: "Attendance for this class is closed." };
    return { ok: false, status: "UNAVAILABLE", message: "Attendance could not be confirmed. Check your connection and try again." };
  }
}
