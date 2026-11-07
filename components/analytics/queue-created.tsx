"use client";

import { useEffect, useRef } from "react";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export function QueueCreatedAnalytics({ saved }: { saved?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (saved !== "created" || sent.current) return;
    sent.current = true;
    captureAnalytics(ANALYTICS_EVENTS.queueCreated, { feature_name: "queue_management" });
  }, [saved]);
  return null;
}
