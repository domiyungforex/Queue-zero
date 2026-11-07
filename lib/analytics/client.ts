"use client";

import posthog from "posthog-js";
import { ANALYTICS_EVENTS, safeAnalyticsProperties, type AnalyticsEvent, type AnalyticsProperties } from "./events";

let initialized = false;
let lastPageView = "";

function configured() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST);
}

export function initializeAnalytics() {
  if (typeof window === "undefined" || initialized || !configured()) return;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) return;

  try {
    posthog.init(token, {
      api_host: host,
      defaults: "2026-08-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      person_profiles: "identified_only",
      respect_dnt: true,
      ip: false,
      property_denylist: [
        "$current_url", "$pathname", "$referrer", "$initial_current_url",
        "$initial_pathname", "$initial_referrer", "$host", "$search",
      ],
    });
    initialized = true;
  } catch {
    // Analytics is optional and must never affect product functionality.
  }
}

export function captureAnalytics(event: AnalyticsEvent, properties?: AnalyticsProperties) {
  if (!initialized || !configured()) return;
  try {
    posthog.capture(event, safeAnalyticsProperties(properties));
  } catch {
    // Ignore SDK/runtime failures; product actions have already completed.
  }
}

export function identifyAnalyticsUser(userId: string) {
  if (!initialized || !configured() || !userId) return;
  try {
    posthog.identify(userId);
  } catch {
    // Identity analytics is best-effort.
  }
}

export function resetAnalyticsIdentity() {
  if (!initialized || !configured()) return;
  try {
    posthog.reset();
  } catch {
    // Logout must never depend on analytics.
  }
}

function safePath(pathname: string) {
  return pathname.split("/").map((segment) => {
    if (!segment) return segment;
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ":id";
    if (segment.length >= 24 && /^[A-Za-z0-9_-]+$/.test(segment)) return ":token";
    return segment;
  }).join("/");
}

export function capturePageView(pathname: string) {
  if (!initialized || !configured() || typeof window === "undefined") return;
  const path = safePath(pathname || "/");
  const current = `${window.location.origin}${path}`;
  if (current === lastPageView) return;
  lastPageView = current;

  const isPrivate = /^\/(dashboard|onboarding|attend|q|display|api)(\/|$)/.test(path);
  try {
    posthog.capture("$pageview", {
      page_path: path,
      page_category: isPrivate ? "application" : "marketing",
      $current_url: current,
    });
    if (!isPrivate) {
      captureAnalytics(ANALYTICS_EVENTS.marketingPageViewed, {
        page_path: path,
        page_category: "marketing",
      });
      if (path === "/pricing") captureAnalytics(ANALYTICS_EVENTS.pricingViewed, { page_path: path, page_category: "marketing" });
    }
  } catch {
    // Page rendering and navigation must not depend on analytics.
  }
}
