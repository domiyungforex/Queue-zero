import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createJoinSupabaseClient } from "@/lib/db/join-server";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it.each(["", "sb_publishable_fixture", "INVALID_PRIVATE_CANARY"])("rejects invalid privileged credentials without echoing them", (key) => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", key);
  expect(() => createJoinSupabaseClient()).toThrow("Configure a Supabase secret or legacy service-role key for customer joining.");
});
it("uses the server key only for the controlled RPC", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_fixture");
  const fetch = vi.fn(async () => new Response(JSON.stringify("74000000-0000-4000-8000-000000000001"), { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  await createJoinSupabaseClient().rpc("join_public_queue", { p_slug: "clinic", p_request_id: "74000000-0000-4000-8000-000000000002", p_customer_key: "a".repeat(64), p_rate_key: "b".repeat(64), p_customer_name: "Ada", p_phone: "" });
  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://database.example/rest/v1/rpc/join_public_queue");
  expect(new Headers(init.headers).get("apikey")).toBe("sb_secret_fixture");
});
