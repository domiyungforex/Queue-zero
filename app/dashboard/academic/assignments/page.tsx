import Link from "next/link";
import { Plus } from "lucide-react";
import { getAcademicOverview } from "@/lib/academic/data";
import { PageHeading, StatCard } from "@/components/ui/workspace";
import { AssignmentsDashboard } from "@/components/academic/assignments-dashboard";

export default async function LecturerAssignmentsPage() {
  const { assignments, courses, stats } = await getAcademicOverview();

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow="LECTURER WORKSPACE"
        title="Assignments & Assessments"
        description="Create, publish, monitor submissions, and grade student work."
        action={
          <Link href="/dashboard/academic/assignments/new" className="button-primary">
            <Plus size={16} aria-hidden="true" />
            Create Assignment
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Assignments" value={stats.totalAssignments} />
        <StatCard label="Drafts" value={stats.draftAssignments} />
        <StatCard label="Published" value={stats.publishedAssignments} />
        <StatCard label="Awaiting Marking" value={stats.awaitingMarking} />
      </section>

      <AssignmentsDashboard assignments={assignments} courses={courses} />
    </main>
  );
}
