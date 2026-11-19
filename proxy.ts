import { clerkMiddleware } from "@clerk/nextjs/server";
import { getClerkServerEnv } from "@/lib/auth/env";
import { publicEnv } from "@/lib/env";

export default clerkMiddleware(
  async (auth, request) => {
    const { pathname } = request.nextUrl;
    // Staff workspaces stay behind Clerk. Student attendance, queue tickets and
    // public displays must remain reachable with no account.
    const staffOnly = pathname === "/dashboard" || pathname.startsWith("/dashboard/")
      || pathname === "/onboarding" || pathname.startsWith("/onboarding/");
    const studentPath = pathname === "/attend" || pathname.startsWith("/attend/")
      || pathname.startsWith("/q/") || pathname.startsWith("/ticket/")
      || pathname.startsWith("/book/") || pathname.startsWith("/booking/")
      || pathname.startsWith("/display/");
    if (staffOnly && !studentPath) await auth.protect();
  },
  () => {
    // Clerk reads the secret directly from the server environment. Passing it
    // as a dynamic option unnecessarily requires encrypted header propagation.
    getClerkServerEnv();
    return {
      publishableKey: publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      authorizedParties: [new URL(publicEnv.NEXT_PUBLIC_APP_URL).origin],
    };
  },
);

export const config = {
  matcher: [
    // Run on application routes, excluding Next internals and static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk production auto-proxy serves JavaScript through this route.
    "/__clerk/(.*)",
  ],
};
