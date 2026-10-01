import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getSupabaseEnv } from "@/lib/db/env";

function legacyKey(role: string) {
  return `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://queuezero.supabase.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
});
afterEach(() => vi.unstubAllEnvs());

describe("Supabase configuration boundary", () => {
  it("accepts publishable keys", () => {
    expect(getSupabaseEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("sb_publishable_fixture");
  });

  it("accepts a legacy anon JWT", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", legacyKey("anon"));
    expect(getSupabaseEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(legacyKey("anon"));
  });

  it.each(["sb_secret_fixture", legacyKey("service_role"), "not-a-key", "header.not-json.signature"])(
    "rejects a private or invalid key (%#)",
    (key) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
      expect(() => getSupabaseEnv()).toThrow("publishable or legacy anon key");
    },
  );

  it("rejects missing configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    expect(() => getSupabaseEnv()).toThrow();
  });

  it("rejects a non-HTTP project URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "file:///tmp/database");
    expect(() => getSupabaseEnv()).toThrow();
  });
});
