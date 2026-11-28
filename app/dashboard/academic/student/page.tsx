import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";
import { getStudentPortalData } from "@/lib/academic/data";
import { EmptyState, PageHeading } from "@/components/ui/workspace";
import { Breadcrumbs } from "@/components/ui/flow";

export default async function StudentAssignmentsPortalPage() {
  const { assignments, studentProfile } = await getStudentPortalData();

  return (
    <main className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Academic", href: "/dashboard/academic" },
          { label: "Student Portal" },
        ]}
      />
      <PageHeading
        eyebrow="STUDENT PORTAL"
        title="My Assignments"
        description={
          studentProfile
            ? `Matriculation: ${studentProfile.matric_number} · Level ${studentProfile.level}`
            : "View published assignments, save drafts, submit work, and review feedback."
        }
      />

      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments published yet"
          description="Published coursework, practicals, and assessments from your institution will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map((a) => {
            const sub = a.submission;
            const isSubmitted = sub && sub.status !== "DRAFT";
            return (
              <article key={a.id} className="panel flex flex-col justify-between p-5 transition hover:border-[#ff6b2b]">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-bold text-[#d94b14]">
                      {a.course_code} · {a.category.replaceAll("_", " ")}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold">
                      {isSubmitted ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Clock3 size={12} />}
                      {sub ? sub.status : "NEW"}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-[#111318]">{a.title}</h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Total Marks: {a.total_marks}
                    {a.due_at ? ` · Due ${new Date(a.due_at).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4 text-sm">
                  <span className="text-xs font-semibold text-neutral-600">
                    {sub?.grade_released && sub.final_score != null
                      ? `Score: ${sub.final_score} / ${a.total_marks}`
                      : isSubmitted
                        ? "Submitted"
                        : "Open for submission"}
                  </span>
                  <Link
                    href={`/dashboard/academic/student/${a.id}`}
                    className="font-bold text-[#ff6b2b] hover:underline"
                  >
                    {isSubmitted ? "View Receipt →" : "Open Assignment →"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
