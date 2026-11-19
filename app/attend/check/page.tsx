import type { Metadata } from "next";
import { Brand } from "@/components/ui/brand";
import { StudentCheckIn } from "@/components/school/student-check-in";
import { loadRegistrationDirectory } from "@/lib/school-student/registration";
import "@/components/school/school.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Attendance check-in", robots: { index: false, follow: false } };

export default async function AttendanceCheckPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const directory = org ? await loadRegistrationDirectory(org) : { ok: false as const, message: "Ask your institution for its attendance link." };
  return (
    <main className="school-public-flow">
      <Brand />
      <h1>Attendance check-in</h1>
      {directory.ok && org ? <StudentCheckIn organizationId={org} institution={directory.institution} /> : <p role="alert">{directory.message}</p>}
    </main>
  );
}
