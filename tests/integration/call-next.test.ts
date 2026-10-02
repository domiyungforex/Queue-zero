import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ protect: vi.fn(), queue: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect: mocks.protect } }));
vi.mock("@/lib/queue/management", () => ({ getManagedQueue: mocks.queue }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: (error: unknown) => { if (error instanceof Error && error.message.startsWith("NEXT_")) throw error; } }));
import { callNext } from "@/lib/queue/call-next";
const input = { queueId: "f1000000-0000-4000-8000-000000000001", requestId: "f1000000-0000-4000-8000-000000000002" };
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "PRIVATE_SERVICE_KEY_MUST_NOT_BE_USED");
  mocks.protect.mockResolvedValue({ getToken: async () => "clerk_session_fixture" });
  mocks.queue.mockResolvedValue({ id: input.queueId });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("sends the Clerk session, not the service role, through the actual Supabase SDK", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify([{ outcome: "empty", replayed: false, ticket_id: null, display_number: null, customer_name: null, called_at: null, ticket_status: null }]), { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await callNext(input)).toMatchObject({ ok: true, result: { outcome: "empty" } });
  expect(mocks.protect).toHaveBeenCalled(); expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://database.example/rest/v1/rpc/call_next_ticket");
  expect(new Headers(init.headers).get("authorization")).toBe("Bearer clerk_session_fixture");
  expect(new Headers(init.headers).get("apikey")).toBe("sb_publishable_fixture");
  expect(JSON.parse(String(init.body))).toEqual({ p_queue_id: input.queueId, p_request_id: input.requestId });
});
it("does not issue a network mutation if Clerk denies authentication", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  mocks.protect.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in"));
  await expect(callNext(input)).rejects.toThrow("NEXT_REDIRECT:/sign-in");
  expect(fetch).not.toHaveBeenCalled();
});
