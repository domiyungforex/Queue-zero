"use server";

import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import { requireBusinessOwner } from "@/lib/business/membership";
import { openProviderPortal, startProviderCheckout } from "@/lib/payments/provider";
import type { Plan } from "@/lib/paystack/plans";

export type CheckoutResult = { url?: string; error?: string };

const planSchema = z.enum(["STARTER", "GROWTH", "PROFESSIONAL", "EDUCATION", "EVENTS", "BUSINESS"]);
const intervalSchema = z.enum(["monthly", "annual"]);

export async function startCheckout(plan: unknown, interval?: unknown): Promise<CheckoutResult> {
  const m = await requireBusinessOwner();
  const parsedPlan = planSchema.safeParse(plan);
  if (!parsedPlan.success) return { error: "Choose a valid plan." };
  const parsedInterval = interval === undefined ? null : intervalSchema.safeParse(interval);
  if (parsedInterval && !parsedInterval.success) return { error: "Choose a valid billing interval." };

  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email || user?.primaryEmailAddress?.verification?.status !== "verified") {
      return { error: "Add a verified email to your account before upgrading." };
    }

    return await startProviderCheckout({
      businessId: m.businessId,
      plan: parsedPlan.data as Plan,
      email,
      interval: parsedInterval?.success ? parsedInterval.data : "monthly",
    });
  } catch (e) {
    unstable_rethrow(e);
    // Configuration errors are safe to surface: they tell the workspace owner
    // exactly which plan is not yet available for checkout.
    if (e instanceof Error && /not configured|configuration mismatch|does not use checkout/i.test(e.message)) {
      return { error: "This plan is not available for checkout yet. Please contact support." };
    }
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
