// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signOut: vi.fn(), reset: vi.fn(), sync: vi.fn(), session: "session-first" }));
vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  ClerkLoaded: ({ children }: { children: React.ReactNode }) => children,
  ClerkLoading: () => null,
  ClerkFailed: () => null,
  Show: ({ when, children }: { when: string; children: React.ReactNode }) => when === "signed-in" ? children : null,
  useClerk: () => ({ signOut: mocks.signOut }),
  useAuth: () => ({ isLoaded: true, sessionId: mocks.session }),
}));
vi.mock("@/lib/realtime/client", () => ({ resetAuthenticatedRealtime: mocks.reset, syncRealtimeSession: mocks.sync }));
import { AuthNavigation } from "@/components/auth/auth-navigation";

beforeEach(() => { vi.clearAllMocks(); mocks.session = "session-first"; mocks.signOut.mockResolvedValue(undefined); });
afterEach(cleanup);
it("observes Clerk session changes in the existing account controls", () => {
  const view = render(<AuthNavigation />);
  expect(mocks.sync).toHaveBeenLastCalledWith("session-first");
  mocks.session = "session-replacement";
  view.rerender(<AuthNavigation />);
  expect(mocks.sync).toHaveBeenLastCalledWith("session-replacement");
});
it("clears realtime before sign-out and lets a failed sign-out be retried", async () => {
  mocks.signOut.mockRejectedValueOnce(new Error("provider unavailable"));
  render(<AuthNavigation />);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("alert");
  expect(mocks.reset).toHaveBeenCalledOnce();
  expect(mocks.reset.mock.invocationCallOrder[0]).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0]);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(2));
  expect(mocks.signOut).toHaveBeenLastCalledWith({ redirectUrl: "/" });
});
