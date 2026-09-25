import type {
  SheetAttentionItem,
  SheetCapturedRow,
  SheetCheck,
  SheetRowProjectionPlan,
  SheetSyncDecision,
  SheetSyncSeverity,
} from "./sheet-ingestion-types";
import { sheetHash } from "./sheet-source-identity";

const SEVERITIES: SheetSyncSeverity[] = ["low", "medium", "high", "critical"];
export function decideSheetRow(
  plan: SheetRowProjectionPlan,
  checks: SheetCheck[]
): SheetRowProjectionPlan {
  const failures = checks.filter((check) => check.passed !== true);
  const schemaFailure = failures.some((check) => check.phase === "schema");
  const informational =
    (plan.intent === "context" || plan.intent === "aggregate") && !schemaFailure;
  const decision: SheetSyncDecision = informational
    ? "informational"
    : failures.some((check) => check.impact === "needs_attention" || check.passed === null)
      ? "needs_attention"
      : failures.length
        ? "warning"
        : "ready";
  const severity =
    informational || !failures.length
      ? "low"
      : SEVERITIES[Math.max(...failures.map((check) => SEVERITIES.indexOf(check.severity)))]!;
  return {
    ...plan,
    decision,
    severity,
    reasons: [...new Set(failures.map((check) => check.code))],
    projections: plan.projections.map((projection) => ({
      ...projection,
      kind:
        decision === "needs_attention" && projection.kind === "canonical_write_candidate"
          ? "pending_confirmation"
          : projection.kind,
      waitingFor:
        decision === "needs_attention" && projection.kind !== "evidence_only"
          ? [
              ...new Set(
                failures
                  .filter((c) => c.impact === "needs_attention" || c.passed === null)
                  .map((c) => c.code)
              ),
            ]
          : [],
    })),
  };
}
export function deriveSheetAttention(
  row: SheetCapturedRow,
  plan: SheetRowProjectionPlan,
  checks: SheetCheck[]
): SheetAttentionItem[] {
  if (plan.decision === "informational" || plan.decision === "ready") return [];
  const fields: Record<string, { raw: unknown; normalized: unknown }> = {
    time: { raw: row.rawValues[1], normalized: row.parsed.time },
    attendant: { raw: row.rawValues[2], normalized: row.parsed.attendant },
    client: { raw: row.rawValues[3], normalized: row.parsed.client },
    hours: { raw: row.rawValues[4], normalized: row.parsed.hours },
    service: { raw: row.rawValues[5], normalized: row.parsed.service },
    delivery: { raw: [row.rawValues[0], row.rawValues[7]], normalized: plan.delivery },
    payments: { raw: row.rawValues.slice(8, 12), normalized: plan.financial.payments },
    rate: { raw: row.rawValues[6], normalized: row.parsed.rate },
    fuelOrTravel: { raw: row.rawValues[7], normalized: row.parsed.fuelOrTravel },
    commission: { raw: row.rawValues[12], normalized: row.parsed.commission },
    businessDate: { raw: row.rawValues[0], normalized: row.parsed.businessDate },
  };
  for (const [i, payment] of row.parsed.payments.entries())
    fields[`payments.${payment.method}`] = { raw: row.rawValues[8 + i], normalized: payment };
  const unique = new Map<string, SheetCheck>();
  for (const check of checks)
    if (check.passed !== true) unique.set(`${check.code}:${check.field}`, check);
  return [...unique.values()].map((check) => ({
    id: sheetHash([row.source.key, row.source.fingerprint, check.code, check.field]),
    source: row.source,
    decision:
      check.impact === "needs_attention" || check.passed === null ? "needs_attention" : "warning",
    severity: check.severity,
    code: check.code,
    title: check.message,
    summary: `Source row ${row.source.sourceRow}: ${check.message}`,
    field: check.field,
    rawValue: fields[check.field]?.raw ?? null,
    normalizedValue: fields[check.field]?.normalized ?? null,
    candidates: check.candidates ?? [],
    validationEvidence: check.evidence,
    affectedModules: plan.projections
      .filter((p) => p.kind !== "evidence_only")
      .map((p) => p.module),
    requiredAction: check.requiredAction,
    afterCorrection: "revalidate_before_apply",
  }));
}
