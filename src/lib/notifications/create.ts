import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateNotificationInput, NotificationWorkspace } from "./types";

const ALLOWED_HREF_PREFIXES = [
  "/owner",
  "/manager",
  "/crm",
  "/staff-portal",
  "/driver",
  "/utility",
];

function validateHref(href: string | null | undefined): string | null {
  if (!href) return null;
  if (ALLOWED_HREF_PREFIXES.some((p) => href === p || href.startsWith(p + "/"))) {
    return href;
  }
  return null;
}

// Fire-and-forget: logs errors but never throws so a notification failure
// never rolls back the caller's main operation.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const admin = createAdminClient();

    if (input.entityType && input.entityId) {
      let existingQuery = admin
        .from("workspace_notifications")
        .select("id")
        .eq("target_workspace", input.targetWorkspace)
        .eq("type", input.type)
        .eq("entity_type", input.entityType)
        .eq("entity_id", input.entityId)
        .in("status", ["unread", "read"]);

      existingQuery = input.branchId
        ? existingQuery.eq("branch_id", input.branchId)
        : existingQuery.is("branch_id", null);

      existingQuery = input.recipientStaffId
        ? existingQuery.eq("recipient_staff_id", input.recipientStaffId)
        : existingQuery.is("recipient_staff_id", null);

      const { data: existing, error: existingError } = await existingQuery.maybeSingle();

      if (!existingError && existing) {
        // Refresh timestamp so the same unresolved issue resurfaces as recent
        await admin
          .from("workspace_notifications")
          .update({ created_at: new Date().toISOString() })
          .eq("id", existing.id);
        return;
      }
    }

    const { error } = await admin.from("workspace_notifications").insert({
      branch_id:          input.branchId          ?? null,
      target_workspace:   input.targetWorkspace,
      target_role:        input.targetRole         ?? null,
      recipient_staff_id: input.recipientStaffId   ?? null,
      actor_staff_id:     input.actorStaffId       ?? null,
      type:               input.type,
      title:              input.title,
      body:               input.body               ?? null,
      entity_type:        input.entityType         ?? null,
      entity_id:          input.entityId           ?? null,
      action_href:        validateHref(input.actionHref),
      priority:           input.priority           ?? "normal",
      requires_action:    input.requiresAction     ?? false,
      metadata:           input.metadata           ?? {},
    });
    if (error) {
      console.error("[notifications] insert failed", { type: input.type, error: error.message });
    }
  } catch (err) {
    console.error("[notifications] unexpected error", err);
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
    const admin = createAdminClient();
    let query = admin
      .from("workspace_notifications")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .in("status", ["unread", "read"]);

    if (targetWorkspace) {
      query = query.eq("target_workspace", targetWorkspace);
    }

    if (type) {
      query = query.eq("type", type);
    }

    const { error } = await query;
    if (error) {
      console.error("[notifications] resolve failed", { entityType, entityId, error: error.message });
    }
  } catch (err) {
    console.error("[notifications] resolve unexpected error", err);
  }
}
