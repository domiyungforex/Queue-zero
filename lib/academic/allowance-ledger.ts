export type FeeCategory = "STANDARD" | "EXTENDED" | "SPECIALISED";

export interface FeeConfig {
  currency: string;
  freeAllowanceLimit: number;
  standardFeeMinor: number;
  extendedFeeMinor: number;
  specialisedFeeMinor: number;
  lecturerShareBps: number;
  referralCommissionBps: number;
  minWithdrawalMinor: number;
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  currency: "NGN",
  freeAllowanceLimit: 5,
  standardFeeMinor: 20_000, // ₦200
  extendedFeeMinor: 30_000, // ₦300
  specialisedFeeMinor: 50_000, // ₦500
  lecturerShareBps: 7000, // 70% default configurable by admin
  referralCommissionBps: 1000, // 10% default configurable by admin
  minWithdrawalMinor: 500_000, // ₦5,000
};

export function feeForCategoryMinor(category: FeeCategory, config: FeeConfig): number {
  if (category === "EXTENDED") return config.extendedFeeMinor;
  if (category === "SPECIALISED") return config.specialisedFeeMinor;
  return config.standardFeeMinor;
}

export function evaluateStudentAllowance(input: {
  freeUsed: number;
  sponsoredCredits: number;
  hasPaidCreditForAssignment: boolean;
  feeCategory: FeeCategory;
  config: FeeConfig;
}): {
  requiresPayment: boolean;
  paymentSource: "FREE_ALLOWANCE" | "SPONSORED_CREDIT" | "PAID_CREDIT" | "PAYMENT_REQUIRED";
  remainingFree: number;
  feeMinor: number;
  currency: string;
} {
  const remainingFree = Math.max(0, input.config.freeAllowanceLimit - input.freeUsed);
  const feeMinor = feeForCategoryMinor(input.feeCategory, input.config);

  if (input.hasPaidCreditForAssignment) {
    return {
      requiresPayment: false,
      paymentSource: "PAID_CREDIT",
      remainingFree,
      feeMinor: 0,
      currency: input.config.currency,
    };
  }
  if (remainingFree > 0) {
    return {
      requiresPayment: false,
      paymentSource: "FREE_ALLOWANCE",
      remainingFree,
      feeMinor: 0,
      currency: input.config.currency,
    };
  }
  if (input.sponsoredCredits > 0) {
    return {
      requiresPayment: false,
      paymentSource: "SPONSORED_CREDIT",
      remainingFree: 0,
      feeMinor: 0,
      currency: input.config.currency,
    };
  }
  return {
    requiresPayment: feeMinor > 0,
    paymentSource: feeMinor > 0 ? "PAYMENT_REQUIRED" : "FREE_ALLOWANCE",
    remainingFree: 0,
    feeMinor,
    currency: input.config.currency,
  };
}

/** Integer minor-unit allocation: zero floating-point drift. */
export function computeRevenueAllocation(input: {
  amountMinor: number;
  lecturerShareBps: number;
  referralCommissionBps: number;
  hasValidReferrer: boolean;
  lecturerCount?: number;
}): {
  grossMinor: number;
  referralCommissionMinor: number;
  lecturerTotalMinor: number;
  perLecturerMinor: number;
  platformMinor: number;
} {
  const gross = Math.max(0, Math.trunc(input.amountMinor));
  const referralCommissionMinor = input.hasValidReferrer
    ? Math.floor((gross * input.referralCommissionBps) / 10_000)
    : 0;
  const lecturerTotalMinor = Math.floor((gross * input.lecturerShareBps) / 10_000);
  const count = Math.max(1, input.lecturerCount ?? 1);
  const perLecturerMinor = Math.floor(lecturerTotalMinor / count);
  const platformMinor = Math.max(0, gross - referralCommissionMinor - lecturerTotalMinor);

  return {
    grossMinor: gross,
    referralCommissionMinor,
    lecturerTotalMinor,
    perLecturerMinor,
    platformMinor,
  };
}

export function formatNgnFromMinor(amountMinor: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
