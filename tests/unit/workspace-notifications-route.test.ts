import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  snapshot: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/notifications/workspace", () => ({
  getWorkspaceNotificationSnapshot: mocks.snapshot,
  markWorkspaceNotificationsRead: mocks.markRead,
}));

import { GET, POST } from "@/app/api/workspace-notifications/route";

const post = (body: string) => POST(new Request("http://localhost/api/workspace-notifications", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_fixture" });
  mocks.snapshot.mockResolvedValue({ unread: 0, items: [] });
  mocks.markRead.mockResolvedValue(undefined);
});

describe("workspace notification API authorization", () => {
  it.each(["missing", "expired"])("returns 401 without touching notification data for a %s session", async (kind) => {
    if (kind === "missing") mocks.auth.mockResolvedValue({ userId: null });
    else mocks.auth.mockRejectedValue(new Error("provider session details"));

    const getResponse = await GET();
    const postResponse = await post("{}");

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(await getResponse.json()).toEqual({ error: "Sign in required" });
    expect(await postResponse.json()).toEqual({ error: "Sign in required" });
    expect(getResponse.headers.get("cache-control")).toContain("no-store");
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it("keeps authenticated reads and updates on the existing notification services", async () => {
    expect((await GET()).status).toBe(200);
    expect((await post("{}")).status).toBe(200);
    expect(mocks.snapshot).toHaveBeenCalledOnce();
    expect(mocks.markRead).toHaveBeenCalledWith(undefined);
  });
});
