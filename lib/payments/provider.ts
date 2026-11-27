import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { billingConfigured as paystackConfigured, getPaidPlan, paystack } from "@/lib/paystack/server";
import { createStripeBillingPortalSession, createStripeCheckoutSession, stripeConfigured } from "@/lib/stripe/server";
import { getCatalogPlans } from "@/lib/pricing/plans";
import type { Plan } from "@/lib/paystack/plans";

export type PaymentProvider = "paystack" | "stripe";

const hostedPaystackUrl = z.url().refine((v) => {
  const u = new URL(v);
  return u.protocol === "https:" && !u.username && !u.password && (u.hostname === "checkout.paystack.com" || u.hostname === "paystack.com" || u.hostname.endsWith(".paystack.com"));
});

const hostedStripeUrl = z.url().refine((v) => {
  const u = new URL(v);
  return u.protocol === "https:" && !u.username && !u.password && (u.hostname === "checkout.stripe.com" || u.hostname === "billing.stripe.com");
});

export function getDefaultPaymentProvider(): PaymentProvider {
  return process.env.PAYMENT_DEFAULT_PROVIDER === "stripe" ? "stripe" : "paystack";
}

export function getAvailablePaymentProviders(): { paystack: boolean; stripe: boolean } {
  return {
    paystack: paystackConfigured(),
    stripe: stripeConfigured(),
  };
}

export async function startProviderCheckout(input: {
  provider: PaymentProvider;
  businessId: string;
  plan: Plan;
  email: string;
  currency?: string;
}): Promise<{ url: string }> {
  const reference = randomUUID();
  const db = createJoinSupabaseClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (input.provider === "stripe") {
    const catalog = await getCatalogPlans();
    const planEntry = catalog.find((p) => p.code === input.plan);
    if (!planEntry) throw new Error("Selected plan is unavailable.");

    const priceEntry =
      planEntry.prices.find((p) => p.provider === "stripe" && p.currency === (input.currency ?? "USD")) ??
      planEntry.prices.find((p) => p.currency === (input.currency ?? "USD")) ??
      planEntry.prices[0];

    if (!priceEntry || priceEntry.amountMinor <= 0) {
      throw new Error("Stripe pricing is not configured for this plan.");
    }

    const { error } = await (
      db.from("billing_checkouts") as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
      }
    ).insert({
      reference,
      business_id: input.businessId,
      plan: input.plan,
      provider: "stripe",
      provider_plan_code: priceEntry.providerPriceCode ?? `stripe_${input.plan.toLowerCase()}`,
      amount: priceEntry.amountMinor,
      currency: priceEntry.currency,
    });
    if (error) throw new Error("Could not initialize billing checkout.");

    const session = await createStripeCheckoutSession({
      businessId: input.businessId,
      planCode: input.plan,
      planName: planEntry.name,
      email: input.email,
      amountMinor: priceEntry.amountMinor,
      currency: priceEntry.currency,
      reference,
      successUrl: `${appUrl}/dashboard/billing?payment=verified`,
      cancelUrl: `${appUrl}/dashboard/billing?payment=cancelled`,
      providerPriceCode: priceEntry.providerPriceCode,
    });

    return { url: hostedStripeUrl.parse(session.url) };
  }

  // Default: Paystack
  if (input.plan !== "STARTER" && input.plan !== "BUSINESS") {
    throw new Error("Paystack checkout currently supports Starter and Business plans.");
  }

  const details = await getPaidPlan(input.plan);
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
    throw new Error("Subscription management will be available after the provider confirms your subscription.");
  }

  const sub = data as unknown as {
    provider?: string;
    provider_customer_code: string | null;
    provider_subscription_code: string | null;
  };

  if (sub.provider === "stripe") {
    if (!sub.provider_customer_code) {
      throw new Error("Stripe customer record is pending.");
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const portal = await createStripeBillingPortalSession({
      customerId: sub.provider_customer_code,
      returnUrl: `${appUrl}/dashboard/billing`,
    });
    return { url: hostedStripeUrl.parse(portal.url) };
  }

  if (!sub.provider_subscription_code) {
    throw new Error("Subscription management will be available after the provider confirms your subscription.");
  }
  const result = z
    .object({ link: hostedPaystackUrl })
    .parse(await paystack("/subscription/" + encodeURIComponent(sub.provider_subscription_code) + "/manage/link"));
  return { url: result.link };
}
