import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveNotificationsForEntity } from "@/lib/notifications/create";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { logBusinessEvent, logError } from "@/lib/logger";
import type { Json } from "@/types/supabase";

export type TriggerTurnoverResult = {
  ok: boolean;
  taskId?: string;
  skipped?: boolean;
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
 * Race-safe, lifecycle-preserving creation and update of room turnover workflow tasks.
 *
 * Rules:
 * - If an ACTIVE task (open or in_progress) already exists for this physical resource:
 *   - If in_progress: MUST REMAIN in_progress. Cleaner assignment and started_at are preserved.
 *   - If open: remains open, metadata is enriched with latest service details.
 * - If NO active task exists:
 *   - Inserts a new OPEN task.
 *   - If INSERT hits a concurrent race (unique index violation 23505), re-queries the ACTIVE task only.
 *   - Completed historical tasks sharing the same dedupe key are NEVER reopened or overwritten.
 */
async function ensureRoomTurnoverTask(params: {
  branchId: string;
  resource: { id: string; name: string; type: string };
  booking: {
    id: string;
    service_id: string;
    session_completed_at: string | null;
    completed_at: string | null;
  };
  serviceName: string;
  actorStaffId?: string | null;
}): Promise<{ ok: boolean; taskId?: string; error?: string }> {
  const admin = createAdminClient();
  const dedupeKey = `room_turnover:${params.branchId}:${params.resource.id}`;
  const completedAt =
    params.booking.session_completed_at ??
    params.booking.completed_at ??
    new Date().toISOString();

  // 1. Check for an ACTIVE task for this resource matching canonical scope
  const { data: existingActive, error: selectError } = await admin
    .from("workflow_tasks")
    .select("id, status, assigned_to_staff_id, metadata, dedupe_key, branch_id")
    .eq("branch_id", params.branchId)
    .eq("dedupe_key", dedupeKey)
    .eq("workspace_scope", "utility")
    .eq("task_type", "room_turnover")
    .eq("entity_type", "branch_resource")
    .eq("entity_id", params.resource.id)
    .in("status", ["open", "in_progress"])
    .maybeSingle();

  if (selectError) {
    logError("utility_turnover.select_active_failed", {
      resourceId: params.resource.id,
      error: selectError,
    });
    return { ok: false, error: selectError.message };
  }

  // 2. Lifecycle preservation if active task already exists
  if (existingActive) {
    const existingMeta =
      existingActive.metadata &&
      typeof existingActive.metadata === "object" &&
      !Array.isArray(existingActive.metadata)
        ? (existingActive.metadata as Record<string, unknown>)
        : {};

    if (existingActive.status === "in_progress") {
      // PRESERVE IN_PROGRESS: Do not clear cleaner assignment, started_at, or return to open!
      const { error: updateError } = await admin
        .from("workflow_tasks")
        .update({
          metadata: {
            ...existingMeta,
            latest_booking_id: params.booking.id,
            latest_service_name: params.serviceName,
            latest_completed_at: completedAt,
          } as Json,
        })
        .eq("id", existingActive.id)
        .eq("branch_id", params.branchId)
        .eq("status", "in_progress");

      if (updateError) {
        logError("utility_turnover.preserve_in_progress_failed", {
          taskId: existingActive.id,
          error: updateError,
        });
        return { ok: false, error: updateError.message };
      }

      return { ok: true, taskId: existingActive.id };
    }

    // Task is open: enrich metadata, preserve open status
    const { error: updateError } = await admin
      .from("workflow_tasks")
      .update({
        metadata: {
          ...existingMeta,
          booking_id: params.booking.id,
          service_id: params.booking.service_id,
          service_name: params.serviceName,
          completed_at: completedAt,
          triggered_by_staff_id: params.actorStaffId ?? null,
        } as Json,
      })
      .eq("id", existingActive.id)
      .eq("branch_id", params.branchId)
      .eq("status", "open");

    if (updateError) {
      logError("utility_turnover.update_open_failed", {
        taskId: existingActive.id,
        error: updateError,
      });
      return { ok: false, error: updateError.message };
    }

    return { ok: true, taskId: existingActive.id };
  }

  // 3. No active task: insert new OPEN task.
  // action_href is set to null per W1B zero-migration constraint (action_href CHECK excludes /staff).
  const insertPayload = {
    branch_id: params.branchId,
    workspace_scope: "utility",
    assigned_to_role: "utility",
    assigned_to_staff_id: null,
    task_type: "room_turnover",
    title: `Turnover: ${params.resource.name}`,
    body: `${params.serviceName} completed. Room requires turnover cleaning.`,
    entity_type: "branch_resource",
    entity_id: params.resource.id,
    action_href: null,
    priority: "normal",
    status: "open",
    due_at: null,
    completed_at: null,
    completed_by_staff_id: null,
    dedupe_key: dedupeKey,
    metadata: {
      booking_id: params.booking.id,
      resource_id: params.resource.id,
      room_name: params.resource.name,
      resource_type: params.resource.type,
      service_id: params.booking.service_id,
      service_name: params.serviceName,
      completed_at: completedAt,
      triggered_by_staff_id: params.actorStaffId ?? null,
    } as Json,
  };

  const { data: inserted, error: insertError } = await admin
    .from("workflow_tasks")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (!insertError) {
    return { ok: true, taskId: inserted?.id };
  }

  // 4. Handle unique index violation race (23505 on workflow_tasks_open_dedupe_key_uidx)
  if (insertError.code === "23505") {
    // Re-query ONLY active tasks matching canonical scope (do NOT touch historical completed rows sharing the key)
    const { data: activeAfterRace, error: raceError } = await admin
      .from("workflow_tasks")
      .select("id, status, branch_id, workspace_scope, task_type, entity_type, entity_id")
      .eq("dedupe_key", dedupeKey)
      .eq("branch_id", params.branchId)
      .eq("workspace_scope", "utility")
      .eq("task_type", "room_turnover")
      .eq("entity_type", "branch_resource")
      .eq("entity_id", params.resource.id)
      .in("status", ["open", "in_progress"])
      .maybeSingle();

    if (!raceError && activeAfterRace) {
      return { ok: true, taskId: activeAfterRace.id };
    }

    logError("utility_turnover.race_canonical_mismatch", {
      dedupeKey,
      branchId: params.branchId,
      resourceId: params.resource.id,
      error: raceError ?? "Conflicting task does not match canonical scope",
    });
    return {
      ok: false,
      error: "Conflicting active task does not match canonical turnover scope.",
    };
  }

  logError("utility_turnover.insert_failed", {
    resourceId: params.resource.id,
    error: insertError,
  });
  return { ok: false, error: insertError.message };
}

/**
 * Authoritatively ensures an active room_turnover workflow task
 * upon completion of an onsite booking service.
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
    if (bookingError) {
      return { ok: false, error: bookingError.message };
    }
    return { ok: true, skipped: true, skippedReason: "BOOKING_NOT_FOUND" };
  }

  // 2. Verify service is genuinely completed
  const isCompleted =
    booking.status === "completed" ||
    booking.booking_progress_status === "completed" ||
    Boolean(booking.session_completed_at) ||
    Boolean(booking.completed_at);

  if (!isCompleted) {
    return { ok: true, skipped: true, skippedReason: "BOOKING_NOT_COMPLETED" };
  }

  // 3. Verify delivery type is onsite / in_spa (home_service excluded)
  const isOnsite =
    booking.type !== "home_service" &&
    booking.delivery_type !== "home_service";

  if (!isOnsite) {
    return { ok: true, skipped: true, skippedReason: "HOME_SERVICE_EXCLUDED" };
  }

  // 4. Verify assigned resource exists
  if (!booking.resource_id) {
    return { ok: true, skipped: true, skippedReason: "NO_ASSIGNED_RESOURCE" };
  }

  // 5. Authoritatively verify branch resource
  const { data: resource, error: resError } = await admin
    .from("branch_resources")
    .select("id, name, type, branch_id, is_active")
    .eq("id", booking.resource_id)
    .maybeSingle();

  if (resError) {
    logError("utility_turnover.resource_query_failed", {
      bookingId: booking.id,
      resourceId: booking.resource_id,
      error: resError,
    });
    return { ok: false, error: resError.message };
  }

  if (!resource) {
    logError("utility_turnover.resource_not_found", {
      bookingId: booking.id,
      resourceId: booking.resource_id,
    });
    return { ok: true, skipped: true, skippedReason: "RESOURCE_NOT_FOUND" };
  }

  if (resource.branch_id !== booking.branch_id) {
    logError("utility_turnover.resource_branch_mismatch", {
      bookingId: booking.id,
      bookingBranchId: booking.branch_id,
      resourceBranchId: resource.branch_id,
    });
    return { ok: true, skipped: true, skippedReason: "RESOURCE_BRANCH_MISMATCH" };
  }

  if (!resource.is_active) {
    return { ok: true, skipped: true, skippedReason: "RESOURCE_INACTIVE" };
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

  // 7. Ensure turnover task with active preservation and race-safety
  const result = await ensureRoomTurnoverTask({
    branchId: booking.branch_id,
    resource,
    booking,
    serviceName,
    actorStaffId: params.actorStaffId,
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "WORKFLOW_TASK_CREATION_FAILED" };
  }

  logBusinessEvent("utility_turnover.created", {
    bookingId: booking.id,
    branchId: booking.branch_id,
    resourceId: resource.id,
    roomName: resource.name,
  });

  return { ok: true, taskId: result.taskId };
}

/**
 * Authoritatively transitions a room_turnover workflow task from open to in_progress.
 * Uses atomic compare-and-set to prevent TOCTOU races.
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

  // 5. Verify branch match on task
  if (!staff.branch_id || task.branch_id !== staff.branch_id) {
    return { ok: false, code: "CROSS_BRANCH_FORBIDDEN", error: "Cannot access tasks from another branch." };
  }

  // 6. Verify resource authoritatively (Blocker D)
  const { data: resource, error: resError } = await admin
    .from("branch_resources")
    .select("id, branch_id, is_active")
    .eq("id", task.entity_id)
    .maybeSingle();

  if (resError || !resource) {
    return { ok: false, code: "RESOURCE_NOT_FOUND", error: "Associated room resource was not found." };
  }

  if (resource.branch_id !== task.branch_id || resource.branch_id !== staff.branch_id) {
    return { ok: false, code: "RESOURCE_BRANCH_MISMATCH", error: "Resource branch mismatch." };
  }

  if (!resource.is_active) {
    return { ok: false, code: "RESOURCE_INACTIVE", error: "Resource is inactive." };
  }

  // 7. Lifecycle check on read state
  if (task.status === "completed" || task.status === "cancelled") {
    return { ok: false, code: "ALREADY_COMPLETED", error: "This turnover task is already completed." };
  }
  if (task.status === "in_progress") {
    if (task.assigned_to_staff_id === staff.id) {
      return { ok: true, status: "in_progress", alreadyStarted: true };
    }
    return { ok: false, code: "ALREADY_CLAIMED", error: "Task has already been claimed by another staff member." };
  }

  // 8. Atomic Compare-And-Set: UPDATE only if status is currently 'open'
  const now = new Date().toISOString();
  const existingMeta =
    task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
      ? (task.metadata as Record<string, unknown>)
      : {};

  const { data: updatedRows, error: updateError } = await admin
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
    .eq("id", task.id)
    .eq("status", "open")
    .eq("branch_id", staff.branch_id)
    .select();

  if (updateError) {
    logError("utility_turnover.start_failed", { taskId: task.id, error: updateError });
    return { ok: false, code: "UPDATE_FAILED", error: updateError.message };
  }

  // If row was updated, compare-and-set succeeded
  if (updatedRows && updatedRows.length > 0) {
    logBusinessEvent("utility_turnover.started", {
      taskId: task.id,
      resourceId: task.entity_id,
      branchId: task.branch_id,
      staffId: staff.id,
    });
    return { ok: true, status: "in_progress" };
  }

  // 8. If 0 rows updated, inspect authoritative state to return truthful conflict/idempotent result
  const { data: freshTask } = await admin
    .from("workflow_tasks")
    .select("status, assigned_to_staff_id")
    .eq("id", task.id)
    .maybeSingle();

  if (freshTask?.status === "in_progress") {
    if (freshTask.assigned_to_staff_id === staff.id) {
      return { ok: true, status: "in_progress", alreadyStarted: true };
    }
    return { ok: false, code: "ALREADY_CLAIMED", error: "Another cleaner has already started cleaning this room." };
  }

  if (freshTask?.status === "completed") {
    return { ok: false, code: "ALREADY_COMPLETED", error: "This room turnover has already been completed." };
  }

  if (freshTask?.status === "cancelled") {
    return { ok: false, code: "TASK_CANCELLED", error: "This turnover task was cancelled." };
  }

  return { ok: false, code: "CONFLICT", error: "Turnover task state changed concurrently." };
}

/**
 * Authoritatively marks a room_turnover workflow task as completed (Ready).
 * Enforces canonical lifecycle: OPEN -> IN_PROGRESS -> COMPLETED.
 * Direct OPEN -> COMPLETED is strictly rejected.
 * Uses atomic compare-and-set to prevent TOCTOU races.
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

  // 5. Verify branch match on task
  if (!staff.branch_id || task.branch_id !== staff.branch_id) {
    return { ok: false, code: "CROSS_BRANCH_FORBIDDEN", error: "Cannot access tasks from another branch." };
  }

  // 6. Verify resource authoritatively (Blocker D)
  const { data: resource, error: resError } = await admin
    .from("branch_resources")
    .select("id, branch_id, is_active")
    .eq("id", task.entity_id)
    .maybeSingle();

  if (resError || !resource) {
    return { ok: false, code: "RESOURCE_NOT_FOUND", error: "Associated room resource was not found." };
  }

  if (resource.branch_id !== task.branch_id || resource.branch_id !== staff.branch_id) {
    return { ok: false, code: "RESOURCE_BRANCH_MISMATCH", error: "Resource branch mismatch." };
  }

  if (!resource.is_active) {
    return { ok: false, code: "RESOURCE_INACTIVE", error: "Resource is inactive." };
  }

  // 7. Enforce Canonical Lifecycle: OPEN -> COMPLETED is prohibited (Blocker C)
  if (task.status === "open") {
    return {
      ok: false,
      code: "CLEANING_NOT_STARTED",
      error: "Room cleaning must be started before it can be marked ready.",
    };
  }

  if (task.status === "completed") {
    return { ok: true, status: "completed", alreadyCompleted: true };
  }

  if (task.status === "cancelled") {
    return { ok: false, code: "TASK_CANCELLED", error: "This turnover task was cancelled." };
  }

  // 8. Atomic Compare-And-Set: UPDATE only if status is currently 'in_progress'
  const now = new Date().toISOString();
  const existingMeta =
    task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
      ? (task.metadata as Record<string, unknown>)
      : {};

  const { data: updatedRows, error: updateError } = await admin
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
    .eq("id", task.id)
    .eq("status", "in_progress")
    .eq("branch_id", staff.branch_id)
    .select();

  if (updateError) {
    logError("utility_turnover.complete_failed", { taskId: task.id, error: updateError });
    return { ok: false, code: "UPDATE_FAILED", error: updateError.message };
  }

  // If row was updated, compare-and-set succeeded
  if (updatedRows && updatedRows.length > 0) {
    // Resolve any associated workspace notification
    await resolveNotificationsForEntity("branch_resource", task.entity_id, "utility").catch(() => {});

    logBusinessEvent("utility_turnover.completed", {
      taskId: task.id,
      resourceId: task.entity_id,
      branchId: task.branch_id,
      staffId: staff.id,
    });

    return { ok: true, status: "completed" };
  }

  // 9. If 0 rows updated, inspect authoritative state
  const { data: freshTask } = await admin
    .from("workflow_tasks")
    .select("status")
    .eq("id", task.id)
    .maybeSingle();

  if (freshTask?.status === "completed") {
    return { ok: true, status: "completed", alreadyCompleted: true };
  }

  if (freshTask?.status === "open") {
    return {
      ok: false,
      code: "CLEANING_NOT_STARTED",
      error: "Room cleaning must be started before it can be marked ready.",
    };
  }

  if (freshTask?.status === "cancelled") {
    return { ok: false, code: "TASK_CANCELLED", error: "This turnover task was cancelled." };
  }

  return { ok: false, code: "CONFLICT", error: "Turnover task state changed concurrently." };
}

/**
 * Checks whether a branch_resource currently has an active (open or in_progress) room turnover task.
 * Never fails open on database error: throws rather than silently assuming ready.
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

  if (error) {
    logError("resource_availability.turnover_check_failed", { resourceId, error });
    throw new Error(`Failed to check resource turnover status: ${error.message}`);
  }

  return Boolean(data && data.length > 0);
}
