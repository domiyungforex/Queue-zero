import "server-only";
import { z } from "zod";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

async function stripeRequest<T>(
  path: string,
  params?: URLSearchParams,
  schema?: z.ZodType<T>,
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe billing is not configured.");

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? params.toString() : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  const json: unknown = await response.json();
  if (!response.ok) {
    throw new Error("Stripe payment provider unavailable.");
  }
  return schema ? schema.parse(json) : (json as T);
}

const checkoutSessionSchema = z.object({
  id: z.string(),
  url: z.url().nullable(),
});

export async function createStripeCheckoutSession(input: {
  businessId: string;
  planCode: string;
  planName: string;
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  successUrl: string;
  cancelUrl: string;
  providerPriceCode?: string | null;
}): Promise<{ id: string; url: string }> {
  const params = new URLSearchParams();
  params.set("mode", input.providerPriceCode ? "subscription" : "payment");
  params.set("customer_email", input.email);
  params.set("client_reference_id", input.reference);
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("metadata[reference]", input.reference);
  params.set("metadata[business_id]", input.businessId);
  params.set("metadata[plan]", input.planCode);

  if (input.providerPriceCode) {
    params.set("line_items[0][price]", input.providerPriceCode);
    params.set("line_items[0][quantity]", "1");
  } else {
    params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(input.amountMinor));
    params.set("line_items[0][price_data][product_data][name]", `TuRnMaRk ${input.planName} Plan`);
    params.set("line_items[0][quantity]", "1");
  }

  const session = await stripeRequest("/checkout/sessions", params, checkoutSessionSchema);
  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return { id: session.id, url: session.url };
}

const portalSessionSchema = z.object({
  url: z.url(),
});

export async function createStripeBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const params = new URLSearchParams();
  params.set("customer", input.customerId);
  params.set("return_url", input.returnUrl);

  return stripeRequest("/billing_portal/sessions", params, portalSessionSchema);
}
