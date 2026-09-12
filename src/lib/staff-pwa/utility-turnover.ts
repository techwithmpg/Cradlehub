import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";
import { resolveNotificationsForEntity } from "@/lib/notifications/create";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { logBusinessEvent, logError } from "@/lib/logger";
import type { Json } from "@/types/supabase";

export type TriggerTurnoverResult = {
  ok: boolean;
  taskId?: string;
  skippedReason?:
    | "BOOKING_NOT_FOUND"
    | "BOOKING_NOT_COMPLETED"
    | "HOME_SERVICE_EXCLUDED"
    | "NO_ASSIGNED_RESOURCE"
    | "RESOURCE_NOT_FOUND"
    | "RESOURCE_BRANCH_MISMATCH"
    | "RESOURCE_INACTIVE";
  error?: string;
};

export type UtilityActionResult = {
  ok: boolean;
  status?: "open" | "in_progress" | "completed";
  code?: string;
  error?: string;
  alreadyStarted?: boolean;
  alreadyCompleted?: boolean;
};

/**
 * Authoritatively creates or updates an active room_turnover workflow task
 * upon successful completion of an onsite booking service.
 */
export async function triggerUtilityRoomTurnoverOnServiceCompletion(params: {
  bookingId: string;
  actorStaffId?: string | null;
}): Promise<TriggerTurnoverResult> {
  const admin = createAdminClient();

  // 1. Authoritatively fetch the booking
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, branch_id, resource_id, service_id, type, delivery_type, status, booking_progress_status, session_completed_at, completed_at"
    )
    .eq("id", params.bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    logError("utility_turnover.booking_not_found", {
      bookingId: params.bookingId,
      error: bookingError,
    });
    return { ok: false, skippedReason: "BOOKING_NOT_FOUND" };
  }

  // 2. Verify service is genuinely completed
  const isCompleted =
    booking.status === "completed" ||
    booking.booking_progress_status === "completed" ||
    Boolean(booking.session_completed_at) ||
    Boolean(booking.completed_at);

  if (!isCompleted) {
    return { ok: false, skippedReason: "BOOKING_NOT_COMPLETED" };
  }

  // 3. Verify delivery type is onsite / in_spa (home_service excluded)
  const isOnsite =
    booking.type !== "home_service" &&
    booking.delivery_type !== "home_service";

  if (!isOnsite) {
    return { ok: false, skippedReason: "HOME_SERVICE_EXCLUDED" };
  }

  // 4. Verify assigned resource exists
  if (!booking.resource_id) {
    return { ok: false, skippedReason: "NO_ASSIGNED_RESOURCE" };
  }

  // 5. Authoritatively verify branch resource
  const { data: resource, error: resError } = await admin
    .from("branch_resources")
    .select("id, name, type, branch_id, is_active")
    .eq("id", booking.resource_id)
    .maybeSingle();

  if (resError || !resource) {
    logError("utility_turnover.resource_not_found", {
      bookingId: booking.id,
      resourceId: booking.resource_id,
      error: resError,
    });
    return { ok: false, skippedReason: "RESOURCE_NOT_FOUND" };
  }

  if (resource.branch_id !== booking.branch_id) {
    logError("utility_turnover.resource_branch_mismatch", {
      bookingId: booking.id,
      bookingBranchId: booking.branch_id,
      resourceBranchId: resource.branch_id,
    });
    return { ok: false, skippedReason: "RESOURCE_BRANCH_MISMATCH" };
  }

  if (!resource.is_active) {
    return { ok: false, skippedReason: "RESOURCE_INACTIVE" };
  }

  // 6. Fetch service display name if available
  let serviceName = "Onsite Service";
  if (booking.service_id) {
    const { data: service } = await admin
      .from("services")
      .select("name")
      .eq("id", booking.service_id)
      .maybeSingle();
    if (service?.name) {
      serviceName = service.name;
    }
  }

  // 7. Dedupe key: one active turnover task per physical resource in branch
  const dedupeKey = `room_turnover:${booking.branch_id}:${resource.id}`;
  const completedAt =
    booking.session_completed_at ??
    booking.completed_at ??
    new Date().toISOString();

  const success = await createOrUpdateWorkflowTask({
    branchId: booking.branch_id,
    workspaceScope: "utility",
    assignedToRole: "utility",
    taskType: "room_turnover",
    title: `Turnover: ${resource.name}`,
    body: `${serviceName} completed. Room requires turnover cleaning.`,
    entityType: "branch_resource",
    entityId: resource.id,
    actionHref: "/staff/utility/work",
    priority: "normal",
    dedupeKey,
    metadata: {
      booking_id: booking.id,
      resource_id: resource.id,
      room_name: resource.name,
      resource_type: resource.type,
      service_id: booking.service_id,
      service_name: serviceName,
      completed_at: completedAt,
      triggered_by_staff_id: params.actorStaffId ?? null,
    },
  });

  if (!success) {
    return { ok: false, error: "WORKFLOW_TASK_CREATION_FAILED" };
  }

  logBusinessEvent("utility_turnover.created", {
    bookingId: booking.id,
    branchId: booking.branch_id,
    resourceId: resource.id,
    roomName: resource.name,
  });

  return { ok: true };
}

/**
 * Authoritatively transitions a room_turnover workflow task from open to in_progress.
 */
export async function startRoomCleaning(params: {
  taskId: string;
  actorUserId: string;
}): Promise<UtilityActionResult> {
  const admin = createAdminClient();

  // 1. Resolve staff from authenticated user
  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id, full_name, branch_id, system_role, staff_type, is_active")
    .eq("auth_user_id", params.actorUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError || !staff) {
    return { ok: false, code: "UNAUTHORIZED_STAFF", error: "Active staff profile not found." };
  }

  // 2. Verify canonical utility operational role
  if (
    resolveStaffPwaOperationalGroup(staff.system_role, staff.staff_type) !== "utility"
  ) {
    return { ok: false, code: "NOT_UTILITY_ROLE", error: "Only Utility staff can claim cleaning tasks." };
  }

  // 3. Load workflow task
  const { data: task, error: taskError } = await admin
    .from("workflow_tasks")
    .select("*")
    .eq("id", params.taskId)
    .maybeSingle();

  if (taskError || !task) {
    return { ok: false, code: "TASK_NOT_FOUND", error: "Turnover task not found." };
  }

  // 4. Verify task contract
  if (
    task.workspace_scope !== "utility" ||
    task.task_type !== "room_turnover" ||
    task.entity_type !== "branch_resource"
  ) {
    return { ok: false, code: "INVALID_TASK_TYPE", error: "Task is not a valid room turnover task." };
  }

  // 5. Verify branch match
  if (!staff.branch_id || task.branch_id !== staff.branch_id) {
    return { ok: false, code: "CROSS_BRANCH_FORBIDDEN", error: "Cannot access tasks from another branch." };
  }

  // 6. Verify task status
  if (task.status === "in_progress") {
    return { ok: true, status: "in_progress", alreadyStarted: true };
  }

  if (task.status === "completed") {
    return { ok: false, code: "ALREADY_COMPLETED", error: "This room turnover has already been marked ready." };
  }

  if (task.status === "cancelled") {
    return { ok: false, code: "TASK_CANCELLED", error: "This turnover task was cancelled." };
  }

  if (task.status !== "open") {
    return { ok: false, code: "INVALID_STATE", error: `Cannot start cleaning from state '${task.status}'.` };
  }

  // 7. Transition to in_progress
  const now = new Date().toISOString();
  const existingMeta =
    task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
      ? (task.metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await admin
    .from("workflow_tasks")
    .update({
      status: "in_progress",
      assigned_to_staff_id: staff.id,
      metadata: {
        ...existingMeta,
        started_at: now,
        started_by_staff_id: staff.id,
        started_by_name: staff.full_name,
      } as Json,
    })
    .eq("id", task.id);

  if (updateError) {
    logError("utility_turnover.start_failed", { taskId: task.id, error: updateError });
    return { ok: false, code: "UPDATE_FAILED", error: updateError.message };
  }

  logBusinessEvent("utility_turnover.started", {
    taskId: task.id,
    resourceId: task.entity_id,
    branchId: task.branch_id,
    staffId: staff.id,
  });

  return { ok: true, status: "in_progress" };
}

/**
 * Authoritatively marks a room_turnover workflow task as completed (Ready).
 */
export async function markRoomReady(params: {
  taskId: string;
  actorUserId: string;
}): Promise<UtilityActionResult> {
  const admin = createAdminClient();

  // 1. Resolve staff from authenticated user
  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id, full_name, branch_id, system_role, staff_type, is_active")
    .eq("auth_user_id", params.actorUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError || !staff) {
    return { ok: false, code: "UNAUTHORIZED_STAFF", error: "Active staff profile not found." };
  }

  // 2. Verify canonical utility operational role
  if (
    resolveStaffPwaOperationalGroup(staff.system_role, staff.staff_type) !== "utility"
  ) {
    return { ok: false, code: "NOT_UTILITY_ROLE", error: "Only Utility staff can mark rooms ready." };
  }

  // 3. Load workflow task
  const { data: task, error: taskError } = await admin
    .from("workflow_tasks")
    .select("*")
    .eq("id", params.taskId)
    .maybeSingle();

  if (taskError || !task) {
    return { ok: false, code: "TASK_NOT_FOUND", error: "Turnover task not found." };
  }

  // 4. Verify task contract
  if (
    task.workspace_scope !== "utility" ||
    task.task_type !== "room_turnover" ||
    task.entity_type !== "branch_resource"
  ) {
    return { ok: false, code: "INVALID_TASK_TYPE", error: "Task is not a valid room turnover task." };
  }

  // 5. Verify branch match
  if (!staff.branch_id || task.branch_id !== staff.branch_id) {
    return { ok: false, code: "CROSS_BRANCH_FORBIDDEN", error: "Cannot access tasks from another branch." };
  }

  // 6. Verify task status
  if (task.status === "completed") {
    return { ok: true, status: "completed", alreadyCompleted: true };
  }

  if (task.status === "cancelled") {
    return { ok: false, code: "TASK_CANCELLED", error: "This turnover task was cancelled." };
  }

  if (task.status !== "open" && task.status !== "in_progress") {
    return { ok: false, code: "INVALID_STATE", error: `Cannot mark ready from state '${task.status}'.` };
  }

  // 7. Transition to completed
  const now = new Date().toISOString();
  const existingMeta =
    task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
      ? (task.metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await admin
    .from("workflow_tasks")
    .update({
      status: "completed",
      completed_at: now,
      completed_by_staff_id: staff.id,
      metadata: {
        ...existingMeta,
        ready_at: now,
        completed_by_staff_id: staff.id,
        completed_by_name: staff.full_name,
      } as Json,
    })
    .eq("id", task.id);

  if (updateError) {
    logError("utility_turnover.complete_failed", { taskId: task.id, error: updateError });
    return { ok: false, code: "UPDATE_FAILED", error: updateError.message };
  }

  // 8. Resolve any associated workspace notification
  await resolveNotificationsForEntity("branch_resource", task.entity_id, "utility").catch(() => {});

  logBusinessEvent("utility_turnover.completed", {
    taskId: task.id,
    resourceId: task.entity_id,
    branchId: task.branch_id,
    staffId: staff.id,
  });

  return { ok: true, status: "completed" };
}

/**
 * Checks whether a branch_resource currently has an active (open or in_progress) room turnover task.
 */
export async function isResourceInActiveTurnover(resourceId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workflow_tasks")
    .select("id")
    .eq("workspace_scope", "utility")
    .eq("task_type", "room_turnover")
    .eq("entity_type", "branch_resource")
    .eq("entity_id", resourceId)
    .in("status", ["open", "in_progress"])
    .limit(1);

  if (error || !data) return false;
  return data.length > 0;
}
