import type { Metadata } from "next";
import { ScanLine, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { StudentScan } from "@/components/school/student-scan";
import { Brand } from "@/components/ui/brand";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceSecret } from "@/lib/qr/secret";
import { validateAttendanceToken } from "@/lib/qr/validation";
import styles from "@/components/school/attendance-scan.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Class attendance", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let message: string | null = null;
  let classInfo: z.infer<typeof publicClassSchema> | null = null;
  try {
    const payload = validateAttendanceToken(typeof token === "string" ? token : "", attendanceSecret());
    const { data, error } = await createJoinSupabaseClient().rpc("school_public_class", { p_organization_id: payload.organization_id, p_class_id: payload.session_id, p_nonce: payload.nonce });
    const parsed = publicClassSchema.safeParse(data);
    if (error || !parsed.success) message = "This attendance QR is invalid or unavailable. Ask your lecturer to check the class QR.";
    else classInfo = parsed.data;
  } catch { message = "Attendance for this class is closed."; }
  return <main className={styles.page} id="main"><div className={styles.shell}><header className={styles.siteHeader}><Brand priority /><span><ShieldCheck size={15} aria-hidden="true" />Secure attendance</span></header><article className={styles.card}><div className={styles.cardIntro}><span className={styles.scanIcon}><ScanLine size={24} aria-hidden="true" /></span><p>CLASS ATTENDANCE</p><h1>Mark your attendance</h1><span>Your lecturer’s QR opened this secure class check-in.</span></div>{message || !classInfo ? <div className={styles.unavailable} role="alert"><strong>Attendance unavailable</strong><p>{message ?? "This attendance QR is unavailable."}</p></div> : <StudentScan token={token!} classInfo={classInfo} />}</article><footer>{classInfo?.verification_mode === "VERIFIED" ? "Your details are checked against the official course roster." : classInfo?.verification_mode === "STANDARD" ? "No advance registration is needed. Enter your details to record attendance." : "Scan your lecturer’s QR code to continue."}</footer></div></main>;
}

const publicClassSchema = z.object({ organization_name: z.string(), course_code: z.string(), course_title: z.string(), starts_at: z.string().nullable(), planned_ends_at: z.string().nullable(), attendance_closes_at: z.string().nullable(), verification_mode: z.enum(["STANDARD", "VERIFIED"]), open: z.boolean() });
