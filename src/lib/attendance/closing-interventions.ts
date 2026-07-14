import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { asAttendanceDb } from "@/lib/attendance/db";
import {
  createOrUpdateNotification,
  createOrUpdateWorkflowTask,
} from "@/lib/notifications/workflow-signals";
import { logError, logInfo } from "@/lib/logger";

type InterventionStage =
  | "reminder"
  | "manager_escalation"
  | "active_service_blocked"
  | "auto_close";

type InterventionRow = {
  id: string;
  branch_id: string;
  staff_id: string;
  checkin_id: string;
  stage: InterventionStage;
  dedupe_key: string;
  due_at: string;
  policy_snapshot: Record<string, unknown>;
  notification_sent_at: string | null;
  workflow_task_sent_at: string | null;
  delivery_attempts: number;
  staff?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
};

export type ClosingInterventionRunResult = {
  processedOpenRecords: number;
  createdInterventions: number;
  autoClosedRecords: number;
  activeServiceBlocks: number;
  deliveredInterventions: number;
  deliveryErrors: number;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function expectedClockOutLabel(row: InterventionRow): string {
  const expected = row.policy_snapshot.latestNormalClockOutAt;
  const timezone = row.policy_snapshot.timezone;
  if (typeof expected !== "string") return "the configured closing time";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: typeof timezone === "string" ? timezone : "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(expected));
  } catch {
    return "the configured closing time";
  }
}

function notificationFor(row: InterventionRow, staffName: string) {
  if (row.stage === "reminder") {
    return {
      targetWorkspace: "crm" as const,
      targetRole: "crm",
      recipientStaffId: row.staff_id,
      type: "attendance_clock_out_reminder" as const,
      title: "Closing shift clock-out reminder",
      body: "Your closing shift is still open. Please scan to clock out.",
      priority: "normal" as const,
      requiresAction: false,
    };
  }
  if (row.stage === "auto_close") {
    return {
      targetWorkspace: "crm" as const,
      targetRole: "crm",
      recipientStaffId: row.staff_id,
      type: "attendance_provisional_auto_close" as const,
      title: "Clock-out confirmation required",
      body: "Attendance was provisionally auto-closed at the latest normal clock-out time. A real QR scan will replace it automatically.",
      priority: "high" as const,
      requiresAction: true,
    };
  }
  return {
    targetWorkspace: "manager" as const,
    targetRole: "manager",
    recipientStaffId: null,
    type: "attendance_closing_escalation" as const,
    title:
      row.stage === "active_service_blocked"
        ? "Active service blocked closing auto-close"
        : "Closing shift still open",
    body:
      row.stage === "active_service_blocked"
        ? `${staffName} still has an active service at the hard cutoff. Attendance was left open for review.`
        : `CRM closing attendance is still open for ${staffName}. Expected clock-out was by ${expectedClockOutLabel(row)}.`,
    priority: "high" as const,
    requiresAction: true,
  };
}

function needsWorkflowTask(stage: InterventionStage): boolean {
  return stage !== "reminder";
}

export async function runClosingAttendanceInterventions(
  now = new Date()
): Promise<ClosingInterventionRunResult> {
  const admin = asAttendanceDb(createAdminClient());
  const { data: processed, error: processError } = await admin
    .rpc("process_crm_closing_attendance_interventions", {
      p_now: now.toISOString(),
      p_limit: 200,
    })
    .maybeSingle();

  if (processError) {
    await admin
      .from("attendance_settings")
      .update({ closing_intervention_last_error: processError.message })
      .eq("crm_closing_policy_enabled", true);
    throw new Error(`Closing attendance intervention processor failed: ${processError.message}`);
  }

  const { data: pending, error: pendingError } = await admin
    .from("attendance_closing_interventions")
    .select(
      "id, branch_id, staff_id, checkin_id, stage, dedupe_key, due_at, policy_snapshot, notification_sent_at, workflow_task_sent_at, delivery_attempts, staff:staff!attendance_closing_interventions_staff_id_fkey(full_name)"
    )
    .is("notification_sent_at", null)
    .order("created_at")
    .limit(200);
  if (pendingError) {
    throw new Error(`Pending closing interventions could not be loaded: ${pendingError.message}`);
  }

  let deliveredInterventions = 0;
  let deliveryErrors = 0;
  for (const rawRow of pending ?? []) {
    const row = rawRow as unknown as InterventionRow;
    const staffName = first(row.staff)?.full_name?.trim() || "CRM staff member";
    const notification = notificationFor(row, staffName);
    const notificationSent = await createOrUpdateNotification({
      branchId: row.branch_id,
      ...notification,
      entityType: "attendance_record",
      entityId: row.checkin_id,
      actionHref: "/crm/attendance?tab=exceptions",
      dedupeKey: `${row.dedupe_key}:notification`,
      metadata: {
        intervention_id: row.id,
        intervention_stage: row.stage,
        policy_snapshot: row.policy_snapshot,
      },
    });

    const taskSent = needsWorkflowTask(row.stage)
      ? await createOrUpdateWorkflowTask({
          branchId: row.branch_id,
          workspaceScope: "manager",
          assignedToRole: "manager",
          taskType: `attendance.crm_closing.${row.stage}`,
          title: notification.title,
          body: notification.body,
          entityType: "attendance_record",
          entityId: row.checkin_id,
          actionHref: "/crm/attendance?tab=exceptions",
          priority: "high",
          dueAt: row.due_at,
          dedupeKey: `${row.dedupe_key}:task`,
          metadata: {
            intervention_id: row.id,
            intervention_stage: row.stage,
            staff_id: row.staff_id,
          },
        })
      : true;

    if (notificationSent && taskSent) {
      const deliveredAt = new Date().toISOString();
      const { error: markError } = await admin
        .from("attendance_closing_interventions")
        .update({
          notification_sent_at: deliveredAt,
          workflow_task_sent_at: needsWorkflowTask(row.stage) ? deliveredAt : null,
          delivery_attempts: row.delivery_attempts + 1,
          last_delivery_error: null,
          updated_at: deliveredAt,
        })
        .eq("id", row.id)
        .is("notification_sent_at", null);
      if (markError) {
        deliveryErrors += 1;
        logError("attendance.closing_intervention.mark_delivered_failed", {
          interventionId: row.id,
          error: markError,
        });
      } else {
        deliveredInterventions += 1;
      }
    } else {
      deliveryErrors += 1;
      await admin
        .from("attendance_closing_interventions")
        .update({
          delivery_attempts: row.delivery_attempts + 1,
          last_delivery_error: "Notification or workflow task delivery failed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  const result = {
    processedOpenRecords: processed?.processed_open_records ?? 0,
    createdInterventions: processed?.created_interventions ?? 0,
    autoClosedRecords: processed?.auto_closed_records ?? 0,
    activeServiceBlocks: processed?.active_service_blocks ?? 0,
    deliveredInterventions,
    deliveryErrors,
  };
  logInfo("attendance.closing_interventions.completed", result);
  return result;
}
