import Link from "next/link";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { EmptyState, PageHeading, StatCard } from "@/components/ui/workspace";
import { Breadcrumbs } from "@/components/ui/flow";
import { formatNgnFromMinor } from "@/lib/academic/allowance-ledger";

export default async function ReferralsDashboardPage() {
  const membership = await requireBusinessMembership();
  const userId = await requireUserId();
  const db = createJoinSupabaseClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: unknown) => {
          eq: (col2: string, val2: unknown) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
            order: (c3: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    };
  };

  const [{ data: codeRow }, { data: commissions }, { data: attributions }] = await Promise.all([
    db
      .from("referral_codes")
      .select("code,is_active")
      .eq("organization_id", membership.businessId)
      .eq("clerk_user_id", userId)
      .maybeSingle(),
    db
      .from("financial_ledger")
      .select("id,payment_reference,amount_minor,currency,status,created_at")
      .eq("organization_id", membership.businessId)
      .eq("beneficiary_user_id", userId)
      .order("created_at", { ascending: false }),
    db
      .from("referral_attributions")
      .select("student_id,attributed_at")
      .eq("organization_id", membership.businessId)
      .eq("referrer_user_id", userId)
      .order("attributed_at", { ascending: false }),
  ]);

  const refRows = (commissions ?? []).filter((c) => c.payment_reference);
  const totalCommissionMinor = refRows.reduce((s, r) => s + Number(r.amount_minor ?? 0), 0);

  return (
    <main className="space-y-6">
      <Breadcrumbs items={[{ label: "Academic", href: "/dashboard/academic" }, { label: "Referrals" }]} />
      <PageHeading
        eyebrow="REFERRAL PROGRAMME (10%)"
        title="Referral Commissions"
        description="Earn 10% commission on qualifying paid assignment submissions attributed to your referral code."
        action={
          <Link href="/dashboard/academic" className="button-secondary">
            Back to Academic CMS
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Referral Code" value={codeRow?.code ? String(codeRow.code) : "Not issued"} />
        <StatCard label="Attributed Students" value={attributions?.length ?? 0} />
        <StatCard label="Total Commission (10%)" value={formatNgnFromMinor(totalCommissionMinor)} />
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold text-[#111318]">Commission Ledger</h2>
        {refRows.length === 0 ? (
          <EmptyState
            title="No referral commissions yet"
            description="No referral commissions recorded yet. Append ?ref=YOUR_CODE to any assignment link."
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Payment Reference</th>
                  <th className="py-2 pr-4">Commission</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {refRows.map((r) => (
                  <tr key={String(r.id)} className="border-b border-black/5">
                    <td className="py-3 pr-4">{new Date(String(r.created_at)).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{String(r.payment_reference)}</td>
                    <td className="py-3 pr-4 font-bold text-[#ff6b2b]">
                      {formatNgnFromMinor(Number(r.amount_minor ?? 0), String(r.currency ?? "NGN"))}
                    </td>
                    <td className="py-3">{String(r.status)}</td>
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
