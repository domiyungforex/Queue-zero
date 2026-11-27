import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createJoinSupabaseClient } from "@/lib/db/join-server";
import { paystack } from "@/lib/paystack/server";
import { verifyAssignmentGuestToken } from "@/lib/academic/distribution";
import { feeForCategoryMinor, type FeeCategory } from "@/lib/academic/allowance-ledger";
import { loadFeeConfig } from "@/lib/academic/guest-actions";

const bodySchema = z.object({
  token: z.string().min(10),
  studentId: z.uuid(),
  email: z.email().max(254).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
    }

    const tokenData = verifyAssignmentGuestToken(parsed.data.token);
    const db = createJoinSupabaseClient() as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: unknown) => {
            eq: (col2: string, val2: unknown) => {
              maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
            };
          };
        };
        insert: (row: unknown) => Promise<{ error: unknown }>;
      };
    };

    const { data: assignment } = await db
      .from("assignments")
      .select("id,fee_category,status")
      .eq("id", tokenData.assignmentId)
      .eq("organization_id", tokenData.orgId)
      .maybeSingle();

    if (!assignment || assignment.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Assignment is not open." }, { status: 409 });
    }

    const feeCategory = String(assignment.fee_category ?? "STANDARD") as FeeCategory;
    const config = await loadFeeConfig(tokenData.orgId);
    const amountMinor = feeForCategoryMinor(feeCategory, config);
    const reference = randomUUID();

    const { error } = await db.from("assignment_payments").insert({
      reference,
      organization_id: tokenData.orgId,
      assignment_id: tokenData.assignmentId,
      student_id: parsed.data.studentId,
      fee_category: feeCategory,
      amount_minor: amountMinor,
      currency: config.currency,
      status: "PENDING",
      provider: "paystack",
    });

    if (error) {
      return NextResponse.json({ error: "Could not create payment record." }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const callbackUrl = new URL("/api/academic/payments/verify", appUrl);
    callbackUrl.searchParams.set("token", parsed.data.token);

    const init = z
      .object({ authorization_url: z.url() })
      .parse(
        await paystack("/transaction/initialize", {
          email: parsed.data.email || "student-noreply@turnmark.conchportal.com",
          amount: amountMinor,
          currency: config.currency,
          reference,
          callback_url: callbackUrl.href,
          metadata: {
            kind: "assignment_submission",
            reference,
            organizationId: tokenData.orgId,
            assignmentId: tokenData.assignmentId,
            studentId: parsed.data.studentId,
          },
        }),
      );

    return NextResponse.json({ url: init.authorization_url, reference });
  } catch {
    return NextResponse.json(
      { error: "Paystack checkout is unavailable right now. Please try again." },
      { status: 503 },
    );
  }
}
