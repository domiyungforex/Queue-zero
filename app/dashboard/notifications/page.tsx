import { NotificationInbox } from "@/components/dashboard/notification-inbox";
import { getWorkspaceNotificationSnapshot } from "@/lib/notifications/workspace";

export default async function NotificationsPage() {
  const result = await getWorkspaceNotificationSnapshot()
    .then((initial) => ({ initial, initialError: "" }))
    .catch(() => ({ initial: { unread: 0, items: [] }, initialError: "We couldn’t load your notifications." }));
  return <NotificationInbox {...result} />;
}

