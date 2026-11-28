import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeRevenueAllocation,
  DEFAULT_FEE_CONFIG,
  evaluateStudentAllowance,
} from "@/lib/academic/allowance-ledger";
import {
  deduplicateRecipientIds,
  signAssignmentGuestToken,
  verifyAssignmentGuestToken,
} from "@/lib/academic/distribution";
import { validateUniversalFile } from "@/lib/academic/universal-files";

describe("Assignment distribution & guest submission tokens", () => {
  it("deduplicates recipients across overlapping groups and verifies signed guest tokens", () => {
    const ids = deduplicateRecipientIds([["s1", "s2"], ["s2", "s3"]]);
    expect(ids).toEqual(["s1", "s2", "s3"]);

    const orgId = "11111111-1111-4111-8111-111111111111";
    const assignmentId = "22222222-2222-4222-8222-222222222222";
    const now = Math.floor(Date.now() / 1000);
    const token = signAssignmentGuestToken(orgId, assignmentId, now + 3600, "secret-key-at-least-32-chars-long");
    const verified = verifyAssignmentGuestToken(token, "secret-key-at-least-32-chars-long", now);
    expect(verified.assignmentId).toBe(assignmentId);
    expect(verified.orgId).toBe(orgId);
  });

  describe("without a configured signing secret", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("fails closed instead of minting links with a hardcoded secret", () => {
      vi.stubEnv("ATTENDANCE_QR_SECRET", "");
      vi.stubEnv("QUEUE_JOIN_SECRET", "");
      vi.stubEnv("CLERK_SECRET_KEY", "");
      const orgId = "11111111-1111-4111-8111-111111111111";
      const assignmentId = "22222222-2222-4222-8222-222222222222";
      const now = Math.floor(Date.now() / 1000);
      expect(() => signAssignmentGuestToken(orgId, assignmentId, now + 3600)).toThrow(
        "Assignment link signing is not configured.",
      );
    });
  });
});

describe("5-free submission allowance & Paystack minor-unit revenue ledger", () => {
  it("grants 5 free submissions per semester across all courses and requires NGN payment on the 6th", () => {
    const fifth = evaluateStudentAllowance({
      freeUsed: 4,
      sponsoredCredits: 0,
      hasPaidCreditForAssignment: false,
      feeCategory: "STANDARD",
      config: DEFAULT_FEE_CONFIG,
    });
    expect(fifth.requiresPayment).toBe(false);
    expect(fifth.remainingFree).toBe(1);

    const sixth = evaluateStudentAllowance({
      freeUsed: 5,
      sponsoredCredits: 0,
      hasPaidCreditForAssignment: false,
      feeCategory: "SPECIALISED",
      config: DEFAULT_FEE_CONFIG,
    });
    expect(sixth.requiresPayment).toBe(true);
    expect(sixth.feeMinor).toBe(50_000); // ₦500 in kobo

    // New semester resets freeUsed to 0 -> 5 fresh free submissions
    const newSemester = evaluateStudentAllowance({
      freeUsed: 0,
      sponsoredCredits: 0,
      hasPaidCreditForAssignment: false,
      feeCategory: "STANDARD",
      config: DEFAULT_FEE_CONFIG,
    });
    expect(newSemester.requiresPayment).toBe(false);
    expect(newSemester.remainingFree).toBe(5);

    // Free submissions generate zero lecturer or referral commission
    const freeAlloc = computeRevenueAllocation({
      amountMinor: 0,
      lecturerShareBps: DEFAULT_FEE_CONFIG.lecturerShareBps,
      referralCommissionBps: DEFAULT_FEE_CONFIG.referralCommissionBps,
      hasValidReferrer: true,
    });
    expect(freeAlloc.lecturerTotalMinor).toBe(0);
    expect(freeAlloc.referralCommissionMinor).toBe(0);
  });

  it("calculates 10% referral commission and configurable lecturer share in integer minor units", () => {
    const alloc = computeRevenueAllocation({
      amountMinor: 50_000, // ₦500
      lecturerShareBps: 7000, // 70%
      referralCommissionBps: 1000, // 10%
      hasValidReferrer: true,
      lecturerCount: 2,
    });
    expect(alloc.referralCommissionMinor).toBe(5_000); // ₦50
    expect(alloc.lecturerTotalMinor).toBe(35_000); // ₦350
    expect(alloc.perLecturerMinor).toBe(17_500); // ₦175 each
    expect(alloc.platformMinor).toBe(10_000); // ₦100
  });
});

describe("Universal file validation (Fine Art, AutoCAD DWG, PDF)", () => {
  it("accepts valid DWG and PDF signatures and rejects spoofed extensions", () => {
    const dwgOk = validateUniversalFile({
      fileName: "floorplan.dwg",
      mimeType: "application/acad",
      buffer: Buffer.from("AC1032...drawing-bytes"),
    });
    expect(dwgOk.ok).toBe(true);

    const fakePdf = validateUniversalFile({
      fileName: "homework.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not-a-pdf"),
    });
    expect(fakePdf.ok).toBe(false);
  });
});
