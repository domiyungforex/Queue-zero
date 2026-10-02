import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ queue: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/queue/management", () => ({ getManagedQueue: mocks.queue }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ unstable_rethrow: (error: unknown) => { if (error instanceof Error && error.message.startsWith("NEXT_")) throw error; } }));
import { callNext } from "@/lib/queue/call-next";
import { callNextResponseSchema } from "@/lib/validation/call-next";
const input = { queueId: "f0000000-0000-4000-8000-000000000001", requestId: "f0000000-0000-4000-8000-000000000002" };
const called = { outcome: "called", replayed: false, ticket_id: "f0000000-0000-4000-8000-000000000003", display_number: "A001", customer_name: "Ada", called_at: "2026-10-02T12:00:00.123456+00:00", ticket_status: "serving" };
const empty = { outcome: "empty", replayed: false, ticket_id: null, display_number: null, customer_name: null, called_at: null, ticket_status: null };
beforeEach(() => {
  mocks.queue.mockResolvedValue({ id: input.queueId });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: [called], error: null });
});
describe("authorized Call Next server boundary", () => {
  it("uses the RLS-scoped queue lookup and authenticated client before the transaction", async () => {
    expect(await callNext(input)).toEqual({ ok: true, result: called });
    expect(mocks.queue).toHaveBeenCalledWith(input.queueId);
    expect(mocks.queue.mock.invocationCallOrder[0]).toBeLessThan(mocks.client.mock.invocationCallOrder[0]);
    expect(mocks.rpc).toHaveBeenCalledWith("call_next_ticket", { p_queue_id: input.queueId, p_request_id: input.requestId });
    expect(mocks.revalidate).toHaveBeenCalledWith(`/dashboard/queues/${input.queueId}`);
  });
  it.each([{}, { ...input, requestId: "invalid" }, { ...input, businessId: "attacker" }, { ...input, actorId: "owner" }])("rejects invalid or injected identity input", async (value) => {
    expect(await callNext(value)).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["NEXT_REDIRECT:/sign-in", "NEXT_NOT_FOUND"])("preserves framework control flow %s without an RPC", async (message) => {
    mocks.queue.mockRejectedValue(new Error(message));
    await expect(callNext(input)).rejects.toThrow(message); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([["42501", "forbidden"], ["QZ002", "queue_unavailable"], ["40P01", "retry"], ["XX000", "retry"]])("maps %s safely", async (code, expected) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "PRIVATE_DATABASE_DETAIL" } });
    const result = await callNext(input);
    expect(result).toMatchObject({ ok: false, code: expected }); expect(JSON.stringify(result)).not.toContain("PRIVATE_DATABASE_DETAIL");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("retains the caller's nonce across an ambiguous failure and a replay", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("PRIVATE_NETWORK_DETAIL")).mockResolvedValueOnce({ data: [{ ...called, replayed: true, ticket_status: "completed" }], error: null });
    expect(await callNext(input)).toMatchObject({ ok: false, code: "retry" });
    expect(await callNext(input)).toMatchObject({ ok: true, result: { replayed: true, ticket_status: "completed" } });
    for (const args of mocks.rpc.mock.calls) expect(args[1].p_request_id).toBe(input.requestId);
  });
  it.each([empty, { ...called, outcome: "already_serving" }])("returns clean $outcome results without pretending a new call", async (result) => {
    mocks.rpc.mockResolvedValue({ data: [result], error: null }); expect(await callNext(input)).toEqual({ ok: true, result });
  });
  it.each([[], [called, called], [{ ...called, phone: "PRIVATE_PHONE" }], [{ ...called, ticket_status: "waiting" }], [{ ...empty, ticket_id: called.ticket_id }]].map((data) => ({ data })))("fails closed on malformed provider data", async ({ data }) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await callNext(input)).toMatchObject({ ok: false, code: "retry" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("accepts replayed no-shows but never a waiting/cancelled record as a called result", () => {
    expect(callNextResponseSchema.safeParse({ ...called, replayed: true, ticket_status: "no_show" }).success).toBe(true);
    expect(callNextResponseSchema.safeParse({ ...called, replayed: true, ticket_status: "cancelled" }).success).toBe(false);
  });
});
