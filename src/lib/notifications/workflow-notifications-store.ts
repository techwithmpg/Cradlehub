import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateNotificationInput, MarkNotificationResolvedInput } from "./types";
import {
  isUniqueViolation,
  notificationDedupeKey,
  OPEN_NOTIFICATION_STATUSES,
  validateSignalHref,
} from "./workflow-dedupe";
import { logError } from "@/lib/logger";

function notificationPayload(input: CreateNotificationInput, dedupeKey: string) {
  return {
    branch_id: input.branchId ?? null,
    target_workspace: input.targetWorkspace,
    target_role: input.targetRole ?? null,
    recipient_staff_id: input.recipientStaffId ?? null,
    actor_staff_id: input.actorStaffId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    action_href: validateSignalHref(input.actionHref),
    priority: input.priority ?? "normal",
    status: "unread",
    read_at: null,
    resolved_at: null,
    requires_action: input.requiresAction ?? false,
    dedupe_key: dedupeKey,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  };
}

export async function createOrUpdateNotification(input: CreateNotificationInput): Promise<void> {
  const admin = createAdminClient();
  const dedupeKey = notificationDedupeKey(input);
  const payload = notificationPayload(input, dedupeKey);
  const existing = await admin
    .from("workspace_notifications")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .in("status", [...OPEN_NOTIFICATION_STATUSES])
    .maybeSingle();

  if (existing.data) {
    const { error } = await admin.from("workspace_notifications").update(payload).eq("id", existing.data.id);
    if (error) logError("notification.update_failed", { type: input.type, error });
    return;
  }

  const { error } = await admin.from("workspace_notifications").insert(payload);
  if (!error) return;
  if (isUniqueViolation(error)) {
    await admin.from("workspace_notifications").update(payload).eq("dedupe_key", dedupeKey);
    return;
  }
  logError("notification.insert_failed", { type: input.type, error });
}

export async function markNotificationResolved(input: MarkNotificationResolvedInput): Promise<void> {
  const admin = createAdminClient();
  let query = admin
    .from("workspace_notifications")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .in("status", [...OPEN_NOTIFICATION_STATUSES]);

  if (input.dedupeKey) query = query.eq("dedupe_key", input.dedupeKey);
  if (input.entityType) query = query.eq("entity_type", input.entityType);
  if (input.entityId) query = query.eq("entity_id", input.entityId);
  if (input.targetWorkspace) query = query.eq("target_workspace", input.targetWorkspace);
  if (input.type) query = query.eq("type", input.type);
  if (input.branchId) query = query.eq("branch_id", input.branchId);
  if (input.recipientStaffId) query = query.eq("recipient_staff_id", input.recipientStaffId);
  if (input.targetRole) query = query.eq("target_role", input.targetRole);

  const { error } = await query;
  if (error) logError("notification.resolve_failed", { error });
}
