import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/create";
import type { NotificationType } from "@/lib/notifications/types";
import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import {
  buildUnavailableOptimizationSummary,
  summarizeOptimizationEvaluation,
  validCrmActionHrefForConflict,
  type OperationsAssistantHealthStatus,
  type TieredCrmOperationsSummary,
} from "./assistant-summary";
import type { PredictiveConflictItem, UnifiedEvaluationResult } from "./types";

export {
  buildUnavailableOptimizationSummary,
  summarizeOptimizationEvaluation,
  validCrmActionHrefForConflict,
  type OperationsAssistantHealthStatus,
  type TieredCrmOperationsSummary,
};

const SYNC_COOLDOWN_MS = 12_000;

type BranchDateSyncRecord = {
  snapshotVersion: string;
  syncedAt: number;
  startedAtMs: number;
};

const lastSyncByScope = new Map<string, BranchDateSyncRecord>();

export function clearOptimizationAssistantSyncCache(): void {
  lastSyncByScope.clear();
}

function scopeKey(branchId: string, date: string): string {
  return `${branchId}:${date}`;
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataMatchesEvaluationDate(metadata: unknown, evaluationDate: string): boolean {
  const meta = asMetadataRecord(metadata);
  if (typeof meta.evaluation_date === "string" && meta.evaluation_date.trim().length > 0) {
    return meta.evaluation_date === evaluationDate;
  }
  if (
    typeof meta.source_snapshot_version === "string" &&
    meta.source_snapshot_version.includes(":")
  ) {
    const prefixDate = meta.source_snapshot_version.split(":")[0] ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(prefixDate)) {
      return prefixDate === evaluationDate;
    }
  }
  return true;
}

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

export async function syncCrmOptimizationAlerts(params: {
  evaluation: UnifiedEvaluationResult;
  actorStaffId?: string | null;
  forceSync?: boolean;
  evaluationStartedAtMs?: number;
  supabase?: SupabaseClient<Database>;
}): Promise<TieredCrmOperationsSummary> {
  const { evaluation } = params;
  const baseSummary = summarizeOptimizationEvaluation(evaluation);
  const { persistentActions } = baseSummary;

  const key = scopeKey(evaluation.branch_id, evaluation.date);
  const prev = lastSyncByScope.get(key);
  const nowMs = Date.now();
  const startedAtMs = params.evaluationStartedAtMs ?? nowMs;

  // Monotonic ordering: never allow an older started evaluation to overwrite a newer run.
  if (prev && startedAtMs < prev.startedAtMs) {
    return baseSummary;
  }

  if (
    !params.forceSync &&
    prev &&
    prev.snapshotVersion === evaluation.source_snapshot_version &&
    nowMs - prev.syncedAt < SYNC_COOLDOWN_MS
  ) {
    return baseSummary;
  }

  const db = params.supabase ?? createAdminClient();

  // Cross-instance monotonic watermark check: query existing optimization_conflict tasks
  // (including open, in_progress, and completed) so a slower serverless instance with an
  // empty local lastSyncByScope cache never overwrites or revives conflicts after a newer
  // evaluation has already committed to the database.
  const { data: existingBranchTasks } = await db
    .from("workflow_tasks")
    .select("id, status, dedupe_key, metadata")
    .eq("branch_id", evaluation.branch_id)
    .eq("workspace_scope", "crm")
    .eq("task_type", "optimization_conflict")
    .in("status", ["open", "in_progress", "completed"]);

  const dateScopedTasks = (existingBranchTasks ?? []).filter((t) =>
    metadataMatchesEvaluationDate(t.metadata, evaluation.date)
  );
  let maxDbStartedAtMs = 0;
  for (const t of dateScopedTasks) {
    const meta = asMetadataRecord(t.metadata);
    const rowStarted = Number(meta.evaluation_started_at_ms ?? 0);
    if (Number.isFinite(rowStarted) && rowStarted > maxDbStartedAtMs) {
      maxDbStartedAtMs = rowStarted;
    }
  }
  if (maxDbStartedAtMs > startedAtMs) {
    lastSyncByScope.set(key, {
      snapshotVersion: prev?.snapshotVersion ?? evaluation.source_snapshot_version,
      syncedAt: nowMs,
      startedAtMs: maxDbStartedAtMs,
    });
    return baseSummary;
  }

  const activeKeys = new Set(persistentActions.map((c) => c.dedupe_key));
  let syncedTaskCount = 0;

  for (const conflict of persistentActions.slice(0, 12)) {
    const actionHref = validCrmActionHrefForConflict(conflict);
    const topAction = conflict.recommended_actions[0];
    const detail = topAction
      ? `${conflict.predicted_impact} Recommended: ${topAction.label}.`
      : conflict.predicted_impact;
    const priority = conflict.severity === "critical" ? "critical" : "high";

    const ok = await createOrUpdateWorkflowTask({
      branchId: conflict.branch_id,
      workspaceScope: "crm",
      taskType: "optimization_conflict",
      title: `Schedule Action Needed (Act before ${conflict.latest_useful_action_time})`,
      body: detail,
      entityType: conflict.affected_booking_ids[0] ? "booking" : "branch",
      entityId: conflict.affected_booking_ids[0] ?? conflict.branch_id,
      actionHref,
      priority,
      dedupeKey: conflict.dedupe_key,
      metadata: {
        issue_type: conflict.issue_type,
        evaluation_date: evaluation.date,
        evaluation_started_at_ms: startedAtMs,
        evaluated_at_ms: nowMs,
        source_snapshot_version: conflict.source_snapshot_version,
        affected_booking_ids: conflict.affected_booking_ids,
        recommended_actions: conflict.recommended_actions,
        predicted_impact: conflict.predicted_impact,
      },
    });
    if (ok) syncedTaskCount += 1;

    // Use createOrUpdateNotification (via createNotification) rather than createNotificationOnce
    // so issues that were previously resolved cleanly notify again only if the conflict genuinely returns,
    // while already-open notifications refresh metadata in-place without reviving read status or flooding.
    await createNotification({
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
        evaluation_date: evaluation.date,
        evaluation_started_at_ms: startedAtMs,
        evaluated_at_ms: nowMs,
        source_snapshot_version: conflict.source_snapshot_version,
        affected_booking_ids: conflict.affected_booking_ids,
        recommended_action_label: topAction?.label ?? null,
      },
    });
  }

  // Auto-resolve any open optimization_conflict workflow tasks for this branch AND date
  // whose dedupe_key disappeared.
  let resolvedTaskCount = 0;
  const { data: openTasks } = await db
    .from("workflow_tasks")
    .select("id, dedupe_key, metadata")
    .eq("branch_id", evaluation.branch_id)
    .eq("workspace_scope", "crm")
    .eq("task_type", "optimization_conflict")
    .in("status", ["open", "in_progress"]);

  const toResolveTasks = (openTasks ?? []).filter(
    (t) =>
      metadataMatchesEvaluationDate(t.metadata, evaluation.date) &&
      (!t.dedupe_key || !activeKeys.has(t.dedupe_key))
  );

  if (toResolveTasks.length > 0) {
    const completedAt = new Date().toISOString();
    for (const task of toResolveTasks) {
      const mergedMeta = {
        ...asMetadataRecord(task.metadata),
        evaluation_date: evaluation.date,
        evaluation_started_at_ms: startedAtMs,
        evaluated_at_ms: nowMs,
      };
      await db
        .from("workflow_tasks")
        .update({
          status: "completed",
          completed_at: completedAt,
          updated_at: completedAt,
          metadata: mergedMeta,
        })
        .eq("id", task.id);
    }
    resolvedTaskCount = toResolveTasks.length;
  }

  // Also resolve cleared workspace_notifications scoped to uoe:<branchId>:% for this evaluation date.
  const { data: openNotifs } = await db
    .from("workspace_notifications")
    .select("id, dedupe_key, metadata")
    .eq("branch_id", evaluation.branch_id)
    .eq("target_workspace", "crm")
    .in("status", ["unread", "read"])
    .like("dedupe_key", `uoe:${evaluation.branch_id}:%`);

  const clearedNotifIds = (openNotifs ?? [])
    .filter(
      (n) =>
        metadataMatchesEvaluationDate(n.metadata, evaluation.date) &&
        (!n.dedupe_key || !activeKeys.has(n.dedupe_key))
    )
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

  lastSyncByScope.set(key, {
    snapshotVersion: evaluation.source_snapshot_version,
    syncedAt: nowMs,
    startedAtMs,
  });
  if (lastSyncByScope.size > 40) {
    const oldest = lastSyncByScope.keys().next().value;
    if (oldest) lastSyncByScope.delete(oldest);
  }

  return {
    ...baseSummary,
    syncedTaskCount,
    resolvedTaskCount,
  };
}
