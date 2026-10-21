"use client";

import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { WorkspaceNotificationSnapshot } from "@/lib/notifications/workspace";
import { publishWorkspaceNotifications, WORKSPACE_NOTIFICATIONS_EVENT } from "@/lib/notifications/client";
import styles from "./notification-inbox.module.css";

function notificationTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function NotificationInbox({ initial, initialError = "" }: { initial: WorkspaceNotificationSnapshot; initialError?: string }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState(initialError);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/workspace-notifications", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error();
      const next = await response.json() as WorkspaceNotificationSnapshot;
      setSnapshot(next);
      setError("");
      publishWorkspaceNotifications(next);
    } catch {
      setError("We couldn’t load your notifications.");
    }
  }, []);

  useEffect(() => {
    const sync = (event: Event) => {
      setSnapshot((event as CustomEvent<WorkspaceNotificationSnapshot>).detail);
      setError("");
    };
    window.addEventListener(WORKSPACE_NOTIFICATIONS_EVENT, sync);
    return () => window.removeEventListener(WORKSPACE_NOTIFICATIONS_EVENT, sync);
  }, []);

  const markRead = (notificationId?: string) => {
    const next = {
      unread: notificationId ? Math.max(0, snapshot.unread - (snapshot.items.find((item) => item.id === notificationId)?.read ? 0 : 1)) : 0,
      items: snapshot.items.map((item) => !notificationId || item.id === notificationId ? { ...item, read: true } : item),
    };
    setSnapshot(next);
    publishWorkspaceNotifications(next);
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

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div><p>NOTIFICATIONS</p><h1>Notifications</h1><span>Workspace updates and activity.</span></div>
      {snapshot.unread ? <button type="button" disabled={pending} onClick={() => markRead()}><CheckCheck size={18} aria-hidden="true" />Mark all read</button> : null}
    </header>
    {error ? <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />Try again</button></div> : null}
    {snapshot.items.length ? <section className={styles.list} aria-label="Notification history">
      {snapshot.items.map((item) => <article key={item.id} data-unread={!item.read || undefined}>
        <span className={styles.icon} aria-hidden="true"><Bell size={19} /></span>
        <div className={styles.copy}><div><strong>{item.title}</strong>{!item.read ? <span>New</span> : null}</div><p>{item.message}</p><time dateTime={item.created_at}>{notificationTime(item.created_at)}</time></div>
        <div className={styles.actions}>{item.href ? <Link href={item.href} onClick={() => { if (!item.read) markRead(item.id); }}>Open<ExternalLink size={14} aria-hidden="true" /></Link> : null}{!item.read ? <button type="button" disabled={pending} onClick={() => markRead(item.id)}>Mark read</button> : null}</div>
      </article>)}
    </section> : <section className={styles.empty}><span><Bell size={28} aria-hidden="true" /></span><h2>No notifications yet</h2><p>Updates for this workspace will appear here as they happen.</p></section>}
  </main>;
}

