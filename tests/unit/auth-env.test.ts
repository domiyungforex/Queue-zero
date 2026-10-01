import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getClerkServerEnv } from "@/lib/auth/env";

afterEach(() => vi.unstubAllEnvs());

describe("Clerk server configuration", () => {
  it("rejects missing credentials", () => {
    vi.stubEnv("CLERK_SECRET_KEY", undefined);
    expect(() => getClerkServerEnv()).toThrow();
  });

  it("rejects a publishable key in place of the secret", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "pk_test_not_a_secret");
    expect(() => getClerkServerEnv()).toThrow();
  });

  it("accepts a configured secret without exposing it in errors", () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture_only");
    expect(getClerkServerEnv()).toEqual({ CLERK_SECRET_KEY: "sk_test_fixture_only" });
    vi.stubEnv("CLERK_SECRET_KEY", "sensitive-invalid-value");
    try {
      getClerkServerEnv();
      expect.fail("Invalid credentials must fail validation");
    } catch (error) {
      expect(String(error)).not.toContain("sensitive-invalid-value");
    }
  });
});
