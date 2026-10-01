import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ member: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }) }));
vi.mock("@/lib/business/membership", () => ({ requireBusinessManager: mocks.member }));
vi.mock("@/lib/db/server", () => ({ createUserSupabaseClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, unstable_rethrow: (error: unknown) => {
  if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
} }));
import { createQueue, updateQueue, changeQueueStatus } from "@/app/dashboard/queues/actions";
const context = { businessId: "30000000-0000-4000-8000-000000000001", queueId: "30000000-0000-4000-8000-000000000002" };
const values = { name: " Consultation ", description: " Welcome ", locationId: "30000000-0000-4000-8000-000000000003", serviceMinutes: "5", warningThreshold: "3", phoneMode: "required" };
function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  Object.entries({ ...values, ...overrides }).forEach(([key, value]) => result.set(key, value));
  return result;
}
beforeEach(() => {
  mocks.member.mockReset().mockResolvedValue({ businessId: context.businessId, role: "owner" });
  mocks.client.mockReset().mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockReset().mockResolvedValue({ data: context.queueId, error: null });
});
describe("queue server actions", () => {
  it("creates with validated values, a stable ID, and verified workspace ownership", async () => {
    await expect(createQueue(context, { status: "idle" }, form({ business_id: "victim" }))).rejects.toThrow(`NEXT_REDIRECT:/dashboard/queues/${context.queueId}?saved=created`);
    expect(mocks.rpc).toHaveBeenCalledWith("create_queue", {
      p_queue_id: context.queueId, p_business_id: context.businessId, p_location_id: values.locationId,
      p_name: "Consultation", p_description: "Welcome", p_average_service_seconds: 300, p_warning_threshold: 3,
      p_allow_phone: true, p_require_phone: true,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard", "layout");
  });
  it("preserves the queue ID on a retried creation", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("ambiguous timeout"));
    expect((await createQueue(context, { status: "idle" }, form())).status).toBe("error");
    await expect(createQueue(context, { status: "idle" }, form())).rejects.toThrow("saved=created");
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_queue_id)).toEqual([context.queueId, context.queueId]);
  });
  it("checks access before accepting any input", async () => {
    mocks.member.mockRejectedValue(new Error("NEXT_REDIRECT:/dashboard"));
    await expect(createQueue(context, { status: "idle" }, new FormData())).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    await expect(updateQueue({ ...context, revision: 1 }, { status: "idle" }, form())).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    await expect(changeQueueStatus({ ...context, revision: 1 }, { status: "idle" }, form({ status: "paused" }))).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects a workspace changed since the form was opened", async () => {
    mocks.member.mockResolvedValue({ businessId: "another-business", role: "owner" });
    expect((await createQueue(context, { status: "idle" }, form())).message).toContain("workspace has changed");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("retains failed input and field errors without calling the database", async () => {
    const state = await createQueue(context, { status: "idle" }, form({ name: "", serviceMinutes: "0" }));
    expect(state.values?.name).toBe("");
    expect(state.fieldErrors?.name).toBeDefined();
    expect(state.fieldErrors?.serviceMinutes).toBeDefined();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("includes the revision on edits and does not submit a new slug", async () => {
    await expect(updateQueue({ ...context, revision: 7 }, { status: "idle" }, form())).rejects.toThrow("saved=updated");
    expect(mocks.rpc).toHaveBeenCalledWith("update_queue", expect.objectContaining({ p_expected_revision: 7 }));
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("p_slug");
  });
  it("reports stale edits and retains changes for review", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "private detail" } });
    const state = await updateQueue({ ...context, revision: 1 }, { status: "idle" }, form());
    expect(state.conflict).toBe(true);
    expect(state.values?.name).toBe(values.name);
    expect(JSON.stringify(state)).not.toContain("private detail");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it.each(["open", "paused", "closed"])("sets status %s through the authorized RPC", async (status) => {
    await expect(changeQueueStatus({ ...context, revision: 2 }, { status: "idle" }, form({ status }))).rejects.toThrow("saved=status");
    expect(mocks.rpc).toHaveBeenCalledWith("set_queue_status", { p_queue_id: context.queueId, p_business_id: context.businessId, p_expected_revision: 2, p_status: status });
  });
  it("rejects invalid status and missing revision", async () => {
    expect((await changeQueueStatus({ ...context, revision: 0 }, { status: "idle" }, form({ status: "deleted" }))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("handles transport errors without leaking provider details", async () => {
    mocks.rpc.mockRejectedValue(new Error("private provider data"));
    const state = await changeQueueStatus({ ...context, revision: 1 }, { status: "idle" }, form({ status: "paused" }));
    expect(state.message).toContain("try again");
    expect(JSON.stringify(state)).not.toContain("private provider data");
  });
  it("does not swallow auth redirects during a request", async () => {
    mocks.client.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in"));
    await expect(createQueue(context, { status: "idle" }, form())).rejects.toThrow("NEXT_REDIRECT:/sign-in");
  });
  it("rejects malformed or unexpected RPC results", async () => {
    mocks.rpc.mockResolvedValue({ data: "30000000-0000-4000-8000-000000000099", error: null });
    expect((await createQueue(context, { status: "idle" }, form())).status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
