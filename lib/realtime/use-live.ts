"use client";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { acquireRealtimeClient } from "./client";

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
    let generation = 0;
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
    const lease = acquireRealtimeClient(authenticated, () => {
      if (stopped) return;
      generation++;
      subscribed = false;
      setConnected(false);
      const staleChannel = channel;
      channel = undefined;
      if (client && staleChannel) void client.removeChannel(staleChannel);
      scheduleFallback();
    });
    const client = lease?.client;

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
      const current = ++generation;
      try {
        // Obtain the verified identity before requesting access to a private staff topic.
        if (authenticated) await lease?.authorize();
        if (stopped || channel || current !== generation) return;
        channel = client.channel(topic, { config: { private: true } })
          .on("broadcast", { event: "changed" }, refresh)
          .subscribe(status => {
            if (stopped || current !== generation) return;
            subscribed = status === "SUBSCRIBED";
            setConnected(subscribed);
            if (subscribed) {
              clearTimeout(fallback);
              fallback = undefined;
              fallbackDelay = 15_000;
              refresh();
            } else {
              if (status === "CLOSED" && channel) {
                generation++;
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
    const recover = () => {
      void (async () => {
        if (authenticated && channel) {
          try { await lease?.authorize(); } catch { return; }
        }
        refresh();
        void connect();
      })();
    };
    const visibility = () => { if (document.visibilityState === "visible") recover(); };
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      clearTimeout(fallback);
      clearTimeout(debounce);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", visibility);
      if (client && channel) void client.removeChannel(channel);
      lease?.release();
    };
  }, [topic, authenticated, enabled]);
  return enabled && connected;
}
