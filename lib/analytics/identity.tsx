"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { identifyAnalyticsUser, resetAnalyticsIdentity } from "./client";

export function ClerkAnalyticsIdentity() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && userId) {
      if (previousUserId.current !== userId) identifyAnalyticsUser(userId);
      previousUserId.current = userId;
      return;
    }
    if (previousUserId.current) {
      resetAnalyticsIdentity();
      previousUserId.current = null;
    }
  }, [isLoaded, isSignedIn, userId]);

  return null;
}

export function ServerResolvedAnalyticsIdentity({ userId }: { userId: string }) {
  const previousUserId = useRef<string | null>(null);
  useEffect(() => {
    if (userId && previousUserId.current !== userId) identifyAnalyticsUser(userId);
    previousUserId.current = userId;
  }, [userId]);
  return null;
}
