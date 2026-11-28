import Link from "next/link";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { EmptyState, PageHeading } from "@/components/ui/workspace";
import { Breadcrumbs } from "@/components/ui/flow";

export default async function QuestionBankPage() {
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

  const { data: items } = await db
    .from("question_bank_items")
    .select("id,title,prompt,subject,topic,difficulty,question_type,marks,created_at")
    .eq("organization_id", membership.businessId)
    .order("created_at", { ascending: false });

  return (
    <main className="space-y-6">
      <Breadcrumbs items={[{ label: "Academic", href: "/dashboard/academic" }, { label: "Question Bank" }]} />
      <PageHeading
        eyebrow="QUESTION BANK"
        title="Reusable Question Bank"
        description="Store and reuse verified questions across assignments, tests, and examinations."
        action={
          <Link href="/dashboard/academic" className="button-secondary">
            Back to Academic CMS
          </Link>
        }
      />

      <section className="panel p-6">
        {!items || items.length === 0 ? (
          <EmptyState
            title="No questions in the bank yet"
            description="Questions created in assignments can be saved here for reuse."
            href="/dashboard/academic/assignments/new"
            label="Create Assignment"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <article key={String(item.id)} className="rounded-xl border border-black/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#fff0e8] px-2.5 py-0.5 text-xs font-bold text-[#d94b14]">
                    {String(item.question_type)} · {String(item.difficulty)}
                  </span>
                  <span className="text-xs font-semibold text-neutral-600">{String(item.marks)} marks</span>
                </div>
                <h2 className="mt-2 font-bold text-[#111318]">{String(item.title)}</h2>
                <p className="mt-1 text-sm text-neutral-600">{String(item.prompt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
