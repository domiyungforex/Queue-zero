"use server";

import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business/membership";
import {
  getDefaultPaymentProvider,
  openProviderPortal,
  startProviderCheckout,
  type PaymentProvider,
} from "@/lib/payments/provider";
import type { Plan } from "@/lib/paystack/plans";

export type CheckoutResult = { url?: string; error?: string };

const planSchema = z.enum(["STARTER", "GROWTH", "PROFESSIONAL", "EDUCATION", "EVENTS", "BUSINESS"]);
const providerSchema = z.enum(["paystack", "stripe"]);

export async function startCheckout(plan: unknown, provider?: unknown): Promise<CheckoutResult> {
  const m = await requireBusinessOwner();
  const parsedPlan = planSchema.safeParse(plan);
  if (!parsedPlan.success) return { error: "Choose a valid plan." };

  const parsedProvider = provider ? providerSchema.safeParse(provider) : null;
  const selectedProvider: PaymentProvider = parsedProvider?.success
    ? parsedProvider.data
    : getDefaultPaymentProvider();

  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email || user?.primaryEmailAddress?.verification?.status !== "verified") {
      return { error: "Add a verified email to your account before upgrading." };
    }

    return await startProviderCheckout({
      provider: selectedProvider,
      businessId: m.businessId,
      plan: parsedPlan.data as Plan,
      email,
    });
  } catch (e) {
    unstable_rethrow(e);
    return { error: "Checkout is unavailable right now. Your current plan has not changed." };
  }
}

export async function manageSubscription(): Promise<CheckoutResult> {
  const m = await requireBusinessOwner();
  try {
    return await openProviderPortal(m.businessId);
  } catch (e) {
    unstable_rethrow(e);
    return { error: "Could not open subscription management. Please try again." };
  }
}
