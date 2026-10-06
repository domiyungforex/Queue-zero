// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), search: new URLSearchParams(), auth: { isLoaded: true, isSignedIn: false } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.search }));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mocks.auth,
  SignIn: (props: Record<string, unknown>) => <div data-testid="sign-in" data-props={JSON.stringify(props)} />,
  SignUp: (props: Record<string, unknown>) => <div data-testid="sign-up" data-props={JSON.stringify(props)} />,
}));
import { AuthForm } from "@/components/auth/auth-form";
beforeEach(() => {
  mocks.replace.mockReset();
  mocks.search = new URLSearchParams("redirect_url=%2Fattend%3Ftoken%3Dopaque-token");
  mocks.auth = { isLoaded: true, isSignedIn: false };
});
afterEach(cleanup);
describe("generic Clerk authentication shell", () => {
  it("preserves a safe return path while delegating sign-in to Clerk", () => {
    render(<AuthForm mode="sign-in" />);
    const props = JSON.parse(screen.getByTestId("sign-in").getAttribute("data-props")!);
    expect(props.forceRedirectUrl).toBe("/attend?token=opaque-token");
    expect(props.fallbackRedirectUrl).toBe("/attend?token=opaque-token");
    expect(props.signUpUrl).toBe("/sign-up?redirect_url=%2Fattend%3Ftoken%3Dopaque-token");
  });
  it("delegates sign-up to Clerk without student-specific authentication", () => {
    render(<AuthForm mode="sign-up" />);
    const props = JSON.parse(screen.getByTestId("sign-up").getAttribute("data-props")!);
    expect(props.forceRedirectUrl).toBe("/attend?token=opaque-token");
    expect(props.path).toBe("/sign-up");
  });
  it("rejects external return URLs and falls back to the normal workspace", () => {
    mocks.search = new URLSearchParams("redirect_url=https%3A%2F%2Fevil.example");
    render(<AuthForm mode="sign-in" />);
    const props = JSON.parse(screen.getByTestId("sign-in").getAttribute("data-props")!);
    expect(props.forceRedirectUrl).toBe("/dashboard");
  });
  it("redirects an already signed-in account instead of rendering auth again", async () => {
    mocks.auth = { isLoaded: true, isSignedIn: true };
    render(<AuthForm mode="sign-in" />);
    expect(screen.getByRole("status").textContent).toContain("Opening your workspace");
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/attend?token=opaque-token"));
  });
  it("shows a loading state until Clerk is ready", () => {
    mocks.auth = { isLoaded: false, isSignedIn: false };
    render(<AuthForm mode="sign-in" />);
    expect(screen.getByRole("status").textContent).toContain("Loading secure account access");
  });
});
