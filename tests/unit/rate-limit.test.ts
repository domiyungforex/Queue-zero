import { describe, expect, it } from "vitest";
import { checkRateLimit, clientIpFromRequest } from "@/lib/security/rate-limit";

describe("rate-limit utility", () => {
  it("allows requests within the limit and blocks excess requests with retryAfterSeconds", () => {
    const key = `test-bucket-${Date.now()}`;
    expect(checkRateLimit(key, { limit: 2, windowMs: 10_000 })).toEqual({ allowed: true, remaining: 1 });
    expect(checkRateLimit(key, { limit: 2, windowMs: 10_000 })).toEqual({ allowed: true, remaining: 0 });
    const blocked = checkRateLimit(key, { limit: 2, windowMs: 10_000 });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });

  it("extracts client IP from x-forwarded-for or x-real-ip", () => {
    const req1 = new Request("https://example.com", { headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.1" } });
    expect(clientIpFromRequest(req1)).toBe("198.51.100.10");

    const req2 = new Request("https://example.com", { headers: { "x-real-ip": "203.0.113.5" } });
    expect(clientIpFromRequest(req2)).toBe("203.0.113.5");
  });
});
