import { beforeEach, describe, expect, it, vi } from "vitest";

const { protect } = vi.hoisted(() => ({ protect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: { protect } }));

import { requireUserId } from "@/lib/auth/server";

describe("server authentication", () => {
  beforeEach(() => {
    protect.mockReset();
  });

  it("returns only the verified Clerk user ID", async () => {
    protect.mockResolvedValue({ userId: "user_verified", sessionId: "session_private" });
    await expect(requireUserId()).resolves.toBe("user_verified");
    expect(protect).toHaveBeenCalledOnce();
  });

  it("preserves Clerk's redirect for an unauthenticated request", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    protect.mockRejectedValue(redirect);
    await expect(requireUserId()).rejects.toBe(redirect);
  });

  it("fails closed when session verification fails", async () => {
    const failure = new Error("Session verification failed");
    protect.mockRejectedValue(failure);
    await expect(requireUserId()).rejects.toBe(failure);
  });
});
