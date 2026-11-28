import Link from "next/link";
import { getAcademicOverview } from "@/lib/academic/data";
import { PageHeading } from "@/components/ui/workspace";
import { Breadcrumbs } from "@/components/ui/flow";
import { AssignmentWizard } from "@/components/academic/assignment-wizard";

export default async function NewAssignmentPage() {
  const { courses } = await getAcademicOverview();

  return (
    <main className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Academic", href: "/dashboard/academic" },
          { label: "Assignments", href: "/dashboard/academic/assignments" },
          { label: "Create Assignment" },
        ]}
      />
      <PageHeading
        eyebrow="ASSIGNMENT WIZARD"
        title="Create Assignment"
        description="Configure questions, submission formats, deadlines, and marking rules. Select an existing course or enter course details manually."
        action={
          <Link href="/dashboard/academic/assignments" className="button-secondary">
            Back to assignments
          </Link>
        }
      />

      <AssignmentWizard courses={courses} />
    </main>
  );
}
