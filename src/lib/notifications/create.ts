import "server-only";

import type { CreateNotificationInput, NotificationWorkspace } from "./types";
import { createOrUpdateNotification, markNotificationResolved } from "./workflow-signals";
import { logError } from "@/lib/logger";

// Fire-and-forget: logs errors but never throws so a notification failure
// never rolls back the caller's main operation.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await createOrUpdateNotification(input);
  } catch (err) {
    logError("notification.create_failed", { type: input.type, error: err });
  }
}

export async function createStaffNotification(
  input: Omit<CreateNotificationInput, "targetWorkspace"> & {
    recipientStaffId: string;
  }
): Promise<void> {
  await createNotification({ ...input, targetWorkspace: "staff" });
}

// Resolve (close) all unread/action-required notifications for a given entity.
export async function resolveNotificationsForEntity(
  entityType: string,
  entityId: string,
  targetWorkspace?: NotificationWorkspace,
  type?: CreateNotificationInput["type"]
): Promise<void> {
  try {
    await markNotificationResolved({ entityType, entityId, targetWorkspace, type });
  } catch (err) {
    logError("notification.resolve_failed", { entityType, entityId, error: err });
  }
}
