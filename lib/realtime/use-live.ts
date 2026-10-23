"use client";
import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

type RealtimeClient = Pick<ReturnType<typeof createClient>, "channel" | "removeChannel" | "realtime">;
let publicClient: RealtimeClient | null | undefined;
let authenticatedClient: RealtimeClient | null | undefined;

export function getRealtimeClient(authenticated: boolean) {
  const existing = authenticated ? authenticatedClient : publicClient;
  if (existing !== undefined) return existing;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = url && key ? createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: authenticated ? "turnmark-realtime-staff" : "turnmark-realtime-public",
    },
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
  if (authenticated) authenticatedClient = client;
  else publicClient = client;
  return client;
}

/** Broadcast invalidates; HTTP always supplies authoritative state. */
export function useLive(topic: string, onChange: () => void, authenticated = false, enabled = true) {
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let subscribed = false;
    let connecting = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let fallbackDelay = 15_000;
    let channel: RealtimeChannel | undefined;
    const refresh = () => {
      if (stopped || document.visibilityState === "hidden" || debounce) return;
      // Coalesce bursts without postponing every refresh while events keep arriving.
      debounce = setTimeout(() => {
        debounce = undefined;
        if (!stopped && document.visibilityState !== "hidden") callback.current();
      }, 180);
    };
    const client = getRealtimeClient(authenticated);

    function scheduleFallback() {
      if (stopped || subscribed || fallback) return;
      fallback = setTimeout(() => {
        fallback = undefined;
        if (stopped || subscribed) return;
        if (document.visibilityState !== "hidden" && navigator.onLine !== false) {
          refresh();
          void connect();
          fallbackDelay = Math.min(fallbackDelay * 2, 60_000);
        }
        scheduleFallback();
      }, fallbackDelay + Math.floor(Math.random() * 3_000));
    }

    async function connect() {
      if (!client || stopped || channel || connecting) return;
      connecting = true;
      try {
        // Obtain the verified identity before requesting access to a private staff topic.
        if (authenticated) await client.realtime.setAuth();
        if (stopped || channel) return;
        channel = client.channel(topic, { config: { private: true } })
          .on("broadcast", { event: "changed" }, refresh)
          .subscribe(status => {
            if (stopped) return;
            subscribed = status === "SUBSCRIBED";
            setConnected(subscribed);
            if (subscribed) {
              clearTimeout(fallback);
              fallback = undefined;
              fallbackDelay = 15_000;
              refresh();
            } else {
              if (status === "CLOSED" && channel) {
                const closedChannel = channel;
                channel = undefined;
                void client.removeChannel(closedChannel);
              }
              scheduleFallback();
            }
          });
      } catch {
        if (!stopped) { subscribed = false; setConnected(false); scheduleFallback(); }
      } finally {
        connecting = false;
      }
    }
    void connect();
    // Poll only as an outage fallback. Healthy realtime and hidden tabs make no
    // periodic data requests; jitter/backoff avoids synchronized recovery bursts.
    scheduleFallback();
    const recover = () => { refresh(); void connect(); };
    const visibility = () => { if (document.visibilityState === "visible") recover(); };
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", visibility);
    const renew = authenticated ? setInterval(() => {
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
      void client?.realtime.setAuth().catch(() => {
        if (!stopped) {
          subscribed = false;
          setConnected(false);
          const staleChannel = channel;
          channel = undefined;
          if (client && staleChannel) void client.removeChannel(staleChannel);
          scheduleFallback();
        }
      });
    }, 45_000) : null;
    return () => {
      stopped = true;
      clearTimeout(fallback);
      if (renew) clearInterval(renew);
      clearTimeout(debounce);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", visibility);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [topic, authenticated, enabled]);
  return enabled && connected;
}
