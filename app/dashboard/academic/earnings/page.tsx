import Link from "next/link";
import { requireBusinessMembership } from "@/lib/business/membership";
import { requireUserId } from "@/lib/auth/server";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { PageHeading, StatCard } from "@/components/ui/workspace";
import { formatNgnFromMinor } from "@/lib/academic/allowance-ledger";

export default async function LecturerEarningsPage() {
  const membership = await requireBusinessMembership();
  const userId = await requireUserId();
  const db = createJoinSupabaseClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: unknown) => {
          eq: (col2: string, val2: unknown) => {
            order: (c3: string, opts: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null }>;
          };
        };
      };
    };
  };

  const { data: entries } = await db
    .from("financial_ledger")
    .select("id,assignment_id,payment_reference,transaction_type,amount_minor,currency,status,created_at")
    .eq("organization_id", membership.businessId)
    .eq("beneficiary_user_id", userId)
    .order("created_at", { ascending: false });

  const rows = entries ?? [];
  const totalEarnedMinor = rows
    .filter((r) => r.transaction_type === "LECTURER_COMMISSION" && r.status === "CONFIRMED")
    .reduce((sum, r) => sum + Number(r.amount_minor ?? 0), 0);
  const withdrawnMinor = rows
    .filter((r) => r.transaction_type === "WITHDRAWAL" && r.status === "CONFIRMED")
    .reduce((sum, r) => sum + Number(r.amount_minor ?? 0), 0);
  const availableMinor = Math.max(0, totalEarnedMinor - withdrawnMinor);

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow="LECTURER EARNINGS"
        title="Submission Revenue & Ledger"
        description="Track paid assignment submissions, immutable commission allocations, and withdrawal balance."
        action={
          <Link href="/dashboard/academic" className="button-secondary">
            Back to Academic CMS
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Earned" value={formatNgnFromMinor(totalEarnedMinor)} />
        <StatCard label="Available Balance" value={formatNgnFromMinor(availableMinor)} />
        <StatCard label="Withdrawn" value={formatNgnFromMinor(withdrawnMinor)} />
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-bold text-[#111318]">Immutable Financial Ledger</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">
            No paid submission earnings recorded yet. Earnings appear here once students complete paid submissions.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} className="border-b border-black/5">
                    <td className="py-3 pr-4">{new Date(String(r.created_at)).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 font-semibold">{String(r.transaction_type).replaceAll("_", " ")}</td>
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
