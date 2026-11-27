import { notFound } from "next/navigation";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { verifyAssignmentGuestToken } from "@/lib/academic/distribution";
import { GuestSubmissionPortal } from "@/components/academic/guest-submission-portal";

export const dynamic = "force-dynamic";

export default async function GuestAssignmentSubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ref?: string; payment?: string }>;
}) {
  const { token } = await params;
  const { ref, payment } = await searchParams;

  let parsedToken: ReturnType<typeof verifyAssignmentGuestToken>;
  try {
    parsedToken = verifyAssignmentGuestToken(decodeURIComponent(token));
  } catch {
    notFound();
  }

  const db = createJoinSupabaseClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: unknown) => {
          eq?: (col2: string, val2: unknown) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          order: (c3: string, opts: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null }>;
        };
      };
    };
  };

  const [{ data: assignment }, { data: org }, { data: qRows }] = await Promise.all([
    db
      .from("assignments")
      .select("id,course_id,manual_course_code,manual_course_name,title,due_at,status")
      .eq("id", parsedToken.assignmentId)
      .maybeSingle(),
    db.from("businesses").select("name").eq("id", parsedToken.orgId).maybeSingle(),
    db
      .from("assignment_questions")
      .select("id,position,question_type,prompt,options,marks")
      .eq("assignment_id", parsedToken.assignmentId)
      .order("position", { ascending: true }),
  ]);

  if (!assignment || assignment.status !== "PUBLISHED") notFound();

  const { data: course } = assignment.course_id
    ? await db
        .from("courses")
        .select("code")
        .eq("id", String(assignment.course_id))
        .maybeSingle()
    : { data: null };

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-4">
        {payment === "verified" ? (
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            Payment confirmed! Verify your matriculation number below to complete your submission.
          </p>
        ) : null}
        <GuestSubmissionPortal
          token={decodeURIComponent(token)}
          assignmentTitle={String(assignment.title)}
          courseCode={String(course?.code ?? assignment.manual_course_code ?? assignment.manual_course_name ?? "COURSE")}
          organizationName={String(org?.name ?? "Institution")}
          dueAt={assignment.due_at ? String(assignment.due_at) : null}
          questions={(qRows ?? []).map((q) => ({
            id: String(q.id),
            position: Number(q.position),
            questionType: String(q.question_type),
            prompt: String(q.prompt),
            options: Array.isArray(q.options) ? q.options.map(String) : [],
            marks: Number(q.marks ?? 0),
          }))}
          referralCode={ref}
        />
      </div>
    </main>
  );
}
