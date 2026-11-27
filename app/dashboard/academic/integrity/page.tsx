import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { PageHeading } from "@/components/ui/workspace";

export default async function IntegrityPage() {
  const membership = await requireBusinessMembership();
  const db = createJoinSupabaseClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: unknown) => {
          order: (col2: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }>;
        };
      };
    };
  };

  const [{ data: matches }, { data: aiRisks }] = await Promise.all([
    db
      .from("similarity_matches")
      .select("id,assignment_id,submission_a_id,submission_b_id,similarity_score,explanation,review_status,created_at")
      .eq("organization_id", membership.businessId)
      .order("created_at", { ascending: false }),
    db
      .from("ai_risk_assessments")
      .select("id,submission_id,risk_category,indicators,limitations_note,review_status,created_at")
      .eq("organization_id", membership.businessId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="space-y-8">
      <PageHeading
        eyebrow="ACADEMIC INTEGRITY"
        title="Similarity & AI-Writing Risk Review"
        description="Evidence-based similarity comparisons and probabilistic AI-writing indicators for lecturer review."
        action={
          <Link href="/dashboard/academic" className="button-secondary">
            Back to Academic CMS
          </Link>
        }
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-bold">
          <ShieldAlert size={16} aria-hidden="true" />
          Human Review Required
        </div>
        <p className="mt-1">
          Similarity scores and AI-writing indicators are investigative signals only—never automatic proof of
          misconduct. Always inspect original submissions and allow student explanation.
        </p>
      </div>

      <section className="panel p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#111318]">Student-to-Student Similarity Matches</h2>
        {!matches || matches.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No similarity matches flagged yet. Run a similarity scan from any assignment review page.
          </p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <article key={String(m.id)} className="rounded-xl border border-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-[#111318]">
                    Similarity: {String(m.similarity_score)}%
                  </strong>
                  <span className="rounded-full bg-neutral-100 px-3 py-0.5 text-xs font-bold">
                    {String(m.review_status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-700">{String(m.explanation ?? "")}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#111318]">AI-Writing Risk Indicators (Separate Signal)</h2>
        {!aiRisks || aiRisks.length === 0 ? (
          <p className="text-sm text-neutral-600">No AI-writing risk assessments recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {aiRisks.map((r) => (
              <article key={String(r.id)} className="rounded-xl border border-black/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-[#111318]">
                    Submission {String(r.submission_id).slice(0, 8)} · Risk: {String(r.risk_category)}
                  </strong>
                  <span className="rounded-full bg-neutral-100 px-3 py-0.5 text-xs font-bold">
                    {String(r.review_status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{String(r.limitations_note)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
