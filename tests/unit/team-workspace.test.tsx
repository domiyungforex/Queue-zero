// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/settings/actions", () => ({
  saveTeamMember: vi.fn(),
  revokeTeamInvitation: vi.fn(),
}));

import { TeamWorkspace } from "@/components/team/team-workspace";

afterEach(cleanup);

describe("TeamWorkspace", () => {
  const members = [
    { id: "1", clerkUserId: "user_1", name: "Ada Lovelace", email: "ada@org.com", role: "owner" as const },
    { id: "2", clerkUserId: "user_2", name: "Grace Hopper", email: "grace@org.com", role: "manager" as const },
    { id: "3", clerkUserId: "user_3", name: "Alan Turing", email: "alan@org.com", role: "viewer" as const },
  ];

  const invitations = [
    {
      id: "inv-1",
      email: "newstaff@org.com",
      role: "STAFF",
      staffTitle: "Front Desk",
      status: "pending" as const,
      createdAt: "2026-11-20T10:00:00Z",
    },
  ];

  it("renders members, invitations, and filters by search query", () => {
    render(<TeamWorkspace members={members} invitations={invitations} actorRole="owner" />);

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Grace Hopper")).toBeTruthy();
    expect(screen.getByText("newstaff@org.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeTruthy();

    const search = screen.getByPlaceholderText("Search by name, email or role…");
    fireEvent.change(search, { target: { value: "Grace" } });

    expect(screen.getByText("Grace Hopper")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });
});
