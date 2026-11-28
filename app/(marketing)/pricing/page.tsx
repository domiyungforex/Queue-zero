import { pageMetadata } from "@/lib/site/metadata";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { MarketingFrame } from "@/components/marketing/site";
import styles from "@/components/marketing/site.module.css";
import { Plans } from "@/components/billing/plans";
import { billingConfigured, getPaidPlan } from "@/lib/paystack/server";
import { getCatalogPlans } from "@/lib/pricing/plans";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata(
  "Queue management plans and pricing",
  "Compare TuRnMaRk queue capacity and plans. Start with free queues and upgrade using secure billing when your organization grows.",
  "/pricing",
);

export default async function PricingPage() {
  const catalog = await getCatalogPlans();

  const prices: Record<string, string> = {};
  const configured = billingConfigured();
  if (configured) {
    for (const p of ["STARTER", "GROWTH", "PROFESSIONAL", "EDUCATION", "EVENTS"] as const) {
      try {
        const v = await getPaidPlan(p);
        prices[p] = new Intl.NumberFormat("en", {
          style: "currency",
          currency: v.currency,
          maximumFractionDigits: 0,
        }).format(v.amount / 100);
      } catch {
        // Plan not configured in Paystack yet; the catalog price is shown instead.
      }
    }
  }

  return (
    <MarketingFrame>
      <main id="main" className={styles.subpage}>
        <Breadcrumbs label="Plans" path="/pricing" />
        <p className={styles.eyebrow}>ROOM TO GROW</p>
        <h1>
          Better waiting.
          <br />
          <em>At your own pace.</em>
        </h1>
        <p className={styles.subpageLead}>
          Start free, then scale queues, locations, bookings, and team capacity as your organization grows. No app
          downloads for your customers.
        </p>
        <Plans
          current="FREE"
          prices={prices}
          configured={configured}
          catalog={catalog}
          publicPage
        />
      </main>
    </MarketingFrame>
  );
}
