import type { PredictiveConflictItem, UnifiedEvaluationResult } from "./types";

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

export type OperationsAssistantHealthStatus =
  | "healthy"
  | "attention"
  | "degraded"
  | "unavailable";

export type TieredCrmOperationsSummary = {
  branchId: string;
  branchName: string;
  date: string;
  status: OperationsAssistantHealthStatus;
  engineSource: UnifiedEvaluationResult["engineSource"];
  pythonConfigured?: boolean;
  degradedReason?: string | null;
  evaluatedAt: string;
  sourceSnapshotVersion: string;
  persistentActions: PredictiveConflictItem[];
  earlyWarnings: PredictiveConflictItem[];
  quietOpportunities: PredictiveConflictItem[];
  syncedTaskCount: number;
  resolvedTaskCount: number;
};

export function buildUnavailableOptimizationSummary(params: {
  branchId: string;
  branchName?: string;
  date: string;
  reason?: string;
}): TieredCrmOperationsSummary {
  return {
    branchId: params.branchId,
    branchName: params.branchName ?? "Branch",
    date: params.date,
    status: "unavailable",
    engineSource: "ts_deterministic_fallback",
    pythonConfigured: Boolean(
      typeof process !== "undefined" && process.env?.CRADLEHUB_OPTIMIZER_URL?.trim()
    ),
    degradedReason:
      params.reason ??
      "Operations Assistant could not verify schedule commitments right now. Please retry.",
    evaluatedAt: new Date().toISOString(),
    sourceSnapshotVersion: `${params.date}:unavailable`,
    persistentActions: [],
    earlyWarnings: [],
    quietOpportunities: [],
    syncedTaskCount: 0,
    resolvedTaskCount: 0,
  };
}

export function summarizeOptimizationEvaluation(
  evaluation: UnifiedEvaluationResult,
  counts: { syncedTaskCount?: number; resolvedTaskCount?: number } = {}
): TieredCrmOperationsSummary {
  const branchScoped = evaluation.conflicts_and_opportunities.filter(
    (c) => c.branch_id === evaluation.branch_id
  );
  const persistentActions = branchScoped.filter(
    (c) => c.assistant_tier === "persistent_action_required"
  );
  const earlyWarnings = branchScoped.filter(
    (c) => c.assistant_tier === "early_warning_toast"
  );
  const quietOpportunities = branchScoped.filter(
    (c) => c.assistant_tier === "quiet_opportunity"
  );

  let status: OperationsAssistantHealthStatus = "healthy";
  if (persistentActions.length > 0 || earlyWarnings.length > 0) {
    status = "attention";
  } else if (evaluation.degraded) {
    status = "degraded";
  }

  return {
    branchId: evaluation.branch_id,
    branchName: evaluation.branchName,
    date: evaluation.date,
    status,
    engineSource: evaluation.engineSource,
    pythonConfigured: evaluation.pythonConfigured,
    degradedReason: evaluation.degradedReason ?? null,
    evaluatedAt: evaluation.evaluatedAt ?? new Date().toISOString(),
    sourceSnapshotVersion: evaluation.source_snapshot_version,
    persistentActions,
    earlyWarnings,
    quietOpportunities,
    syncedTaskCount: counts.syncedTaskCount ?? 0,
    resolvedTaskCount: counts.resolvedTaskCount ?? 0,
  };
}
