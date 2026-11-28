import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { getPaidPlan, paystack, type PaystackPlanCode } from "@/lib/paystack/server";
import type { Plan } from "@/lib/paystack/plans";

// Turnmark bills exclusively through Paystack (product decision, 2026-11-28).
// The earlier dual-provider Stripe path was removed so there is exactly one
// wired checkout, verification and webhook flow to maintain.
export type PaymentProvider = "paystack";

const hostedPaystackUrl = z.url().refine((v) => {
  const u = new URL(v);
  return u.protocol === "https:" && !u.username && !u.password && (u.hostname === "checkout.paystack.com" || u.hostname === "paystack.com" || u.hostname.endsWith(".paystack.com"));
});

export function getDefaultPaymentProvider(): PaymentProvider {
  return "paystack";
}

export async function startProviderCheckout(input: {
  businessId: string;
  plan: Plan;
  email: string;
  interval?: "monthly" | "annual";
}): Promise<{ url: string }> {
  if (input.plan === "FREE" || input.plan === "ENTERPRISE") {
    throw new Error("This plan does not use checkout.");
  }
  const plan = input.plan as PaystackPlanCode;
  const interval = input.interval ?? "monthly";
  const reference = randomUUID();
  const db = createJoinSupabaseClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // The amount/currency are read back from Paystack's own plan record, so a
  // mispriced or swapped plan code fails here instead of charging wrongly.
  const details = await getPaidPlan(plan, interval);
  const { error } = await (
    db.from("billing_checkouts") as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
    }
  ).insert({
    reference,
    business_id: input.businessId,
    plan: input.plan,
    provider: "paystack",
    provider_plan_code: details.plan_code,
    amount: details.amount,
    currency: details.currency,
  });
  if (error) throw new Error("Could not initialize Paystack checkout.");

  const result = z
    .object({ authorization_url: hostedPaystackUrl })
    .parse(
      await paystack("/transaction/initialize", {
        email: input.email,
        amount: details.amount,
        currency: details.currency,
        plan: details.plan_code,
        reference,
        callback_url: new URL("/api/billing/verify", appUrl).href,
        metadata: { reference },
      }),
    );

  return { url: result.authorization_url };
}

export async function openProviderPortal(businessId: string): Promise<{ url: string }> {
  const db = createJoinSupabaseClient();
  const { data } = await db
    .from("subscriptions")
    .select("provider,provider_customer_code,provider_subscription_code")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!data) {
    throw new Error("Subscription management will be available after Paystack confirms your subscription.");
  }

  const sub = data as unknown as {
    provider?: string;
    provider_customer_code: string | null;
    provider_subscription_code: string | null;
  };

  if (!sub.provider_subscription_code) {
    throw new Error("Subscription management will be available after Paystack confirms your subscription.");
  }
  const result = z
    .object({ link: hostedPaystackUrl })
    .parse(await paystack("/subscription/" + encodeURIComponent(sub.provider_subscription_code) + "/manage/link"));
  return { url: result.link };
}
