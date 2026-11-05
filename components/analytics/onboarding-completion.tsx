"use client";

import { useEffect, useRef } from "react";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export function OnboardingCompletionAnalytics({ accountType, workspaceType }: {
  accountType: "INDIVIDUAL" | "ORGANIZATION";
  workspaceType: "INDIVIDUAL" | "ORGANIZATION";
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const properties = { account_type: accountType, workspace_type: workspaceType };
    captureAnalytics(ANALYTICS_EVENTS.workspaceCreated, properties);
    captureAnalytics(ANALYTICS_EVENTS.onboardingCompleted, properties);
  }, [accountType, workspaceType]);
  return null;
}
