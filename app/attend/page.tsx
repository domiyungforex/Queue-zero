import type { Metadata } from "next";
import Link from "next/link";
import { StudentScan } from "@/components/school/student-scan";
import { attendanceSecret } from "@/lib/qr/secret";
import { ExpiredAttendanceQr, validateAttendanceToken } from "@/lib/qr/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Class attendance",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let message: string | null = null;
  let expired = false;

  try {
    validateAttendanceToken(typeof token === "string" ? token : "", attendanceSecret());
  } catch (error) {
    if (error instanceof ExpiredAttendanceQr) expired = true;
    else message = "This attendance QR is invalid or unavailable. Ask your lecturer to show a fresh QR.";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" className="text-xl font-bold text-primary">QueueZero</Link>
      <article className="space-y-6 rounded-3xl border border-line bg-white p-6 shadow-sm">
        <div>
          <p className="eyebrow">CLASS ATTENDANCE</p>
          <h1 className="text-3xl font-semibold">Mark your attendance</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            No QueueZero account is required. Enter your name and matric number exactly as you use them at school.
          </p>
        </div>
        {message ? (
          <p role="alert">{message}</p>
        ) : (
          <StudentScan token={token!} expired={expired} />
        )}
      </article>
    </main>
  );
}
