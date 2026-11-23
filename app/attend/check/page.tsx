import type { Metadata } from "next";
import { Brand } from "@/components/ui/brand";
import { StudentCheckIn } from "@/components/school/student-check-in";
import { FeedbackNotice } from "@/components/school/feedback-notice";
import { loadRegistrationDirectory } from "@/lib/school-student/registration";
import "@/components/school/school.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Attendance check-in", robots: { index: false, follow: false } };

export default async function AttendanceCheckPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const orgId: string = org ?? "";
  const directory = orgId ? await loadRegistrationDirectory(orgId) : { ok: false as const, message: "Ask your institution for its attendance link." };
  return (
    <main className="school-public-flow">
      <Brand />
      <h1>Attendance check-in</h1>
      {directory.ok ? <StudentCheckIn organizationId={orgId} institution={directory.institution} /> : <FeedbackNotice ok={false} message={directory.message ?? "Ask your institution for its attendance link."} />}
    </main>
  );
}
