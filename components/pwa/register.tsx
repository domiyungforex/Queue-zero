"use client";
import { useEffect } from "react";

export function RegisterWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => { /* Normal browser navigation remains available. */ });
    }
  }, []);
  return null;
}
