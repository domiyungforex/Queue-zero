import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/join-server", () => ({ createJoinSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); }, unstable_rethrow: () => {} }));
import { cancelTicket } from "@/app/(public)/ticket/[token]/actions";
const token = "82000000-0000-4000-8000-000000000001";
function form() { const data = new FormData(); data.set("confirm", "yes"); data.set("ticket_id", "attacker"); return data; }
beforeEach(() => { mocks.rpc.mockResolvedValue({ data: "cancelled", error: null }); });
it("uses only the bound token, refreshes the page and redirects to authoritative status", async () => {
  await expect(cancelTicket(token, { status: "idle" }, form())).rejects.toThrow(`NEXT_REDIRECT:/ticket/${token}`);
  expect(mocks.rpc).toHaveBeenCalledWith("cancel_public_ticket", { p_token: token });
  expect(mocks.revalidate).toHaveBeenCalledWith(`/ticket/${token}`);
});
it("requires a valid token and explicit confirmation", async () => {
  expect((await cancelTicket("invalid", { status: "idle" }, form())).status).toBe("error");
  expect((await cancelTicket(token, { status: "idle" }, new FormData())).message).toMatch(/Confirm/);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("handles a serving/cancellation race without pretending success", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "QZ007", message: "PRIVATE" } });
  const state = await cancelTicket(token, { status: "idle" }, form());
  expect(state.message).toMatch(/no longer waiting/); expect(JSON.stringify(state)).not.toContain("PRIVATE");
});
it("permits a safe retry after ambiguous failure and does not leak details", async () => {
  mocks.rpc.mockRejectedValue(new Error("PRIVATE_NETWORK"));
  const state = await cancelTicket(token, { status: "idle" }, form());
  expect(state.message).toMatch(/Retry/); expect(JSON.stringify(state)).not.toContain("PRIVATE_NETWORK");
});
