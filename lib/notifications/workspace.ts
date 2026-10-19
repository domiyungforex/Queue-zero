import "server-only";
import { z } from "zod";
import { requireBusinessMembership } from "@/lib/business/membership";
import { createUserSupabaseClient } from "@/lib/db/server";

const notificationSchema = z.object({
  id: z.uuid(),
  type: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(240),
  href: z.string().startsWith("/").max(500).nullable(),
  created_at: z.iso.datetime({ offset: true }),
  read: z.boolean(),
});

export const workspaceNotificationSnapshotSchema = z.object({
  unread: z.number().int().nonnegative(),
  items: z.array(notificationSchema).max(50),
});

export type WorkspaceNotificationSnapshot = z.infer<typeof workspaceNotificationSnapshotSchema>;

export async function getWorkspaceNotificationSnapshot(): Promise<WorkspaceNotificationSnapshot> {
  const membership = await requireBusinessMembership();
  const db = await createUserSupabaseClient();
  const { data, error } = await db.rpc("workspace_notification_snapshot", {
    p_business_id: membership.businessId,
    p_limit: 30,
  });
  if (error) throw new Error("Notifications could not be loaded.");
  const parsed = workspaceNotificationSnapshotSchema.safeParse(data);
  if (!parsed.success) throw new Error("Notifications are temporarily unavailable.");
  return parsed.data;
}

export async function markWorkspaceNotificationsRead(notificationId?: string) {
  const membership = await requireBusinessMembership();
  const id = notificationId ? z.uuid().parse(notificationId) : null;
  const db = await createUserSupabaseClient();
  const { error } = await db.rpc("mark_workspace_notifications_read", {
    p_business_id: membership.businessId,
    p_notification_id: id ?? undefined,
  });
  if (error) throw new Error("Notifications could not be updated.");
}
