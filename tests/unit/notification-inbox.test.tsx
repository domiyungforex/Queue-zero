// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationInbox } from "@/components/dashboard/notification-inbox";

const initial = {
  unread: 1,
  items: [{ id: "10000000-0000-4000-8000-000000000001", type: "school_open", title: "Attendance opened", message: "Students can now record attendance for this class.", href: "/dashboard/attendance/10000000-0000-4000-8000-000000000002", created_at: "2026-10-19T12:00:00Z", read: false }],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...initial, unread: 0, items: initial.items.map((item) => ({ ...item, read: true })) }) }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("notification inbox", () => {
  it("renders real workspace notifications and marks all read", async () => {
    render(<NotificationInbox initial={initial} />);
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByText("Attendance opened")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(screen.queryByText("New")).toBeNull();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/workspace-notifications", expect.objectContaining({ method: "POST" })));
  });

  it("shows a useful empty state", () => {
    render(<NotificationInbox initial={{ unread: 0, items: [] }} />);
    expect(screen.getByRole("heading", { name: "No notifications yet" })).toBeTruthy();
  });
});

