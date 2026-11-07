import { capturePageView, initializeAnalytics } from "@/lib/analytics/client";

initializeAnalytics();

if (typeof window !== "undefined") {
  capturePageView(window.location.pathname);
}

/**
 * Next.js App Router hook. We capture manually so private query strings and
 * opaque ticket/attendance tokens never enter pageview URLs.
 */
export function onRouterTransitionStart(url: string) {
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    capturePageView(pathname);
  } catch {
    // Ignore malformed navigation URLs.
  }
}
