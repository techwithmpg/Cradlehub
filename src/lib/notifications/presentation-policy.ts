import type { WorkspaceNotification } from "./types";

/**
 * A popup is a temporary presentation, not an authorization or task-state transition.
 * Non-urgent updates stay in the bell. Shared action state remains server-owned.
 */
export function shouldPresentActionPopup(
  notification: Pick<WorkspaceNotification, "status" | "requires_action" | "priority">
): boolean {
  return notification.status === "unread" &&
    notification.requires_action === true &&
    (notification.priority === "high" || notification.priority === "critical");
}

/** Read/dismissed is not resolved. Open operational work cannot be dismissed by one viewer. */
export function canDismissNotification(
  notification: Pick<WorkspaceNotification, "requires_action" | "status">
): boolean {
  return !notification.requires_action &&
    (notification.status === "unread" || notification.status === "read");
}
