import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: mocks.userId }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));
vi.mock("@/lib/env", () => ({
  publicEnv: {
    NEXT_PUBLIC_APP_URL: "https://turnmark.example",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
  },
}));
vi.mock("@/components/auth/auth-form", () => ({ AuthForm: () => null }));
vi.mock("@/components/auth/auth-shell", () => ({ AuthShell: () => null }));

import SignInPage from "@/app/(auth)/sign-in/[[...sign-in]]/page";
import SignUpPage from "@/app/(auth)/sign-up/[[...sign-up]]/page";

beforeEach(() => { mocks.userId = null; });

describe("authentication page routing", () => {
  it("renders account forms for signed-out visitors", async () => {
    expect(isValidElement(await SignInPage())).toBe(true);
    expect(isValidElement(await SignUpPage())).toBe(true);
  });

  it("sends an existing Clerk session directly to the dashboard", async () => {
    mocks.userId = "user_existing";
    await expect(SignInPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    await expect(SignUpPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("preserves a safe intended destination for an existing session", async () => {
    mocks.userId = "user_existing";
    await expect(SignInPage({ searchParams: Promise.resolve({ redirect_url: "/invitations/invite-token" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/invitations/invite-token");
    await expect(SignUpPage({ searchParams: Promise.resolve({ redirect_url: "https://attacker.example/steal" }) }))
      .rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });
});
