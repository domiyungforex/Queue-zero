"use client";
import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

/** Broadcast invalidates; HTTP always supplies authoritative state. */
export function useLive(topic: string, onChange: () => void, authenticated = false, enabled = true) {
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | undefined;
    const refresh = () => {
      if (stopped) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => callback.current(), 180);
    };
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const client = url && key ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      accessToken: authenticated ? async () => {
        const response = await fetch("/api/realtime", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error("Live session unavailable");
        const data: unknown = await response.json();
        if (typeof data !== "object" || data === null || !("token" in data) || typeof data.token !== "string") {
          throw new Error("Live session unavailable");
        }
        return data.token;
      } : undefined,
    }) : null;

    async function connect() {
      if (!client || stopped || channel) return;
      try {
        // Obtain the verified identity before requesting access to a private staff topic.
        if (authenticated) await client.realtime.setAuth();
        if (stopped || channel) return;
        channel = client.channel(topic, { config: { private: true } })
          .on("broadcast", { event: "changed" }, refresh)
          .subscribe(status => {
            if (stopped) return;
            setConnected(status === "SUBSCRIBED");
            if (status === "SUBSCRIBED") refresh();
          });
      } catch {
        if (!stopped) setConnected(false);
      }
    }
    void connect();
    // Reconnect, tab focus and bounded polling recover lost events or initial auth failure.
    const interval = setInterval(() => { refresh(); void connect(); }, 15_000);
    const visibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visibility);
    const renew = authenticated ? setInterval(() => {
      void client?.realtime.setAuth().catch(() => { if (!stopped) setConnected(false); });
    }, 45_000) : null;
    return () => {
      stopped = true;
      clearInterval(interval);
      if (renew) clearInterval(renew);
      clearTimeout(debounce);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visibility);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [topic, authenticated, enabled]);
  return connected;
}
