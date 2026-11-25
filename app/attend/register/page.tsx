import type { Metadata } from "next";
import { Brand } from "@/components/ui/brand";
import { StudentRegistration } from "@/components/school/student-registration";
import { FeedbackNotice } from "@/components/school/feedback-notice";
import { loadRegistrationDirectory } from "@/lib/school-student/registration";
import "@/components/school/school.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student registration", robots: { index: false, follow: false } };

export default async function RegisterStudentPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const orgId: string = org ?? "";
  const directory = orgId ? await loadRegistrationDirectory(orgId) : { ok: false as const, message: "Ask your institution for its registration link." };
  return (
    <main className="school-public-flow">
      <header className="school-public-header">
        <Brand />
        <span className="school-public-pill">One-time setup</span>
      </header>
      <section className="school-public-card">
        <div className="school-public-intro">
          <p>Institutional roster</p>
          <h1>Student registration</h1>
          <span>Register once with your matriculation number and reference photograph.</span>
        </div>
        <div className="school-public-body">
          {directory.ok ? <StudentRegistration organizationId={orgId} institution={directory.institution} faculties={directory.faculties} departments={directory.departments} /> : <FeedbackNotice ok={false} message={directory.message} />}
        </div>
      </section>
    </main>
  );
}
