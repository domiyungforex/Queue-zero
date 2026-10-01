import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { protect, getToken } = vi.hoisted(() => ({ protect: vi.fn(), getToken: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect } }));

import { createUserSupabaseClient } from "@/lib/db/server";

const requests: Request[] = [];

beforeEach(() => {
  requests.length = 0;
  protect.mockReset().mockResolvedValue({ userId: "user_verified", getToken });
  getToken.mockReset().mockResolvedValue("clerk-session-token");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://queuezero.supabase.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-secret-fixture");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("real Supabase SDK with mocked Clerk session and HTTP transport", () => {
  it("sends the Clerk session to Supabase using only the public project key", async () => {
    const client = await createUserSupabaseClient();
    const { data, error } = await client.from("businesses").select("id,name");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(protect).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledWith();
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get("Authorization")).toBe("Bearer clerk-session-token");
    expect(requests[0].headers.get("apikey")).toBe("sb_publishable_fixture");
    expect([...requests[0].headers.values()].join(" ")).not.toContain("server-only-secret-fixture");
  });

  it("asks Clerk for the current token on subsequent queries", async () => {
    getToken.mockResolvedValue("first-session-token");
    const client = await createUserSupabaseClient();
    await client.from("businesses").select("id");
    getToken.mockResolvedValue("refreshed-session-token");
    await client.from("businesses").select("id");
    expect(requests.map((request) => request.headers.get("Authorization"))).toEqual([
      "Bearer first-session-token", "Bearer refreshed-session-token",
    ]);
  });

  it("rejects anonymous requests before constructing an authenticated client", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    protect.mockRejectedValue(redirect);
    await expect(createUserSupabaseClient()).rejects.toBe(redirect);
    expect(requests).toHaveLength(0);
  });

  it("does not fall back to anonymous or service access when the session expires", async () => {
    // The SDK initializes Realtime auth as well and warns on this deliberate failure.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getToken.mockResolvedValue(null);
    const client = await createUserSupabaseClient();
    const { error } = await client.from("businesses").select("id");
    expect(error?.message).toContain("Your session has expired");
    expect(requests).toHaveLength(0);
  });
});
