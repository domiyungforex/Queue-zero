import { getBusinessDetails } from "@/lib/dashboard/data";
export default async function BillingPage() {
  const business = await getBusinessDetails();
  return <><h1 className="text-3xl font-semibold">Billing</h1><div className="mt-8 rounded-2xl border border-black/10 bg-white p-8"><p className="text-sm text-muted">Current plan</p><p className="mt-2 text-3xl font-semibold">{business.subscription_tier}</p><p className="mt-5 text-muted">Subscription management is coming soon.</p></div></>;
}
