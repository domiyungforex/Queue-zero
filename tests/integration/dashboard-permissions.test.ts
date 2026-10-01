import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ memberships: vi.fn(), cookie: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.cookie }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, unstable_rethrow: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/business/membership", () => ({ getMemberships: mocks.memberships }));
import { switchBusiness } from "@/app/dashboard/actions";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => { mocks.memberships.mockResolvedValue([{ businessId: id }]); });
describe("business switch action", () => {
  it("rejects malformed and unowned business IDs without changing the cookie", async () => {
    for (const value of ["invalid", "00000000-0000-4000-8000-000000000002"]) {
      const form = new FormData(); form.set("businessId", value);
      expect((await switchBusiness({ error: "" }, form)).error).toBeTruthy();
    }
    expect(mocks.cookie).not.toHaveBeenCalled();
  });
  it("sets an HTTP-only preference only for a verified membership and returns to overview", async () => {
    const form = new FormData(); form.set("businessId", id);
    await expect(switchBusiness({ error: "" }, form)).rejects.toThrow("redirect:/dashboard");
    expect(mocks.cookie).toHaveBeenCalledWith("queuezero-business", id, expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard", "layout");
  });
});

it("returns a retryable failure when membership lookup fails", async () => {
  mocks.memberships.mockRejectedValueOnce(new Error("offline"));
  const form = new FormData(); form.set("businessId", id);
  expect((await switchBusiness({ error: "" }, form)).error).toContain("try again");
  expect(mocks.cookie).not.toHaveBeenCalled();
});
