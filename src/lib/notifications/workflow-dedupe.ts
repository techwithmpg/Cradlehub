import type { CreateNotificationInput, CreateWorkflowTaskInput, NotificationDedupeInput, ResolveWorkflowTaskInput } from "./types";

export const OPEN_NOTIFICATION_STATUSES = ["unread", "read"] as const;
export const OPEN_TASK_STATUSES = ["open", "in_progress"] as const;

const ALLOWED_HREF_PREFIXES = [
  "/owner",
  "/manager",
  "/crm",
  "/staff-portal",
  "/driver",
  "/utility",
] as const;

function cleanSegment(value: string | null | undefined, fallback: string): string {
  return (value?.trim() || fallback).toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}

export function validateSignalHref(href: string | null | undefined): string | null {
  if (!href) return null;
  return ALLOWED_HREF_PREFIXES.some((prefix) => href === prefix || href.startsWith(`${prefix}/`))
    ? href
    : null;
}

export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export function buildNotificationDedupeKey(input: NotificationDedupeInput): string {
  const eventOrTask = input.eventType ?? input.taskType ?? "signal";
  const recipient = input.recipientStaffId
    ? `staff.${input.recipientStaffId}`
    : `role.${input.recipientRole ?? input.workspaceScope}`;

  return [
    cleanSegment(input.entityType, "global"),
    cleanSegment(input.entityId, "none"),
    cleanSegment(eventOrTask, "signal"),
    cleanSegment(recipient, "workspace"),
    cleanSegment(input.workspaceScope, "workspace"),
    cleanSegment(input.branchId, "global"),
  ].join(":");
}

export function notificationDedupeKey(input: CreateNotificationInput): string {
  return input.dedupeKey ?? buildNotificationDedupeKey({
    branchId: input.branchId,
    workspaceScope: input.targetWorkspace,
    recipientStaffId: input.recipientStaffId,
    recipientRole: input.targetRole,
    eventType: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
  });
}

export function taskDedupeKey(input: CreateWorkflowTaskInput | ResolveWorkflowTaskInput): string {
  return input.dedupeKey ?? buildNotificationDedupeKey({
    branchId: input.branchId,
    workspaceScope: input.workspaceScope,
    recipientStaffId: input.assignedToStaffId,
    recipientRole: input.assignedToRole,
    taskType: input.taskType,
    entityType: input.entityType,
    entityId: input.entityId,
  });
}
