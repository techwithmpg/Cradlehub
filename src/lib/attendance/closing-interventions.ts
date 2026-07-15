import "server-only";

import { asAttendanceDb } from "@/lib/attendance/db";
import { logError, logInfo } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const CLOSING_INTERVENTION_STAGES = [
  "reminder",
  "manager_escalation",
  "auto_close",
  "catch_up",
] as const;

export type ClosingInterventionStage =
  (typeof CLOSING_INTERVENTION_STAGES)[number];

export type ClosingInterventionRunResult = {
  stage: ClosingInterventionStage;
  processedAt: string;
  batchSize: number;
  examined: number;
  applied: number;
  skipped: number;
  failed: number;
  autoClosed: number;
  activeServiceBlocks: number;
};

export function isClosingInterventionStage(
  value: unknown
): value is ClosingInterventionStage {
  return (
    typeof value === "string" &&
    CLOSING_INTERVENTION_STAGES.includes(value as ClosingInterventionStage)
  );
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeSummary(
  stage: ClosingInterventionStage,
  data: unknown
): ClosingInterventionRunResult {
  const value = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};

  return {
    stage: isClosingInterventionStage(value.stage) ? value.stage : stage,
    processedAt:
      typeof value.processedAt === "string"
        ? value.processedAt
        : new Date(0).toISOString(),
    batchSize: numberValue(value.batchSize),
    examined: numberValue(value.examined),
    applied: numberValue(value.applied),
    skipped: numberValue(value.skipped),
    failed: numberValue(value.failed),
    autoClosed: numberValue(value.autoClosed),
    activeServiceBlocks: numberValue(value.activeServiceBlocks),
  };
}

export async function runClosingAttendanceInterventions(
  stage: ClosingInterventionStage = "catch_up",
  processedAt = new Date(),
  batchSize = 50
): Promise<ClosingInterventionRunResult> {
  const admin = asAttendanceDb(createAdminClient());
  const { data, error } = await admin.rpc(
    "process_due_attendance_closing_interventions",
    {
      p_stage: stage,
      p_processed_at: processedAt.toISOString(),
      p_batch_size: batchSize,
    }
  );

  if (error) {
    logError("attendance.closing_interventions.failed", {
      stage,
      error,
    });
    throw new Error("Closing Attendance intervention processing failed.");
  }

  const result = sanitizeSummary(stage, data);
  logInfo("attendance.closing_interventions.completed", result);
  return result;
}
