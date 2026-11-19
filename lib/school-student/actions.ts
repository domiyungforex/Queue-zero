"use server";

import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceScanSchema } from "@/lib/qr/replay-protection";
import { attendanceSecret } from "@/lib/qr/secret";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";
import { attendanceDeviceHash, attendanceNetworkHash } from "./device";
import { decideStudentAccess } from "./access";
import { registerStudent } from "./registration";

const resultSchema = z.object({
  ok: z.boolean(),
  status: z.string(),
  message: z.string(),
  full_name: z.string().nullable().optional(),
  matric_number: z.string().nullable().optional(),
  course_code: z.string().nullable().optional(),
  recorded_at: z.string().nullable().optional(),
  needs_review: z.boolean().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  identity_status: z.string().nullable().optional(),
  location_verified: z.boolean().nullable().optional(),
  location_status: z.string().nullable().optional(),
});
export type ScanResult = z.infer<typeof resultSchema> & { expired?: boolean };

export type LookupResult = {
  ok: boolean;
  found: boolean;
  full_name?: string;
  matric_number?: string;
  level?: string;
  programme?: string;
  department?: string;
  faculty?: string;
  selfRegistration?: boolean;
  message?: string;
};

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

const rosterSchema = z.object({
  found: z.boolean(),
  full_name: z.string().optional(),
  matric_number: z.string().optional(),
  level: z.string().optional(),
  programme: z.string().optional(),
  message: z.string().optional(),
});

const identifiedSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  full_name: z.string().optional(),
  matric_number: z.string().optional(),
  faculty: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
  sessions: z.array(z.object({ id: z.uuid() })).optional(),
});

const publicClassSchema = z.object({
  verification_mode: z.string().optional(),
  open: z.boolean().optional(),
});

function verificationMode(value: string | undefined): "STANDARD" | "VERIFIED" | "UNKNOWN" {
  const mode = value?.toUpperCase();
  if (mode === "VERIFIED") return "VERIFIED";
  if (mode === "STANDARD") return "STANDARD";
  return "UNKNOWN";
}

export async function lookupVerifiedStudent(tokenString: string, matricNumber: string): Promise<LookupResult> {
  try {
    const token = validateAttendanceToken(tokenString, attendanceSecret());
    const matric = matricNumber.trim();
    if (!matric) return { ok: false, found: false, message: "Enter your matriculation number." };
    const db = createJoinSupabaseClient() as unknown as RpcClient;
    const roster = await db.rpc("school_student_lookup", {
      p_organization_id: token.organization_id,
      p_class_id: token.session_id,
      p_matric_number: matric,
    });
    const rosterBody = rosterSchema.safeParse(roster.data);
    if (!roster.error && rosterBody.success && rosterBody.data.found && rosterBody.data.full_name) {
      return {
        ok: true,
        found: true,
        full_name: rosterBody.data.full_name,
        matric_number: rosterBody.data.matric_number ?? matric,
        level: rosterBody.data.level,
        programme: rosterBody.data.programme,
        department: rosterBody.data.programme,
      };
    }

    const identified = await db.rpc("school_identify_student", {
      p_organization_id: token.organization_id,
      p_matric_number: matric,
      p_device_hash: await attendanceDeviceHash(token.organization_id),
    });
    const identifiedBody = identifiedSchema.safeParse(identified.data);
    const known = !identified.error && identifiedBody.success && identifiedBody.data.ok && Boolean(identifiedBody.data.full_name);
    const eligible = known && (identifiedBody.success ? (identifiedBody.data.sessions ?? []).some((session) => session.id === token.session_id) : false);
    if (known && eligible && identifiedBody.success) {
      return {
        ok: true,
        found: true,
        full_name: identifiedBody.data.full_name,
        matric_number: identifiedBody.data.matric_number ?? matric,
        level: identifiedBody.data.level,
        faculty: identifiedBody.data.faculty,
        department: identifiedBody.data.department,
        programme: identifiedBody.data.department,
      };
    }

    const session = await db.rpc("school_public_class", {
      p_organization_id: token.organization_id,
      p_class_id: token.session_id,
      p_nonce: token.nonce,
    });
    const sessionBody = publicClassSchema.safeParse(session.data);
    if (session.error || !sessionBody.success) {
      return { ok: false, found: false, message: "This attendance link could not be checked. Scan the classroom QR again." };
    }
    const decision = decideStudentAccess({
      rosterFound: false,
      identified: known,
      eligibleForClass: eligible,
      verificationMode: verificationMode(sessionBody.data.verification_mode),
      sessionOpen: sessionBody.data.open !== false,
    });
    return { ok: true, found: false, selfRegistration: decision.selfRegistration, message: decision.message };
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) return { ok: false, found: false, message: "This attendance QR has expired. Scan the current classroom QR." };
    return { ok: false, found: false, message: "Unable to look up that matriculation number. Try again." };
  }
}

const directorySchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  faculties: z.array(z.object({ id: z.uuid(), name: z.string() })).optional(),
  departments: z.array(z.object({ id: z.uuid(), faculty_id: z.uuid(), name: z.string() })).optional(),
});

export async function loadAttendanceDirectory(tokenString: string) {
  try {
    const token = validateAttendanceToken(tokenString, attendanceSecret());
    const db = createJoinSupabaseClient() as unknown as RpcClient;
    const session = await db.rpc("school_public_class", {
      p_organization_id: token.organization_id,
      p_class_id: token.session_id,
      p_nonce: token.nonce,
    });
    const sessionBody = publicClassSchema.safeParse(session.data);
    if (session.error || !sessionBody.success || sessionBody.data.open === false || verificationMode(sessionBody.data.verification_mode) !== "STANDARD") {
      return { ok: false as const, message: "This class is not open for first-time registration." };
    }
    const directory = await db.rpc("school_public_directory", { p_organization_id: token.organization_id });
    const body = directorySchema.safeParse(directory.data);
    if (directory.error || !body.success || !body.data.ok) {
      return { ok: false as const, message: body.success ? body.data.message ?? "Registration is unavailable." : "Registration is unavailable." };
    }
    return { ok: true as const, faculties: body.data.faculties ?? [], departments: body.data.departments ?? [] };
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) return { ok: false as const, message: "This attendance QR has expired. Scan the current classroom QR." };
    return { ok: false as const, message: "Registration could not be opened. Try again." };
  }
}

export async function registerForAttendanceSession(tokenString: string, form: FormData) {
  try {
    const token = validateAttendanceToken(tokenString, attendanceSecret());
    const db = createJoinSupabaseClient() as unknown as RpcClient;
    const session = await db.rpc("school_public_class", {
      p_organization_id: token.organization_id,
      p_class_id: token.session_id,
      p_nonce: token.nonce,
    });
    const sessionBody = publicClassSchema.safeParse(session.data);
    if (session.error || !sessionBody.success || sessionBody.data.open === false) {
      return { ok: false as const, message: "Attendance for this class is closed." };
    }
    if (verificationMode(sessionBody.data.verification_mode) !== "STANDARD") {
      return { ok: false as const, message: "This class does not allow self-registration. Ask your lecturer to add you." };
    }
    form.set("organizationId", token.organization_id);
    return registerStudent(form);
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) return { ok: false as const, message: "This attendance QR has expired. Scan the current classroom QR." };
    return { ok: false as const, message: "Registration could not be checked. Scan the classroom QR again." };
  }
}

export async function recordAttendance(input: unknown): Promise<ScanResult> {
  const parsed = attendanceScanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: "INVALID", message: "Enter your full name and matric number." };
  try {
    const token = validateAttendanceToken(parsed.data.token, attendanceSecret());
    const db = createJoinSupabaseClient();
    const [deviceHash, networkHash] = await Promise.all([attendanceDeviceHash(token.organization_id), attendanceNetworkHash(token.organization_id)]);
    
    const photo = parsed.data.photo && !parsed.data.photo.startsWith("data:") ? parsed.data.photo : null;
    let attendRes = await db.rpc("school_attend_accountless", {
      p_organization_id: token.organization_id,
      p_class_id: token.session_id,
      p_nonce: token.nonce,
      p_full_name: parsed.data.fullName,
      p_matric_number: parsed.data.matricNumber,
      p_device_hash: deviceHash,
      p_network_hash: networkHash,
      p_request_id: parsed.data.requestId,
      p_photo_url: photo,
      p_location_lat: parsed.data.latitude ?? null,
      p_location_lng: parsed.data.longitude ?? null,
      p_location_accuracy_meters: parsed.data.accuracy ?? null,
      p_location_captured_at: parsed.data.capturedAt ?? null,
    });

    const sentLocation = parsed.data.latitude != null && parsed.data.longitude != null;
    if (
      attendRes.error &&
      !sentLocation &&
      (attendRes.error.code === "PGRST202" ||
        (attendRes.error.message && attendRes.error.message.includes("schema cache")))
    ) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Retrying school_attend_accountless with 8-param signature");
      }
      attendRes = await (db.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<typeof attendRes>)("school_attend_accountless", {
        p_organization_id: token.organization_id,
        p_class_id: token.session_id,
        p_nonce: token.nonce,
        p_full_name: parsed.data.fullName,
        p_matric_number: parsed.data.matricNumber,
        p_device_hash: deviceHash,
        p_network_hash: networkHash,
        p_request_id: parsed.data.requestId,
      });
    }

    if (attendRes.error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Attendance record failed", { code: attendRes.error.code, message: attendRes.error.message });
      }
      if (sentLocation && (attendRes.error.code === "PGRST202" || attendRes.error.message?.includes("schema cache"))) {
        return { ok: false, status: "UNAVAILABLE", message: "Your location was read, but attendance could not store it. Attendance was not recorded." };
      }
      if (attendRes.error.code === "22023") {
        return { ok: false, status: "INVALID", message: attendRes.error.message || "Attendance is closed or details are invalid." };
      }
      return { ok: false, status: "UNAVAILABLE", message: "Attendance could not be recorded. Check your connection and try again." };
    }
    const rawData = Array.isArray(attendRes.data) ? attendRes.data[0] : attendRes.data;
    const result = resultSchema.safeParse(rawData);
    if (result.success) return result.data;
    const fallbackMessage = (rawData && typeof rawData === "object" && "message" in rawData && typeof (rawData as { message: unknown }).message === "string")
      ? (rawData as { message: string }).message
      : "Attendance could not be confirmed. Retry this submission.";
    return { ok: false, status: "UNAVAILABLE", message: fallbackMessage };
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) return { ok: false, status: "CLOSED", expired: true, message: "Attendance for this class is closed." };
    return { ok: false, status: "UNAVAILABLE", message: "Attendance could not be confirmed. Check your connection and try again." };
  }
}
