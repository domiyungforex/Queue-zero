import { NextResponse } from "next/server";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { paystack } from "@/lib/paystack/server";
import { computeRevenueAllocation } from "@/lib/academic/allowance-ledger";
import { loadFeeConfig } from "@/lib/academic/guest-actions";

const verifySchema = z.object({
  id: z.number(),
  reference: z.string(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectBack = new URL(token ? `/submit/${encodeURIComponent(token)}` : "/", appUrl);

  if (!z.uuid().safeParse(reference).success) {
    redirectBack.searchParams.set("payment", "invalid");
    return NextResponse.redirect(redirectBack);
  }

  try {
    const db = createJoinSupabaseClient() as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: unknown) => {
            eq?: (col2: string, val2: unknown) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
          };
        };
        update: (row: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> };
        insert: (row: unknown) => Promise<{ error: unknown }>;
      };
    };

    const { data: payment } = await db
      .from("assignment_payments")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (!payment) {
      redirectBack.searchParams.set("payment", "missing");
      return NextResponse.redirect(redirectBack);
    }

    if (payment.status === "PAID") {
      redirectBack.searchParams.set("payment", "verified");
      return NextResponse.redirect(redirectBack);
    }

    const paid = verifySchema.parse(await paystack(`/transaction/verify/${encodeURIComponent(reference)}`));
    if (
      paid.status !== "success" ||
      paid.reference !== reference ||
      paid.amount !== Number(payment.amount_minor) ||
      paid.currency !== String(payment.currency)
    ) {
      redirectBack.searchParams.set("payment", "unconfirmed");
      return NextResponse.redirect(redirectBack);
    }

    const now = new Date().toISOString();
    await db
      .from("assignment_payments")
      .update({
        status: "PAID",
        provider_transaction_id: String(paid.id),
        verified_at: now,
      })
      .eq("reference", reference);

    // Record immutable financial ledger allocations
    const orgId = String(payment.organization_id);
    const assignmentId = String(payment.assignment_id);
    const studentId = String(payment.student_id);
    const config = await loadFeeConfig(orgId);

    const [{ data: assignment }, { data: referral }] = await Promise.all([
      db.from("assignments").select("created_by").eq("id", assignmentId).maybeSingle(),
      (
        createJoinSupabaseClient() as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              eq: (c1: string, v1: unknown) => {
                eq: (c2: string, v2: unknown) => {
                  maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
                };
              };
            };
          };
        }
      )
        .from("referral_attributions")
        .select("referrer_user_id")
        .eq("organization_id", orgId)
        .eq("student_id", studentId)
        .maybeSingle(),
    ]);

    const allocation = computeRevenueAllocation({
      amountMinor: Number(payment.amount_minor),
      lecturerShareBps: config.lecturerShareBps,
      referralCommissionBps: config.referralCommissionBps,
      hasValidReferrer: Boolean(referral?.referrer_user_id),
    });

    await db.from("financial_ledger").insert([
      {
        organization_id: orgId,
        assignment_id: assignmentId,
        payment_reference: reference,
        transaction_type: "STUDENT_PAYMENT",
        amount_minor: allocation.grossMinor,
        currency: config.currency,
        status: "CONFIRMED",
      },
      {
        organization_id: orgId,
        assignment_id: assignmentId,
        payment_reference: reference,
        beneficiary_user_id: assignment?.created_by ? String(assignment.created_by) : null,
        transaction_type: "LECTURER_COMMISSION",
        amount_minor: allocation.lecturerTotalMinor,
        currency: config.currency,
        status: "CONFIRMED",
      },
      ...(allocation.referralCommissionMinor > 0 && referral?.referrer_user_id
        ? [
            {
              organization_id: orgId,
              assignment_id: assignmentId,
              payment_reference: reference,
              beneficiary_user_id: String(referral.referrer_user_id),
              transaction_type: "REFERRAL_COMMISSION",
              amount_minor: allocation.referralCommissionMinor,
              currency: config.currency,
              status: "CONFIRMED",
            },
          ]
        : []),
      {
        organization_id: orgId,
        assignment_id: assignmentId,
        payment_reference: reference,
        transaction_type: "PLATFORM_ALLOCATION",
        amount_minor: allocation.platformMinor,
        currency: config.currency,
        status: "CONFIRMED",
      },
    ]);

    redirectBack.searchParams.set("payment", "verified");
    return NextResponse.redirect(redirectBack);
  } catch {
    redirectBack.searchParams.set("payment", "error");
    return NextResponse.redirect(redirectBack);
  }
}
