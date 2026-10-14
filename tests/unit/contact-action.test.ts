import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), headers: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/join-server", () => ({ createJoinSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { submitInquiry } from "@/lib/contact/actions";
function data() { const form = new FormData(); for (const [key, value] of Object.entries({ name: "Ada", email: "ada@example.com", message: "Help us operate our real queue", requestId: "f0ca49d3-b0a4-40dc-b835-f97d0b431f31" })) form.set(key, value); return form; }
beforeEach(() => { vi.stubEnv("QUEUE_JOIN_SECRET", "local_test_secret_only_32_characters_long"); mocks.headers.mockResolvedValue(new Headers()); mocks.rpc.mockResolvedValue({ data: "id", error: null }); });
describe("real inquiry outcome", () => {
  it("only redirects after persistence succeeds", async () => { await expect(submitInquiry({ error: "" }, data())).rejects.toThrow("redirect:/contact/thank-you"); expect(mocks.rpc).toHaveBeenCalledWith("submit_site_inquiry", expect.objectContaining({ p_name: "Ada", p_source_hash: expect.stringMatching(/^[a-f0-9]{64}$/) })); });
  it("keeps the form and shows an error when persistence fails", async () => { mocks.rpc.mockResolvedValue({ error: { code: "500" } }); expect(await submitInquiry({ error: "" }, data())).toEqual({ error: "Your inquiry could not be saved. Please try again." }); expect(mocks.redirect).not.toHaveBeenCalled(); });
  it("does not send invalid form fields to the database", async () => { const form = data(); form.set("email", "not an email"); expect((await submitInquiry({ error: "" }, form)).error).toContain("valid email"); expect(mocks.rpc).not.toHaveBeenCalled(); });
  it("reports rate limits without leaking database errors", async () => { mocks.rpc.mockResolvedValue({ error: { code: "P0001", message: "private" } }); expect((await submitInquiry({ error: "" }, data())).error).toContain("an hour"); });
});
