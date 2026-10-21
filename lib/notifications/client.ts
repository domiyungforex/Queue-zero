import type { WorkspaceNotificationSnapshot } from "@/lib/notifications/workspace";

export const WORKSPACE_NOTIFICATIONS_EVENT = "turnmark:workspace-notifications";

export function publishWorkspaceNotifications(snapshot: WorkspaceNotificationSnapshot) {
  window.dispatchEvent(new CustomEvent<WorkspaceNotificationSnapshot>(WORKSPACE_NOTIFICATIONS_EVENT, { detail: snapshot }));
}

