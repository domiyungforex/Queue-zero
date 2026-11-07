"use client";

import { useEffect, useRef } from "react";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export function WorkspaceAnalyticsContext({ workspaceKey, workspaceType, userRole }: {
  workspaceKey: string;
  workspaceType: "INDIVIDUAL" | "ORGANIZATION" | "BUSINESS" | "SCHOOL" | "HYBRID";
  userRole: string;
}) {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (!workspaceKey) return;
    captureAnalytics(previous.current ? ANALYTICS_EVENTS.workspaceSwitched : ANALYTICS_EVENTS.workspaceOpened, {
      workspace_type: workspaceType,
      user_role: userRole,
    });
    previous.current = workspaceKey;
  }, [workspaceKey, workspaceType, userRole]);
  return null;
}
