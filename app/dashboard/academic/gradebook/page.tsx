import Link from "next/link";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { PageHeading } from "@/components/ui/workspace";

export default async function GradebookPage() {
  const membership = await requireBusinessMembership();
  const db = createJoinSupabaseClient();

  const [{ data: entries }, { data: courses }] = await Promise.all([
    (db as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, v: unknown) => {
            order: (col2: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    })
      .from("gradebook_entries")
      .select("id,course_id,student_id,ca_score,exam_score,total_score,letter_grade,status,lecturer_remarks,updated_at")
      .eq("organization_id", membership.businessId)
      .order("updated_at", { ascending: false }),
    db.from("courses").select("id,code,title").eq("organization_id", membership.businessId),
  ]);

  const courseMap = new Map((courses ?? []).map((c) => [c.id, `${c.code} — ${c.title}`]));

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow="GRADEBOOK & RESULTS"
        title="Course Gradebook"
        description="Consolidated continuous assessment, exam scores, letter grades, and publication status."
        action={
          <Link href="/dashboard/academic" className="button-secondary">
            Back to Academic CMS
          </Link>
        }
      />

      <section className="panel p-6">
        {!entries || entries.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No gradebook entries recorded yet. Grades appear here once submissions are marked.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-2 pr-4">Course</th>
                  <th className="py-2 pr-4">Student ID</th>
                  <th className="py-2 pr-4">CA</th>
                  <th className="py-2 pr-4">Exam</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Grade</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={String(row.id)} className="border-b border-black/5">
                    <td className="py-3 pr-4 font-semibold">{courseMap.get(String(row.course_id)) ?? "Course"}</td>
                    <td className="py-3 pr-4">{String(row.student_id).slice(0, 8)}</td>
                    <td className="py-3 pr-4">{String(row.ca_score)}</td>
                    <td className="py-3 pr-4">{String(row.exam_score)}</td>
                    <td className="py-3 pr-4 font-bold">{String(row.total_score)}</td>
                    <td className="py-3 pr-4 font-bold text-[#ff6b2b]">{String(row.letter_grade ?? "—")}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold">
                        {String(row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
