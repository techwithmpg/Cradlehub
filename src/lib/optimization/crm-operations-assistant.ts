import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotificationOnce } from "@/lib/notifications/create";
import type { NotificationType } from "@/lib/notifications/types";
import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import type { PredictiveConflictItem, UnifiedEvaluationResult } from "./types";

const SYNC_COOLDOWN_MS = 45_000;
const lastSyncByBranch = new Map<string, { snapshotVersion: string; syncedAt: number }>();

function notificationTypeForConflict(
  issueType: PredictiveConflictItem["issue_type"]
): NotificationType {
  switch (issueType) {
    case "home_service_to_onsite_collision":
    case "onsite_to_home_service_collision":
    case "driver_route_ripple":
    case "driver_unassigned_risk":
    case "location_or_gps_degraded":
      return "home_service_dispatch_conflict";
    case "room_capacity_bottleneck":
    case "room_turnover_collision":
      return "resource_conflict_warning";
    case "therapist_unassigned_risk":
    case "session_overrun_ripple":
    case "rule_drift_or_cross_branch_gap":
      return "staff_availability_conflict";
    default:
      return "system_warning";
  }
}

export function validCrmActionHrefForConflict(
  conflict: PredictiveConflictItem
): string {
  const bookingId = conflict.affected_booking_ids[0];
  if (
    conflict.issue_type === "home_service_to_onsite_collision" ||
    conflict.issue_type === "driver_route_ripple" ||
    conflict.issue_type === "driver_unassigned_risk" ||
    conflict.issue_type === "location_or_gps_degraded"
  ) {
    return bookingId
      ? `/crm/dispatch?bookingId=${encodeURIComponent(bookingId)}`
      : "/crm/dispatch";
  }
  if (
    conflict.issue_type === "room_capacity_bottleneck" ||
    conflict.issue_type === "room_turnover_collision" ||
    conflict.issue_type === "therapist_unassigned_risk" ||
    conflict.issue_type === "session_overrun_ripple"
  ) {
    return bookingId
      ? `/crm/bookings?bookingId=${encodeURIComponent(bookingId)}`
      : "/crm/schedule";
  }
  return "/crm/schedule";
}

export type TieredCrmOperationsSummary = {
  branchId: string;
  branchName: string;
  date: string;
  engineSource: UnifiedEvaluationResult["engineSource"];
  sourceSnapshotVersion: string;
  persistentActions: PredictiveConflictItem[];
  earlyWarnings: PredictiveConflictItem[];
  quietOpportunities: PredictiveConflictItem[];
  syncedTaskCount: number;
  resolvedTaskCount: number;
};

export function summarizeOptimizationEvaluation(
  evaluation: UnifiedEvaluationResult,
  counts: { syncedTaskCount?: number; resolvedTaskCount?: number } = {}
): TieredCrmOperationsSummary {
  return {
    branchId: evaluation.branch_id,
    branchName: evaluation.branchName,
    date: evaluation.date,
    engineSource: evaluation.engineSource,
    sourceSnapshotVersion: evaluation.source_snapshot_version,
    persistentActions: evaluation.conflicts_and_opportunities.filter(
      (c) => c.assistant_tier === "persistent_action_required"
    ),
    earlyWarnings: evaluation.conflicts_and_opportunities.filter(
      (c) => c.assistant_tier === "early_warning_toast"
    ),
    quietOpportunities: evaluation.conflicts_and_opportunities.filter(
      (c) => c.assistant_tier === "quiet_opportunity"
    ),
    syncedTaskCount: counts.syncedTaskCount ?? 0,
    resolvedTaskCount: counts.resolvedTaskCount ?? 0,
  };
}

export async function syncCrmOptimizationAlerts(params: {
  evaluation: UnifiedEvaluationResult;
  actorStaffId?: string | null;
  forceSync?: boolean;
  supabase?: SupabaseClient<Database>;
}): Promise<TieredCrmOperationsSummary> {
  const { evaluation } = params;
  const baseSummary = summarizeOptimizationEvaluation(evaluation);
  const { persistentActions } = baseSummary;

  const prev = lastSyncByBranch.get(evaluation.branch_id);
  const nowMs = Date.now();
  if (
    !params.forceSync &&
    prev &&
    prev.snapshotVersion === evaluation.source_snapshot_version &&
    nowMs - prev.syncedAt < SYNC_COOLDOWN_MS
  ) {
    return baseSummary;
  }

  const db = params.supabase ?? createAdminClient();
  const activeKeys = new Set(persistentActions.map((c) => c.dedupe_key));
  let syncedTaskCount = 0;

  for (const conflict of persistentActions.slice(0, 12)) {
    const actionHref = validCrmActionHrefForConflict(conflict);
    const topAction = conflict.recommended_actions[0];
    const detail = topAction
      ? `${conflict.predicted_impact} Suggested: ${topAction.label}.`
      : conflict.predicted_impact;
    const priority = conflict.severity === "critical" ? "critical" : "high";

    const ok = await createOrUpdateWorkflowTask({
      branchId: conflict.branch_id,
      workspaceScope: "crm",
      taskType: "optimization_conflict",
      title: `Schedule Action Needed (${conflict.latest_useful_action_time})`,
      body: detail,
      entityType: conflict.affected_booking_ids[0] ? "booking" : "branch",
      entityId: conflict.affected_booking_ids[0] ?? conflict.branch_id,
      actionHref,
      priority,
      dedupeKey: conflict.dedupe_key,
      metadata: {
        issue_type: conflict.issue_type,
        source_snapshot_version: conflict.source_snapshot_version,
        affected_booking_ids: conflict.affected_booking_ids,
        recommended_actions: conflict.recommended_actions,
      },
    });
    if (ok) syncedTaskCount += 1;

    await createNotificationOnce({
      branchId: conflict.branch_id,
      targetWorkspace: "crm",
      actorStaffId: params.actorStaffId ?? null,
      type: notificationTypeForConflict(conflict.issue_type),
      title: `Scheduling Alert (${conflict.latest_useful_action_time})`,
      body: detail,
      entityType: conflict.affected_booking_ids[0] ? "booking" : "branch",
      entityId: conflict.affected_booking_ids[0] ?? conflict.branch_id,
      actionHref,
      priority,
      requiresAction: true,
      dedupeKey: conflict.dedupe_key,
      metadata: {
        issue_type: conflict.issue_type,
        source_snapshot_version: conflict.source_snapshot_version,
      },
    });
  }

  // Auto-resolve any open optimization_conflict workflow tasks whose dedupe_key disappeared
  let resolvedTaskCount = 0;
  const { data: openTasks } = await db
    .from("workflow_tasks")
    .select("id, dedupe_key")
    .eq("branch_id", evaluation.branch_id)
    .eq("workspace_scope", "crm")
    .eq("task_type", "optimization_conflict")
    .in("status", ["open", "in_progress"]);

  const toResolveIds = (openTasks ?? [])
    .filter((t) => !t.dedupe_key || !activeKeys.has(t.dedupe_key))
    .map((t) => t.id);

  if (toResolveIds.length > 0) {
    const completedAt = new Date().toISOString();
    await db
      .from("workflow_tasks")
      .update({
        status: "completed",
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .in("id", toResolveIds);
    resolvedTaskCount = toResolveIds.length;
  }

  // Also resolve cleared workspace_notifications scoped to uoe:<branchId>:%
  const { data: openNotifs } = await db
    .from("workspace_notifications")
    .select("id, dedupe_key")
    .eq("branch_id", evaluation.branch_id)
    .eq("target_workspace", "crm")
    .in("status", ["unread", "read"])
    .like("dedupe_key", `uoe:${evaluation.branch_id}:%`);

  const clearedNotifIds = (openNotifs ?? [])
    .filter((n) => !n.dedupe_key || !activeKeys.has(n.dedupe_key))
    .map((n) => n.id);
  if (clearedNotifIds.length > 0) {
    const resolvedAt = new Date().toISOString();
    await db
      .from("workspace_notifications")
      .update({
        status: "resolved",
        resolved_at: resolvedAt,
      })
      .in("id", clearedNotifIds);
  }

  lastSyncByBranch.set(evaluation.branch_id, {
    snapshotVersion: evaluation.source_snapshot_version,
    syncedAt: nowMs,
  });

  return {
    ...baseSummary,
    syncedTaskCount,
    resolvedTaskCount,
  };
}
