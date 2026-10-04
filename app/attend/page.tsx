import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { StudentScan } from "@/components/school/student-scan";
import { attendanceSecret } from "@/lib/qr/secret";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Class attendance", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let message: string | null = null;
  let expired = false;
  try { validateAttendanceToken(typeof token === "string" ? token : "", attendanceSecret()); }
  catch (error) { if (error instanceof ExpiredAttendanceQr) expired = true; else message = "This attendance QR is invalid or unavailable. Ask your lecturer to show a fresh QR."; }
  const { userId } = await auth();
  const returnTo = `/attend?token=${encodeURIComponent(typeof token === "string" ? token : "")}`;
  return <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-10"><Link href="/" className="text-xl font-bold text-primary">TuRnMaRk</Link><article className="space-y-6 rounded-3xl border border-line bg-white p-6 shadow-sm"><h1 className="text-3xl font-semibold">Class attendance</h1>{message ? <><p role="alert">{message}</p>{!userId && <Link className="button-primary" href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}>Sign in before scanning again</Link>}</> : !userId ? <><p>Sign in with the verified email your school enrolled. Attendance is recorded only after you confirm the scan.</p><p className="text-sm text-muted">If the QR expires while you sign in, scan the current classroom QR afterward.</p><Link className="button-primary" href={`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`}>Sign in to continue</Link></> : <StudentScan token={token!} expired={expired} />}</article></main>;
}
