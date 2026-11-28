"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { startCheckout, manageSubscription } from "@/app/dashboard/billing/actions";
import { PLAN_LIMITS, PLAN_DESCRIPTIONS, type Plan } from "@/lib/paystack/plans";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { CatalogPlan } from "@/lib/pricing/plans";

export function Plans({
  current,
  prices,
  configured,
  publicPage = false,
  catalog,
  highlightedPlan,
  planAvailability,
}: {
  current: Plan;
  prices: Partial<Record<Plan, string>>;
  configured: boolean;
  publicPage?: boolean;
  catalog?: CatalogPlan[];
  /** Plan carried over from the marketing pricing page (?plan=). */
  highlightedPlan?: Plan;
  /** Per-plan Paystack checkout availability, from server env configuration. */
  planAvailability?: Partial<Record<Plan, { monthly: boolean; annual: boolean }>>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  const displayPlans: Plan[] = catalog?.length
    ? (catalog.map((c) => c.code).filter((c) => c !== "BUSINESS") as Plan[])
    : // Ascending monthly price order (matches plans.sort_order in the catalog).
      ["FREE", "STARTER", "EVENTS", "GROWTH", "EDUCATION", "PROFESSIONAL", "ENTERPRISE"];

  async function upgrade(plan: Plan) {
    if (publicPage) {
      // Carry the chosen plan into sign-up so the selection is not lost.
      router.push(plan === "ENTERPRISE" ? "/contact" : `/sign-up?plan=${plan.toLowerCase()}`);
      return;
    }
    if (plan === "ENTERPRISE") {
      router.push("/contact");
      return;
    }
    setBusy(plan);
    setError("");
    try {
      const r = await startCheckout(plan, interval);
      if (r.url) {
        captureAnalytics(ANALYTICS_EVENTS.checkoutStarted, { plan_tier: plan });
        location.assign(r.url);
      } else {
        setError(r.error ?? "Checkout unavailable.");
      }
    } catch {
      setError("Connection interrupted. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function manage() {
    setBusy("manage");
    setError("");
    try {
      const r = await manageSubscription();
      if (r.url) location.assign(r.url);
      else setError(r.error ?? "Subscription unavailable.");
    } catch {
      setError("Subscription management is unavailable.");
    } finally {
      setBusy("");
    }
  }

  function formatCatalogPrice(plan: Plan): string {
    if (plan === "FREE") return "Free";
    if (plan === "ENTERPRISE") return "Custom quote";
    const entry = catalog?.find((c) => c.code === plan);
    if (entry) {
      const priceRow =
        entry.prices.find((p) => p.provider === "paystack" && p.interval === interval) ??
        entry.prices.find((p) => p.provider === "paystack") ??
        entry.prices[0];
      if (priceRow && priceRow.amountMinor > 0) {
        const major = interval === "annual" && priceRow.interval === "monthly"
          ? Math.round((priceRow.amountMinor / 100) * 12 * 0.85)
          : Math.round(priceRow.amountMinor / 100);
        return new Intl.NumberFormat("en", {
          style: "currency",
          currency: priceRow.currency,
          maximumFractionDigits: 0,
        }).format(major);
      }
    }
    return prices[plan] ?? "Coming soon";
  }


  return (
    <>
      {error ? (
        <p className="notice warning" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Billing interval"
          className="inline-flex rounded-xl border border-black/10 bg-white p-1"
        >
          <button
            type="button"
            aria-pressed={interval === "monthly"}
            onClick={() => setInterval("monthly")}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${
              interval === "monthly"
                ? "bg-[#ff6b2b] text-white shadow-[0_8px_20px_rgba(255,107,43,0.35)]"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={interval === "annual"}
            onClick={() => setInterval("annual")}
            className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${
              interval === "annual"
                ? "bg-[#ff6b2b] text-white shadow-[0_8px_20px_rgba(255,107,43,0.35)]"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Annual (Save 15%)
          </button>
        </div>

      </div>

      <div className="billing-plans">
        {displayPlans.map((plan) => {
          const catalogEntry = catalog?.find((c) => c.code === plan);
          const limits = PLAN_LIMITS[plan];
          const priceLabel = formatCatalogPrice(plan);
          const isCurrent = !publicPage && current === plan;
          const checkoutAvailable =
            publicPage || (configured && (planAvailability ? (planAvailability[plan]?.[interval] ?? false) : true));
          const isHighlighted = highlightedPlan === plan && !isCurrent;
          const isFeatured = isHighlighted || (catalogEntry?.isFeatured ?? plan === "STARTER");

          return (
            <article key={plan} className={`panel billing-plan ${isFeatured ? "featured" : ""}`}>
              <div className="plan-top">
                <h2>{catalogEntry?.name ?? plan[0] + plan.slice(1).toLowerCase()}</h2>
                {isCurrent ? <span>YOUR PLAN</span> : isHighlighted ? <span>SELECTED</span> : isFeatured ? <span>RECOMMENDED</span> : null}
              </div>
              <p>{catalogEntry?.description ?? PLAN_DESCRIPTIONS[plan]}</p>
              <div className="plan-price">
                {priceLabel}
                {plan !== "FREE" && plan !== "ENTERPRISE" && priceLabel !== "Coming soon" ? (
                  <small>{interval === "annual" ? "/ year, billed annually" : "/ month"}</small>
                ) : null}
              </div>
              <ul>
                <li>
                  <Check size={16} aria-hidden="true" />
                  {limits.queues === null
                    ? "Unlimited queues"
                    : `${limits.queues} active ${limits.queues === 1 ? "queue" : "queues"}`}
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  {limits.locations === null
                    ? "Unlimited locations"
                    : `${limits.locations} ${limits.locations === 1 ? "location" : "locations"}`}
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  {limits.staff === null ? "Unlimited team members" : `${limits.staff} team members`}
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  QR joining &amp; live tickets
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  {plan === "FREE" ? "Core queue console" : "Bookings, attendance & analytics"}
                </li>
              </ul>

              {plan === "FREE" ? (
                <a className="button-secondary" href={publicPage ? "/sign-up?plan=free" : "/dashboard"}>
                  {publicPage ? "Get started" : "Open workspace"}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              ) : plan === "ENTERPRISE" ? (
                <a className="button-secondary" href="/contact">
                  Contact sales
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              ) : (
                <button
                  type="button"
                  className={isFeatured ? "button-primary" : "button-secondary"}
                  disabled={!!busy || isCurrent || (!publicPage && !checkoutAvailable)}
                  onClick={() => void upgrade(plan)}
                >
                  {busy === plan
                    ? "Opening checkout…"
                    : isCurrent
                      ? "Current plan"
                      : !publicPage && !checkoutAvailable
                        ? "Not yet available"
                        : `Choose ${(catalogEntry?.name ?? plan).toLowerCase()}`}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              )}
            </article>
          );
        })}
      </div>

      {/* Internal payment-verification detail belongs on the dashboard
          billing view, not the public pricing page. */}
      {!publicPage ? (
        <p className="billing-security">
          <ShieldCheck size={17} aria-hidden="true" />
          Payments are verified server-side via Paystack webhooks. Your subscription updates only after
          cryptographic confirmation.
        </p>
      ) : null}

      {!publicPage && current !== "FREE" ? (
        <button type="button" className="button-secondary" disabled={!!busy} onClick={() => void manage()}>
          {busy === "manage" ? "Opening…" : "Manage or cancel subscription"}
          <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}
