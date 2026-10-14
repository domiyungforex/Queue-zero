import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture" } }));
vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import AuthLayout from "@/app/(auth)/layout";

describe("authentication onboarding destination", () => {
  it("sends incomplete sign-ups to onboarding instead of the dashboard", () => {
    const layout = AuthLayout({ children: <p>Account</p> }) as ReactElement<{
      signInFallbackRedirectUrl: string;
      signUpFallbackRedirectUrl: string;
    }>;
    expect(isValidElement(layout)).toBe(true);
    expect(layout.props.signUpFallbackRedirectUrl).toBe("/onboarding");
    expect(layout.props.signInFallbackRedirectUrl).toBe("/dashboard");
  });
});
