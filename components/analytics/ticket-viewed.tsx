"use client";

import { useEffect, useRef } from "react";
import { captureAnalytics } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export function TicketViewedAnalytics() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    captureAnalytics(ANALYTICS_EVENTS.customerTicketViewed);
  }, []);
  return null;
}
