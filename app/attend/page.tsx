import type { Metadata } from "next";
import { ScanLine, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { StudentScan } from "@/components/school/student-scan";
import { Brand } from "@/components/ui/brand";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceSecret } from "@/lib/qr/secret";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";
import styles from "@/components/school/attendance-scan.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Class attendance",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const publicClassSchema = z.object({
  organization_name: z.string().default("TuRnMaRk Attendance"),
  course_code: z.string().default("CLASS"),
  course_title: z.string().default("Class Session"),
  session_title: z.string().nullable().optional().default(null),
  starts_at: z.string().nullable().default(null),
  planned_ends_at: z.string().nullable().default(null),
  attendance_closes_at: z.string().nullable().default(null),
  verification_mode: z
    .union([z.enum(["STANDARD", "VERIFIED"]), z.string()])
    .transform((val) => (val?.toUpperCase() === "VERIFIED" ? "VERIFIED" : "STANDARD"))
    .default("STANDARD"),
  location_required: z.boolean().optional().default(false),
  location_lat: z.number().nullable().optional().default(null),
  location_lng: z.number().nullable().optional().default(null),
  geofence_radius_meters: z.number().nullable().optional().default(100),
  open: z.boolean().default(true),
});

async function resolveAttendanceClass(token: string) {
  const payload = validateAttendanceToken(token, attendanceSecret());
  const db = createJoinSupabaseClient();

  // Attempt 1: Call school_public_class RPC
  const { data, error } = await db.rpc("school_public_class", {
    p_organization_id: payload.organization_id,
    p_class_id: payload.session_id,
    p_nonce: payload.nonce,
  });

  const parsed = data ? publicClassSchema.safeParse(data) : null;

  if (!error && parsed && parsed.success && parsed.data) {
    if (!parsed.data.open) {
      return { classInfo: null, message: "Attendance for this class is currently closed." };
    }
    if (parsed.data.location_lat == null || parsed.data.location_lng == null) {
      const { data: zone } = await db
        .from("class_sessions")
        .select("location_lat, location_lng, geofence_radius_meters")
        .eq("id", payload.session_id)
        .eq("organization_id", payload.organization_id)
        .maybeSingle();
      if (zone?.location_lat != null && zone.location_lng != null) {
        parsed.data.location_required = true;
        parsed.data.location_lat = zone.location_lat;
        parsed.data.location_lng = zone.location_lng;
        parsed.data.geofence_radius_meters = zone.geofence_radius_meters ?? parsed.data.geofence_radius_meters;
      }
    }
    return { classInfo: parsed.data, message: null };
  }

  // Attempt 2 (Fallback): Query class session directly with service-role client
  const { data: cls } = await db
    .from("class_sessions")
    .select("id, organization_id, course_id, title, planned_ends_at, attendance_closes_at, verification_mode, location_lat, location_lng, geofence_radius_meters, arrival_open, qr_revoked_at")
    .eq("id", payload.session_id)
    .eq("organization_id", payload.organization_id)
    .maybeSingle();

  if (!cls) {
    return {
      classInfo: null,
      message: "This attendance session could not be found. Ask your lecturer to check the class QR.",
    };
  }

  const [courseRes, sessionRes, orgRes] = await Promise.all([
    db.from("courses").select("code, title").eq("id", cls.course_id).maybeSingle(),
    db.from("sessions").select("starts_at, status").eq("id", cls.id).maybeSingle(),
    db.from("businesses").select("name").eq("id", cls.organization_id).maybeSingle(),
  ]);

  const isOpen =
    sessionRes.data?.status === "OPEN" &&
    cls.arrival_open &&
    !cls.qr_revoked_at &&
    (!cls.attendance_closes_at || new Date(cls.attendance_closes_at).getTime() > Date.now());

  if (!isOpen) {
    return { classInfo: null, message: "Attendance for this class is currently closed." };
  }

  const classInfo: z.infer<typeof publicClassSchema> = {
    organization_name: orgRes.data?.name ?? "TuRnMaRk Attendance",
    course_code: courseRes.data?.code ?? "CLASS",
    course_title: courseRes.data?.title ?? "Class Session",
    session_title: cls.title ?? null,
    starts_at: sessionRes.data?.starts_at ?? null,
    planned_ends_at: cls.planned_ends_at ?? null,
    attendance_closes_at: cls.attendance_closes_at ?? null,
    verification_mode: (cls.verification_mode?.toUpperCase() === "VERIFIED" ? "VERIFIED" : "STANDARD") as "STANDARD" | "VERIFIED",
    location_required: Boolean(cls.location_lat != null && cls.location_lng != null),
    location_lat: cls.location_lat,
    location_lng: cls.location_lng,
    geofence_radius_meters: cls.geofence_radius_meters ?? 100,
    open: true,
  };

  return { classInfo, message: null };
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let message: string | null = null;
  let classInfo: z.infer<typeof publicClassSchema> | null = null;

  if (!token || typeof token !== "string" || token.trim() === "") {
    message = "Scan the QR code displayed on the classroom screen to mark your attendance.";
  } else {
    try {
      const resolved = await resolveAttendanceClass(token);
      classInfo = resolved.classInfo;
      message = resolved.message;
    } catch (cause) {
      if (cause instanceof ExpiredAttendanceQr) {
        message = "This attendance QR has expired. Ask your lecturer for the updated QR code.";
      } else {
        message = "This attendance QR is invalid or expired. Scan the current classroom QR.";
      }
    }
  }

  return (
    <main className={styles.page} id="main">
      <div className={styles.shell}>
        <header className={styles.siteHeader}>
          <Brand priority />
          <span>
            <ShieldCheck size={15} aria-hidden="true" />
            Secure attendance
          </span>
        </header>
        <article className={styles.card}>
          <div className={styles.cardIntro}>
            <span className={styles.scanIcon}>
              <ScanLine size={24} aria-hidden="true" />
            </span>
            <p>CLASS ATTENDANCE</p>
            <h1>Mark your attendance</h1>
            <span>Your lecturer’s QR opened this secure class check-in.</span>
          </div>
          {message || !classInfo ? (
            <div className={styles.unavailable} role="alert">
              <strong>Attendance unavailable</strong>
              <p>{message ?? "This attendance QR is unavailable."}</p>
            </div>
          ) : (
            <StudentScan token={token!} classInfo={classInfo} />
          )}
        </article>
        <footer>
          {classInfo?.verification_mode === "VERIFIED"
            ? "Your details are checked against the official course roster."
            : classInfo?.verification_mode === "STANDARD"
              ? "No advance registration is needed. Enter your details to record attendance."
              : "Scan your lecturer’s QR code to continue."}
        </footer>
      </div>
    </main>
  );
}
