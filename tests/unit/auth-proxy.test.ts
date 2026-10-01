import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

type Handler = (
  auth: { protect: ReturnType<typeof vi.fn> },
  request: NextRequest,
) => Promise<void>;

const captured = vi.hoisted(() => ({ handler: undefined as Handler | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: vi.fn((handler: Handler) => {
    captured.handler = handler;
    return vi.fn();
  }),
}));

import { config } from "@/proxy";

describe("dashboard request protection", () => {
  it.each(["/dashboard", "/dashboard/queues", "/dashboard/queues/123", "/dashboard/settings"])(
    "requires authentication for %s",
    async (path) => {
      const protect = vi.fn().mockResolvedValue({ userId: "user_verified" });
      await captured.handler!({ protect }, new NextRequest(`http://localhost:3000${path}`));
      expect(protect).toHaveBeenCalledOnce();
    },
  );

  it("does not swallow an access denial", async () => {
    const denial = new Error("Unauthorized");
    const protect = vi.fn().mockRejectedValue(denial);
    await expect(captured.handler!({ protect }, new NextRequest("http://localhost:3000/dashboard"))).rejects.toBe(denial);
  });

  it.each(["/", "/sign-in", "/sign-up", "/sign-in/sso-callback", "/q/demo", "/ticket/opaque-token"])(
    "allows anonymous access to %s",
    async (path) => {
      const protect = vi.fn();
      await captured.handler!({ protect }, new NextRequest(`http://localhost:3000${path}`));
      expect(protect).not.toHaveBeenCalled();
    },
  );

  it.each(["/dashboard", "/dashboard/queues", "/sign-in/sso-callback", "/q/demo", "/ticket/token", "/api/example"])(
    "runs Clerk middleware on %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true),
  );

  it.each(["/_next/static/chunks/app.js", "/favicon.ico", "/icons/logo.png"])(
    "excludes static resource %s",
    (url) => expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false),
  );
});
