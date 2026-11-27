import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { verifyStripeSignature } from "@/lib/stripe/webhook";

describe("verifyStripeSignature", () => {
  const secret = "whsec_test_secret_12345";
  const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });

  it("accepts a valid Stripe-Signature header within tolerance", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=${sig}`, secret)).toBe(true);
  });

  it("rejects tampered payloads or wrong secrets", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
    expect(verifyStripeSignature(`${payload} `, `t=${timestamp},v1=${sig}`, secret)).toBe(false);
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=${sig}`, "wrong_secret")).toBe(false);
  });

  it("rejects expired timestamps outside tolerance", () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
    const sig = createHmac("sha256", secret).update(`${oldTimestamp}.${payload}`, "utf8").digest("hex");
    expect(verifyStripeSignature(payload, `t=${oldTimestamp},v1=${sig}`, secret, 300)).toBe(false);
  });
});
