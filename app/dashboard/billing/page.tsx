import { getBusinessDetails } from "@/lib/dashboard/data";
import { PageHeading } from "@/components/ui/workspace";
import { Plans } from "@/components/billing/plans";
import { billingConfigured, getPaidPlan, paystackPlanConfigured, type PaystackPlanCode } from "@/lib/paystack/server";
import { BillingViewedAnalytics } from "@/components/analytics/billing-viewed";
import { getCatalogPlans, getOrganizationEntitlements } from "@/lib/pricing/plans";
import { createUserSupabaseClient } from "@/lib/db/server";
import { requireBusinessMembership } from "@/lib/business/membership";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; plan?: string }>;
}) {
  const membership = await requireBusinessMembership();
  const [business, catalog, entitlements, db] = await Promise.all([
    getBusinessDetails(),
    getCatalogPlans(),
    getOrganizationEntitlements(membership.businessId),
    createUserSupabaseClient(),
  ]);

  const [{ count: queueCount }, { count: locationCount }, { count: staffCount }, { data: checkouts }, { data: subscription }] =
    await Promise.all([
      db.from("queues").select("id", { count: "exact", head: true }).eq("business_id", membership.businessId),
      db.from("locations").select("id", { count: "exact", head: true }).eq("business_id", membership.businessId),
      db.from("business_members").select("id", { count: "exact", head: true }).eq("business_id", membership.businessId),
      db
        .from("billing_checkouts")
        .select("reference,plan,amount,currency,status,created_at")
        .eq("business_id", membership.businessId)
        .order("created_at", { ascending: false })
        .limit(8),
      db
        .from("subscriptions")
        .select("plan,status,current_period_end")
        .eq("business_id", membership.businessId)
        .maybeSingle(),
    ]);

  const prices: Record<string, string> = {};
  const configured = billingConfigured();
  const paidPlans = ["STARTER", "GROWTH", "PROFESSIONAL", "EDUCATION", "EVENTS"] as const;
  const planAvailability: Partial<Record<string, { monthly: boolean; annual: boolean }>> = {};
  if (configured) {
    for (const p of paidPlans) {
      planAvailability[p] = {
        monthly: paystackPlanConfigured(p as PaystackPlanCode, "monthly"),
        annual: paystackPlanConfigured(p as PaystackPlanCode, "annual"),
      };
      if (planAvailability[p].monthly) {
        try {
          const v = await getPaidPlan(p as PaystackPlanCode);
          prices[p] = new Intl.NumberFormat("en", {
            style: "currency",
            currency: v.currency,
            maximumFractionDigits: 0,
          }).format(v.amount / 100);
        } catch {
          planAvailability[p].monthly = false;
        }
      }
    }
  }

  const params = await searchParams;
  const status = params.payment;
  const requestedPlan = paidPlans.includes(params.plan?.toUpperCase() as (typeof paidPlans)[number])
    ? (params.plan!.toUpperCase() as (typeof paidPlans)[number])
    : undefined;
  const subStatus = (subscription as { status?: string; current_period_end?: string | null } | null) ?? null;
  const statusLabel =
    subStatus?.status === "active"
      ? "Active"
      : subStatus?.status === "past_due"
        ? "Past due"
        : subStatus?.status === "cancelled"
          ? "Cancelled"
          : subStatus?.status === "expired"
            ? "Expired"
            : null;

  return (
    <>
      <BillingViewedAnalytics />
      <PageHeading
        eyebrow="BILLING & PLANS"
        title="A little more room to grow."
        description="Choose the capacity your organization needs, track current usage, and review payment history."
      />

      {status ? (
        <p className="notice" role="status">
          {status === "verified"
            ? "Payment verified. Your plan has been updated."
            : status === "cancelled"
              ? "Checkout was cancelled. Your current plan has not changed."
              : "Payment is not confirmed yet. Your plan will update after secure provider verification."}
        </p>
      ) : null}

      {requestedPlan && business.subscription_tier !== requestedPlan ? (
        <p className="notice" role="status">
          You selected the {requestedPlan[0] + requestedPlan.slice(1).toLowerCase()} plan on the pricing page.
          Complete checkout below to activate it.
        </p>
      ) : null}

      <section className="panel mb-8 flex flex-wrap items-center justify-between gap-4 p-6" aria-label="Current plan">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Current plan</p>
          <p className="mt-1 text-2xl font-bold text-[#111318]">
            {business.subscription_tier[0] + business.subscription_tier.slice(1).toLowerCase()}
            {statusLabel ? (
              <span className="ml-3 align-middle inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold">
                {statusLabel}
              </span>
            ) : null}
          </p>
          {subStatus?.current_period_end ? (
            <p className="mt-1 text-sm text-neutral-500">
              {subStatus.status === "active" ? "Renews" : "Current period ends"}{" "}
              {new Date(subStatus.current_period_end).toLocaleDateString()}
            </p>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">No paid subscription yet.</p>
          )}
        </div>
        {subStatus?.status === "past_due" ? (
          <p className="notice warning" role="alert">
            Your last payment failed. Update your payment method via “Manage or cancel subscription” below to keep
            your plan active.
          </p>
        ) : null}
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-3" aria-label="Plan usage summary">
        <div className="panel p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Active Queues</p>
          <p className="mt-2 text-2xl font-bold text-[#111318]">
            {queueCount ?? 0}
            <span className="ml-1 text-sm font-medium text-neutral-500">
              / {entitlements.limits.max_queues === null ? "Unlimited" : entitlements.limits.max_queues}
            </span>
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Locations</p>
          <p className="mt-2 text-2xl font-bold text-[#111318]">
            {locationCount ?? 0}
            <span className="ml-1 text-sm font-medium text-neutral-500">
              / {entitlements.limits.max_locations === null ? "Unlimited" : entitlements.limits.max_locations}
            </span>
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Team Members</p>
          <p className="mt-2 text-2xl font-bold text-[#111318]">
            {staffCount ?? 0}
            <span className="ml-1 text-sm font-medium text-neutral-500">
              / {entitlements.limits.max_staff === null ? "Unlimited" : entitlements.limits.max_staff}
            </span>
          </p>
        </div>
      </section>

      <Plans
        current={business.subscription_tier}
        prices={prices}
        configured={configured}
        catalog={catalog}
        highlightedPlan={requestedPlan}
        planAvailability={planAvailability as never}
      />

      <section className="panel mt-10 p-6" aria-labelledby="billing-history-title">
        <h2 id="billing-history-title" className="text-lg font-bold text-[#111318]">
          Billing History
        </h2>
        {checkouts && checkouts.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {checkouts.map((c) => (
                  <tr key={c.reference} className="border-b border-black/5">
                    <td className="py-3 pr-4">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 font-semibold">{c.plan}</td>
                    <td className="py-3 pr-4">
                      {new Intl.NumberFormat("en", {
                        style: "currency",
                        currency: c.currency,
                        maximumFractionDigits: 0,
                      }).format(c.amount / 100)}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold capitalize">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            No payments yet. When you upgrade, your Paystack payments and their status will appear here.
          </p>
        )}
      </section>
    </>
  );
}
