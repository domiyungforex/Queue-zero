import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), cookie: vi.fn(), keys: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }), headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }, unstable_rethrow: () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db/join-server", () => ({ createJoinSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/security/customer-session", async (original) => ({ ...await original<typeof import("@/lib/security/customer-session")>(), getJoinKeys: mocks.keys }));
import { joinQueue } from "@/app/(public)/q/[slug]/join/actions";
const context = { slug: "join-test", requestId: "71000000-0000-4000-8000-000000000001" };
const token = "71000000-0000-4000-8000-000000000002";
function form(name = " Ada ") { const data = new FormData(); data.set("firstName", name); data.set("business_id", "attacker"); data.set("customer_key", "attacker"); return data; }
beforeEach(() => { mocks.cookie.mockReturnValue({ value: context.requestId }); mocks.keys.mockReturnValue({ customerKey: "a".repeat(64), rateKey: "b".repeat(64) }); mocks.rpc.mockResolvedValue({ data: token, error: null }); });
describe("public join action", () => {
  it("derives trusted keys server-side, trims name and redirects to opaque receipt", async () => {
    await expect(joinQueue(context, { status: "idle" }, form())).rejects.toThrow(`NEXT_REDIRECT:/ticket/${token}`);
    expect(mocks.rpc).toHaveBeenCalledWith("join_public_queue", { p_slug: "join-test", p_request_id: context.requestId, p_customer_key: "a".repeat(64), p_rate_key: "b".repeat(64), p_customer_name: "Ada", p_phone: "" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/q/join-test");
  });
  it("rejects invalid input before database access", async () => {
    const state = await joinQueue(context, { status: "idle" }, form("   "));
    expect(state.fieldErrors?.firstName).toBeDefined(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires the anonymous session cookie", async () => {
    mocks.cookie.mockReturnValue(undefined);
    expect((await joinQueue(context, { status: "idle" }, form())).message).toMatch(/cookies/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([['QZ002', /paused or closed/], ['QZ003', /phone number/], ['QZ004', /full/], ['QZ005', /Too many joins/]])("returns useful %s failure without provider details", async (code, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "PRIVATE_DATABASE_DETAIL" } });
    const state = await joinQueue(context, { status: "idle" }, form());
    expect(state.message).toMatch(message); expect(JSON.stringify(state)).not.toContain("PRIVATE_DATABASE_DETAIL"); expect(state.values?.firstName).toBe(" Ada ");
  });
  it("offers safe retry on an ambiguous transport failure", async () => {
    mocks.rpc.mockRejectedValue(new Error("PRIVATE_NETWORK_DETAIL"));
    const state = await joinQueue(context, { status: "idle" }, form());
    expect(state.message).toMatch(/Retry this form/); expect(JSON.stringify(state)).not.toContain("PRIVATE_NETWORK_DETAIL");
  });
  it("never redirects to an invalid provider token", async () => {
    mocks.rpc.mockResolvedValue({ data: "https://evil.example", error: null });
    expect((await joinQueue(context, { status: "idle" }, form())).status).toBe("error");
  });
});
