import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { StudentScan } from "@/components/school/student-scan";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { attendanceSecret } from "@/lib/qr/secret";
import { validateAttendanceToken } from "@/lib/qr/validation";
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
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-10"><Link href="/" className="text-xl font-bold text-primary">TuRnMaRk</Link><article className="space-y-6 rounded-3xl border border-line bg-white p-6 shadow-sm"><h1 className="text-3xl font-semibold">Mark Attendance</h1>{message || !classInfo ? <p role="alert">{message ?? "This attendance QR is unavailable."}</p> : <StudentScan token={token!} classInfo={classInfo} />}</article></main>;
}

const publicClassSchema = z.object({ organization_name: z.string(), course_code: z.string(), course_title: z.string(), starts_at: z.string().nullable(), planned_ends_at: z.string().nullable(), attendance_closes_at: z.string().nullable(), open: z.boolean() });
