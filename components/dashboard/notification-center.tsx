"use client";

import Link from "next/link";
import { Bell, BellRing, CheckCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { acquireRealtimeClient } from "@/lib/realtime/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { WorkspaceNotificationSnapshot } from "@/lib/notifications/workspace";
import { publishWorkspaceNotifications, WORKSPACE_NOTIFICATIONS_EVENT } from "@/lib/notifications/client";
import styles from "./notification-center.module.css";

function notificationTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function subscribeMobile(callback: () => void) {
  const query = window.matchMedia("(max-width: 720px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useMobileViewport() {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 720px)").matches, () => false);
}

export function NotificationCenter({ businessId, userId, initial, variant }: { businessId: string; userId: string; initial: WorkspaceNotificationSnapshot; variant: "desktop" | "mobile" }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [reconnect, setReconnect] = useState(0);
  const [pending, startTransition] = useTransition();
  const mounted = useRef(true);
  const requests = useRef<{ inFlight: Promise<void> | null; dirty: boolean; controller: AbortController | null; epoch: number; readVersion: number; pendingReads: number }>({ inFlight: null, dirty: false, controller: null, epoch: 0, readVersion: 0, pendingReads: 0 });
  const reconnectAttempt = useRef(0);
  const mobileViewport = useMobileViewport();
  const enabled = variant === "mobile" ? mobileViewport : !mobileViewport;

  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    const state = requests.current;
    state.dirty = true;
    if (state.inFlight) return state.inFlight;
    if (state.pendingReads) return;
    const epoch = state.epoch;
    const current = () => mounted.current && state.epoch === epoch;
    state.inFlight = (async () => {
      do {
        state.dirty = false;
        const readVersion = state.readVersion;
        const controller = new AbortController();
        state.controller = controller;
        try {
          const response = await fetch("/api/workspace-notifications", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
          if (!response.ok) throw new Error();
          const next = await response.json() as WorkspaceNotificationSnapshot;
          if (current() && readVersion === state.readVersion) { setSnapshot(next); setError(""); publishWorkspaceNotifications(next); }
        } catch {
          if (current()) setError("Notifications couldn’t be refreshed.");
        }
        // Events received during a request need one subsequent authoritative read.
        // An older response must not overwrite an optimistic mark-read change.
      } while (current() && state.dirty && !state.pendingReads);
    })().finally(() => {
      if (state.epoch === epoch) { state.inFlight = null; state.controller = null; }
    });
    return state.inFlight;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const state = requests.current;
    return () => {
      mounted.current = false;
      state.epoch++;
      state.controller?.abort();
      state.inFlight = null;
      state.dirty = false;
      state.pendingReads = 0;
    };
  }, [businessId, userId]);

  useEffect(() => {
    const sync = (event: Event) => setSnapshot((event as CustomEvent<WorkspaceNotificationSnapshot>).detail);
    window.addEventListener(WORKSPACE_NOTIFICATIONS_EVENT, sync);
    return () => window.removeEventListener(WORKSPACE_NOTIFICATIONS_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let subscribed = false;
    let generation = 0;
    let channel: RealtimeChannel | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const lease = acquireRealtimeClient(true, () => {
      if (stopped) return;
      generation++;
      subscribed = false;
      setLive(false);
      const staleChannel = channel;
      channel = undefined;
      if (client && staleChannel) void client.removeChannel(staleChannel);
      scheduleRetry();
    });
    const client = lease?.client;
    const resync = () => { if (!stopped && document.visibilityState !== "hidden" && navigator.onLine !== false) void refresh(); };
    const recover = () => {
      if (subscribed) {
        void lease?.authorize().then(resync).catch(() => {});
      } else resync();
      if (!stopped && !subscribed) {
        clearTimeout(retry);
        setReconnect((value) => value + 1);
      }
    };
    const visible = () => { if (document.visibilityState === "visible") recover(); };
    const scheduleRetry = () => {
      if (stopped || retry) return;
      const ceiling = Math.min(2_000 * 2 ** Math.min(reconnectAttempt.current, 5), 60_000);
      // Equal jitter avoids every affected browser reconnecting simultaneously.
      retry = setTimeout(() => {
        retry = undefined;
        if (stopped) return;
        if (document.visibilityState === "hidden" || navigator.onLine === false) { scheduleRetry(); return; }
        reconnectAttempt.current++;
        setReconnect((value) => value + 1);
      }, ceiling / 2 + Math.random() * ceiling / 2);
    };

    async function connect() {
      if (!client || stopped) return;
      const current = generation;
      try {
        await lease?.authorize();
        if (stopped || current !== generation) return;
        channel = client.channel(`notifications:${businessId}:${userId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "workspace_notifications", filter: `business_id=eq.${businessId}` }, resync)
          .subscribe((status) => {
            if (stopped || current !== generation) return;
            subscribed = status === "SUBSCRIBED";
            setLive(subscribed);
            if (subscribed) {
              clearTimeout(retry);
              retry = undefined;
              reconnectAttempt.current = 0;
              resync();
            }
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              scheduleRetry();
            }
          });
      } catch {
        if (!stopped) {
          setLive(false);
          scheduleRetry();
        }
      }
    }

    void connect();
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(retry);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", visible);
      if (client && channel) void client.removeChannel(channel);
      lease?.release();
    };
  }, [businessId, userId, enabled, refresh, reconnect]);

  const markRead = (notificationId?: string) => {
    const state = requests.current;
    const epoch = state.epoch;
    state.readVersion++;
    state.pendingReads++;
    setSnapshot((current) => ({
      unread: notificationId ? Math.max(0, current.unread - (current.items.find((item) => item.id === notificationId)?.read ? 0 : 1)) : 0,
      items: current.items.map((item) => !notificationId || item.id === notificationId ? { ...item, read: true } : item),
    }));
    startTransition(async () => {
      try {
        const response = await fetch("/api/workspace-notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notificationId ? { notificationId } : {}),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error();
      } catch {
        if (mounted.current && state.epoch === epoch) setError("We couldn’t update notification status.");
      } finally {
        if (mounted.current && state.epoch === epoch) { state.pendingReads--; await refresh(); }
      }
    });
  };

  const badge = snapshot.unread > 99 ? "99+" : String(snapshot.unread);
  return <div className={styles.root} data-open={open || undefined}>
    {variant === "mobile" ? <Link className={styles.trigger} href="/dashboard/notifications" aria-label={`Notifications${snapshot.unread ? `, ${snapshot.unread} unread` : ""}`}>
      {snapshot.unread ? <BellRing size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}
      {snapshot.unread ? <span className={styles.badge} aria-hidden="true">{badge}</span> : null}
    </Link> : <button className={styles.trigger} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" aria-label={`Notifications${snapshot.unread ? `, ${snapshot.unread} unread` : ""}`}>
      {snapshot.unread ? <BellRing size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}
      {snapshot.unread ? <span className={styles.badge} aria-hidden="true">{badge}</span> : null}
    </button>}
    {variant === "desktop" && open ? <section className={styles.panel} role="dialog" aria-modal="false" aria-label="Notifications">
      <header><div><h2>Notifications</h2><p><span data-live={live || undefined} />{live ? "Live updates" : "Reconnecting…"}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={19} /></button></header>
      {snapshot.unread ? <button className={styles.markAll} type="button" disabled={pending} onClick={() => markRead()}><CheckCheck size={16} />Mark all read</button> : null}
      {error ? <p className={styles.error} role="alert">{error}<button type="button" onClick={() => void refresh()}>Try again</button></p> : null}
      {snapshot.items.length ? <ul>{snapshot.items.map((item) => <li key={item.id} data-unread={!item.read || undefined}>
        <span className={styles.dot} aria-hidden="true" />
        <div><strong>{item.title}</strong><p>{item.message}</p><time dateTime={item.created_at}>{notificationTime(item.created_at)}</time></div>
        {item.href ? <Link href={item.href} onClick={() => { if (!item.read) markRead(item.id); setOpen(false); }}>View<span className="sr-only"> {item.title}</span></Link> : !item.read ? <button type="button" onClick={() => markRead(item.id)}>Mark read</button> : null}
      </li>)}</ul> : <div className={styles.empty}><Bell size={25} aria-hidden="true" /><h3>No notifications yet</h3><p>Workspace updates will appear here.</p></div>}
    </section> : null}
  </div>;
}
