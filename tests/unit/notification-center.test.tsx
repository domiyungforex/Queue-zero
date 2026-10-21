// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setAuth: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() }));
const channel = { on: vi.fn(), subscribe: vi.fn() };
let changed: () => void;
let subscribed: (status: string) => void;

vi.mock("@/lib/realtime/use-live", () => ({
  getRealtimeClient: () => ({ realtime: { setAuth: mocks.setAuth }, channel: mocks.channel, removeChannel: mocks.removeChannel }),
}));

import { NotificationCenter } from "@/components/dashboard/notification-center";

const initial = {
  unread: 1,
  items: [{ id: "10000000-0000-4000-8000-000000000001", type: "school_open", title: "Attendance opened", message: "Students can now record attendance for this class.", href: "/dashboard/attendance/10000000-0000-4000-8000-000000000002", created_at: "2026-10-19T12:00:00Z", read: false }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  mocks.setAuth.mockResolvedValue(undefined);
  mocks.channel.mockReturnValue(channel);
  mocks.removeChannel.mockResolvedValue(undefined);
  channel.on.mockImplementation((_kind, _filter, handler) => { changed = handler; return channel; });
  channel.subscribe.mockImplementation((handler) => { subscribed = handler; return channel; });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => initial }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("workspace notification center", () => {
  it("subscribes to the active workspace, resyncs on events, and cleans up", async () => {
    const view = render(<NotificationCenter variant="desktop" businessId="20000000-0000-4000-8000-000000000001" userId="user_owner" initial={initial} />);
    await waitFor(() => expect(channel.subscribe).toHaveBeenCalled());
    await act(async () => { subscribed("SUBSCRIBED"); });
    expect(mocks.channel).toHaveBeenCalledWith("notifications:20000000-0000-4000-8000-000000000001:user_owner");
    expect(fetch).toHaveBeenCalledWith("/api/workspace-notifications", expect.objectContaining({ cache: "no-store" }));
    await act(async () => { changed(); });
    expect(fetch).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("shows real unread content and updates read state immediately", async () => {
    render(<NotificationCenter variant="desktop" businessId="20000000-0000-4000-8000-000000000001" userId="user_owner" initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    expect(screen.getByText("Attendance opened", { selector: "strong" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/workspace-notifications", expect.objectContaining({ method: "POST" })));
  });

  it("opens the dedicated notification inbox on mobile", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    render(<NotificationCenter variant="mobile" businessId="20000000-0000-4000-8000-000000000001" userId="user_owner" initial={initial} />);
    expect(screen.getByRole("link", { name: "Notifications, 1 unread" }).getAttribute("href")).toBe("/dashboard/notifications");
    expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull();
  });
});
