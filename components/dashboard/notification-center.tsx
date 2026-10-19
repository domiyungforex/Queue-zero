"use client";

import Link from "next/link";
import { Bell, BellRing, CheckCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { getRealtimeClient } from "@/lib/realtime/use-live";
import type { WorkspaceNotificationSnapshot } from "@/lib/notifications/workspace";
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
  const mobileViewport = useMobileViewport();
  const enabled = variant === "mobile" ? mobileViewport : !mobileViewport;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/workspace-notifications", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error();
      const next = await response.json() as WorkspaceNotificationSnapshot;
      if (mounted.current) { setSnapshot(next); setError(""); }
    } catch {
      if (mounted.current) setError("Notifications couldn’t be refreshed.");
    }
  }, []);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    let stopped = false;
    let channel: ReturnType<NonNullable<ReturnType<typeof getRealtimeClient>>["channel"]> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const client = enabled ? getRealtimeClient(true) : null;
    const resync = () => { if (!stopped) void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") resync(); };

    async function connect() {
      if (!client || stopped) return;
      try {
        await client.realtime.setAuth();
        if (stopped) return;
        channel = client.channel(`notifications:${businessId}:${userId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "workspace_notifications", filter: `business_id=eq.${businessId}` }, resync)
          .subscribe((status) => {
            if (stopped) return;
            const subscribed = status === "SUBSCRIBED";
            setLive(subscribed);
            if (subscribed) resync();
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              clearTimeout(retry);
              retry = setTimeout(() => setReconnect((value) => value + 1), 2_000);
            }
          });
      } catch {
        if (!stopped) {
          setLive(false);
          retry = setTimeout(() => setReconnect((value) => value + 1), 2_000);
        }
      }
    }

    void connect();
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(retry);
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", visible);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [businessId, userId, enabled, refresh, reconnect]);

  const markRead = (notificationId?: string) => {
    setSnapshot((current) => ({
      unread: notificationId ? Math.max(0, current.unread - (current.items.find((item) => item.id === notificationId)?.read ? 0 : 1)) : 0,
      items: current.items.map((item) => !notificationId || item.id === notificationId ? { ...item, read: true } : item),
    }));
    startTransition(async () => {
      const response = await fetch("/api/workspace-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationId ? { notificationId } : {}),
      });
      if (!response.ok) setError("We couldn’t update notification status.");
      await refresh();
    });
  };

  const badge = snapshot.unread > 99 ? "99+" : String(snapshot.unread);
  return <div className={styles.root} data-open={open || undefined}>
    <button className={styles.trigger} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" aria-label={`Notifications${snapshot.unread ? `, ${snapshot.unread} unread` : ""}`}>
      {snapshot.unread ? <BellRing size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}
      {snapshot.unread ? <span className={styles.badge} aria-hidden="true">{badge}</span> : null}
    </button>
    {open ? <section className={styles.panel} role="dialog" aria-modal="false" aria-label="Notifications">
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
