import type { WorkspaceNotification } from "@/lib/notifications/types";

export function isUnreadNotification(notification: Pick<WorkspaceNotification, "status">): boolean {
  return notification.status === "unread";
}

export function notificationUnreadDelta(
  previousStatus: WorkspaceNotification["status"] | null | undefined,
  nextStatus: WorkspaceNotification["status"]
): number {
  if (!previousStatus) return 0;
  if (previousStatus === "unread" && nextStatus !== "unread") return -1;
  if (previousStatus !== "unread" && nextStatus === "unread") return 1;
  return 0;
}

export function upsertNotificationItems(
  items: WorkspaceNotification[],
  notification: WorkspaceNotification,
  limit = 20
): WorkspaceNotification[] {
  return [notification, ...items.filter((item) => item.id !== notification.id)]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit);
}
