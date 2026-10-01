import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getJoinKeys, getJoinSecret } from "@/lib/security/customer-session";
const session = "70000000-0000-4000-8000-000000000001";
afterEach(() => vi.unstubAllEnvs());
describe("anonymous join identity", () => {
  it("requires a private secret and valid random session", () => {
    vi.stubEnv("QUEUE_JOIN_SECRET", "short");
    expect(() => getJoinSecret()).toThrow(/Configure/);
    vi.stubEnv("QUEUE_JOIN_SECRET", "x".repeat(32));
    expect(() => getJoinKeys("not-a-uuid", new Headers())).toThrow();
  });
  it("uses stable separate opaque customer and network keys", () => {
    vi.stubEnv("QUEUE_JOIN_SECRET", "x".repeat(32)); vi.stubEnv("VERCEL", "1");
    const headers = new Headers({ "x-vercel-forwarded-for": "203.0.113.1" });
    const first = getJoinKeys(session, headers);
    expect(first).toEqual(getJoinKeys(session, headers));
    expect(first.customerKey).toMatch(/^[a-f0-9]{64}$/);
    expect(first.rateKey).not.toBe(first.customerKey);
    expect(getJoinKeys(session, new Headers({ "x-vercel-forwarded-for": "203.0.113.2" })).customerKey).toBe(first.customerKey);
    expect(getJoinKeys(session, new Headers({ "x-vercel-forwarded-for": "203.0.113.2" })).rateKey).not.toBe(first.rateKey);
  });
  it("ignores spoofable forwarding headers outside Vercel", () => {
    vi.stubEnv("QUEUE_JOIN_SECRET", "x".repeat(32)); vi.stubEnv("VERCEL", "");
    expect(getJoinKeys(session, new Headers({ "x-forwarded-for": "203.0.113.1", "x-vercel-forwarded-for": "203.0.113.1" }))).toEqual(getJoinKeys(session, new Headers()));
  });
  it("falls back conservatively for malformed platform addresses", () => {
    vi.stubEnv("QUEUE_JOIN_SECRET", "x".repeat(32)); vi.stubEnv("VERCEL", "1");
    expect(getJoinKeys(session, new Headers({ "x-vercel-forwarded-for": "fake" }))).toEqual(getJoinKeys(session, new Headers()));
  });
});
