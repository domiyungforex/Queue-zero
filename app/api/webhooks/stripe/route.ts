import { NextResponse } from "next/server";
import { z } from "zod";
import { readLimitedBody, RequestBodyTooLarge } from "@/lib/security/request-body";
import { verifyStripeSignature } from "@/lib/stripe/webhook";
import { createJoinSupabaseClient } from "@/lib/db/join-server";

const stripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  let raw: string;
  try {
    raw = await readLimitedBody(request, 262144);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RequestBodyTooLarge ? "Too large" : "Invalid body" },
      { status: error instanceof RequestBodyTooLarge ? 413 : 400 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 401 });
  }

  try {
    const event = stripeEventSchema.parse(JSON.parse(raw));
    const obj = event.data.object;
    const db = createJoinSupabaseClient();

    if (event.type === "checkout.session.completed") {
      const metadata = (obj.metadata ?? {}) as Record<string, unknown>;
      const reference = typeof metadata.reference === "string" ? metadata.reference : obj.client_reference_id;
      if (typeof reference === "string" && z.uuid().safeParse(reference).success) {
        const customerId = typeof obj.customer === "string" ? obj.customer : "stripe_customer";
        const subscriptionId = typeof obj.subscription === "string" ? obj.subscription : "";
        const paidAt = new Date();
        const periodEnd = new Date(paidAt);
        periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

        const { error } = await db.rpc("confirm_checkout", {
          p_reference: reference,
          p_event_id: `stripe:${event.id}`,
          p_customer_code: customerId,
          p_subscription_code: subscriptionId,
          p_paid_at: paidAt.toISOString(),
          p_period_end: periodEnd.toISOString(),
        });
        if (error) throw new Error("Failed to confirm Stripe checkout");
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "invoice.payment_failed"
    ) {
      const subId = typeof obj.id === "string" ? obj.id : typeof obj.subscription === "string" ? obj.subscription : "";
      const customerId = typeof obj.customer === "string" ? obj.customer : "";
      const rawStatus = typeof obj.status === "string" ? obj.status : "";
      const mappedStatus: "active" | "past_due" | "cancelled" =
        event.type === "customer.subscription.deleted"
          ? "cancelled"
          : rawStatus === "active" || rawStatus === "trialing"
            ? "active"
            : rawStatus === "past_due" || event.type === "invoice.payment_failed"
              ? "past_due"
              : "cancelled";

      if (subId && customerId) {
        const periodEndSec = typeof obj.current_period_end === "number" ? obj.current_period_end : Math.floor(Date.now() / 1000) + 86400 * 30;
        const { error } = await db.rpc("sync_subscription_event", {
          p_event_id: `stripe:${event.id}`,
          p_event_type: event.type,
          p_customer_code: customerId,
          p_subscription_code: subId,
          p_plan_code: "",
          p_status: mappedStatus,
          p_event_at: new Date().toISOString(),
          p_period_end: new Date(periodEndSec * 1000).toISOString(),
        });
        if (error) {
          // Log and acknowledge if mapping is not yet established
          console.error("Stripe subscription sync error", error);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Processing unavailable. Retry delivery." }, { status: 503 });
  }
}
