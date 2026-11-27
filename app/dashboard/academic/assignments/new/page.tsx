import Link from "next/link";
import { getAcademicOverview } from "@/lib/academic/data";
import { PageHeading } from "@/components/ui/workspace";
import { AssignmentWizard } from "@/components/academic/assignment-wizard";

export default async function NewAssignmentPage() {
  const { courses } = await getAcademicOverview();

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow="ASSIGNMENT WIZARD"
        title="Create Assignment"
        description="Configure questions, submission formats, deadlines, and marking rules."
        action={
          <Link href="/dashboard/academic/assignments" className="button-secondary">
            Back to assignments
          </Link>
        }
      />

      {courses.length === 0 ? (
        <div className="panel p-8">
          <p className="font-bold text-[#111318]">Create a course first</p>
          <p className="mt-1 text-sm text-neutral-600">
            Assignments belong to an institutional course. Add a course before creating assignments.
          </p>
          <Link href="/dashboard/courses" className="button-primary mt-4 inline-flex">
            Go to Courses
          </Link>
        </div>
      ) : (
        <AssignmentWizard courses={courses} />
      )}
    </main>
  );
}
