import { buildSheetAccountingReport } from "./sheet-accounting";
import { parseWeeklySheet } from "./sheet-parser";
import { restoreMergedIdentityCells } from "./sheet-merge-normalizer";
import type { GoogleSheetCell, GoogleSheetMergeRange } from "./sheet-reader";
import type { SheetCapturedRow, SheetCheck } from "./sheet-ingestion-types";
import { buildSheetSourceIdentity, inspectSheetSchema } from "./sheet-source-identity";
import { planSheetRow } from "./sheet-projection-planner";
import { findSheetConflictCandidates, preflightSheetRow, sheetIssue } from "./sheet-preflight";
import {
  buildSheetContextIndexes,
  collectSheetContextNeeds,
  unavailableSheetContext,
  type SheetContext,
  type SheetContextNeeds,
} from "./sheet-resolution-context";
import { resolveSheetIntent, validateSheetIntent } from "./sheet-validation";
import { decideSheetRow, deriveSheetAttention } from "./sheet-attention";

export type SheetDryRunInput = {
  spreadsheetId: string;
  sheetName: string;
  rawValues: GoogleSheetCell[][];
  merges: GoogleSheetMergeRange[];
  now?: Date;
  context?: SheetContext;
  loadContext?: (needs: SheetContextNeeds) => Promise<SheetContext>;
};

/** No writer capability is accepted or returned. All source values stay in memory. */
export async function buildSheetIngestionDryRun(input: SheetDryRunInput) {
  const totalStart = performance.now();
  const timings: Record<string, number> = {};
  function measured<T>(name: string, fn: () => T): T {
    const started = performance.now();
    const result = fn();
    timings[name] = performance.now() - started;
    return result;
  }
  const now = input.now ?? new Date();
  const raw = measured("rawParse", () => parseWeeklySheet(input.rawValues));
  const normalized = measured("mergeNormalization", () =>
    restoreMergedIdentityCells({
      values: input.rawValues,
      merges: input.merges,
      targets: raw.rows.flatMap((row) =>
        (
          [
            ["MISSING_OR_CONTINUATION_TIME", 2],
            ["MISSING_OR_CONTINUATION_ATTENDANT", 3],
            ["MISSING_OR_CONTINUATION_CLIENT", 4],
          ] as const
        ).flatMap(([issue, column]) =>
          row.issues.includes(issue) ? [{ sourceRow: row.sourceRow, sourceColumn: column }] : []
        )
      ),
    })
  );
  const parsed = measured("normalizedParse", () => parseWeeklySheet(normalized.values));
  if (raw.meaningfulRowCount !== parsed.meaningfulRowCount)
    throw new Error("Raw/normalized meaningful-row invariant failed.");
  const accounting = buildSheetAccountingReport(parsed);
  const schema = inspectSheetSchema(input.rawValues);
  const rawByRow = new Map(raw.rows.map((row) => [row.sourceRow, row]));
  const restorations = new Map<number, SheetCapturedRow["restorations"]>();
  for (const cell of normalized.restorations)
    restorations.set(cell.sourceRow, [
      ...(restorations.get(cell.sourceRow) ?? []),
      { column: cell.sourceColumn, ownerRow: cell.ownerRow, ownerColumn: cell.ownerColumn },
    ]);
  const captured: SheetCapturedRow[] = measured("sourceCapture", () =>
    parsed.rows.map((row) => {
      const original = rawByRow.get(row.sourceRow);
      if (!original) throw new Error("Normalized row lacks raw source evidence.");
      return {
        source: buildSheetSourceIdentity(
          input.spreadsheetId,
          input.sheetName,
          row,
          original.rawValues
        ),
        rawValues: [...original.rawValues],
        parsed: row,
        restorations: restorations.get(row.sourceRow) ?? [],
      };
    })
  );
  const plans = measured("projectionPlanning", () => captured.map(planSheetRow));
  const conflicts = measured("sameSheetConflicts", () =>
    findSheetConflictCandidates(captured, plans)
  );
  const preflight = measured("preflight", () =>
    captured.map((row, i) => [
      ...schema.checks,
      ...preflightSheetRow(row, plans[i]!),
      ...conflicts
        .filter((conflict) => conflict.sourceRows.includes(row.source.sourceRow))
        .map((conflict) => ({
          ...sheetIssue(
            conflict.type === "provider_overlap"
              ? "SAME_SHEET_PROVIDER_OVERLAP"
              : conflict.type === "duplicate_source"
                ? "DUPLICATE_SOURCE"
                : "POSSIBLE_DUPLICATE_BOOKING",
            "source",
            "Review the related source rows; similarity is a conflict candidate, not proof of duplication.",
            { sourceRows: conflict.sourceRows, ...conflict.evidence }
          ),
          severity: conflict.severity,
        })),
    ])
  );
  const contextStart = performance.now();
  // Unknown layout must never trigger canonical lookups based on guessed columns.
  const context = schema.checks.every((check) => check.passed)
    ? (input.context ??
      (input.loadContext
        ? await input.loadContext(collectSheetContextNeeds(captured))
        : unavailableSheetContext("No authenticated canonical context was supplied.")))
    : unavailableSheetContext("Source schema requires confirmation.");
  const indexes = buildSheetContextIndexes(context);
  timings.contextLoad = performance.now() - contextStart;
  const resolved = measured("resolution", () =>
    captured.map((row, i) => resolveSheetIntent(row, plans[i]!, indexes))
  );
  // Aliases can resolve to the same provider even when raw labels differ. Use canonical
  // identity and duration too, without replacing any staff to avoid a conflict.
  const canonicalConflicts = measured("resolvedSheetConflicts", () =>
    findSheetConflictCandidates(
      captured.map((row, i) => {
        const intent = resolved[i]!;
        return {
          ...row,
          parsed: {
            ...row.parsed,
            attendant: intent.staff.value?.id ?? row.parsed.attendant,
            client: intent.customer.value?.id ?? row.parsed.client,
            service: intent.service.value?.id ?? row.parsed.service,
            hours:
              intent.durationMinutes === null
                ? row.parsed.hours
                : String(
                    (intent.durationMinutes +
                      (intent.service.value?.buffer_before ?? 0) +
                      (intent.service.value?.buffer_after ?? 0)) /
                      60
                  ),
          },
        };
      }),
      plans
    )
  );
  const conflictKeys = new Set(conflicts.map((c) => `${c.type}:${c.sourceRows.join(":")}`));
  for (const conflict of canonicalConflicts) {
    const key = `${conflict.type}:${conflict.sourceRows.join(":")}`;
    if (conflictKeys.has(key)) continue;
    conflictKeys.add(key);
    const candidate = {
      ...conflict,
      evidence: { ...conflict.evidence, identityNotYetResolved: false },
    };
    conflicts.push(candidate);
    captured.forEach((row, i) => {
      if (candidate.sourceRows.includes(row.source.sourceRow))
        preflight[i]!.push(
          sheetIssue(
            candidate.type === "provider_overlap"
              ? "SAME_SHEET_PROVIDER_OVERLAP"
              : "POSSIBLE_DUPLICATE_BOOKING",
            "source",
            "Review rows that resolve to overlapping or duplicate canonical booking intents.",
            { sourceRows: candidate.sourceRows, ...candidate.evidence }
          )
        );
    });
  }
  const validation = measured("deepValidation", () =>
    captured.map((row, i) => validateSheetIntent(row, plans[i]!, resolved[i]!, indexes, now))
  );
  const rows = measured("decisionAndAttention", () =>
    captured.map((row, i) => {
      const checks: SheetCheck[] = [...preflight[i]!, ...validation[i]!];
      const plan = decideSheetRow(
        {
          ...plans[i]!,
          delivery: { ...plans[i]!.delivery, confirmedDelivery: resolved[i]!.deliveryType },
        },
        checks
      );
      const label =
        [row.parsed.location, row.parsed.client, row.parsed.service].find(Boolean) ?? "";
      const subtype = /^(expenses?|laundry|gas)$/i.test(label)
        ? "expense"
        : /^tip$/i.test(label)
          ? "tip"
          : /^advance payment$/i.test(label)
            ? "advance"
            : /^gift voucher$/i.test(label)
              ? "voucher"
              : "unknown_financial";
      return {
        ...row,
        plan,
        checks,
        resolution: resolved[i]!,
        attention: deriveSheetAttention(row, plan, checks),
        bookingIntent:
          plan.intent === "service"
            ? {
                source: row.source,
                businessDate: row.parsed.businessDate,
                ...resolved[i]!,
                deliveryEvidence: plan.delivery,
                pricingEvidence: { rate: row.parsed.rate, raw: row.parsed.rateRaw },
                paymentEvidence: plan.financial,
              }
            : null,
        financialIntent:
          plan.intent === "financial"
            ? {
                source: row.source,
                businessDate: row.parsed.businessDate,
                rawLabel: label,
                rawDescription: [...row.rawValues],
                amountComponents: plan.financial,
                candidateSubtype: subtype,
                subtypeConfidence: subtype === "unknown_financial" ? "unresolved" : "exact_label",
                relatedStaffCandidate: resolved[i]!.staff,
                relatedCustomerCandidate: resolved[i]!.customer,
              }
            : null,
        dutyIntent:
          plan.intent === "duty"
            ? {
                source: row.source,
                businessDate: row.parsed.businessDate,
                staffResolution: resolved[i]!.staff,
                branchCandidate: resolved[i]!.branchCandidate,
                dutyType: row.parsed.service,
                rawDuty: row.rawValues[5],
              }
            : null,
      };
    })
  );
  const decisions = { ready: 0, warning: 0, needs_attention: 0, informational: 0 };
  for (const row of rows) decisions[row.plan.decision]++;
  if (
    rows.length !== accounting.totalMeaningfulRows ||
    Object.values(decisions).reduce((a, b) => a + b, 0) !== parsed.meaningfulRowCount ||
    new Set(rows.map((row) => row.source.sourceRow)).size !== rows.length
  )
    throw new Error("Zero-silent-drop accounting failed.");
  const result = {
    sheetName: input.sheetName,
    rowsRead: input.rawValues.length,
    rawMeaningfulRows: raw.meaningfulRowCount,
    normalizedMeaningfulRows: parsed.meaningfulRowCount,
    countsByType: parsed.countsByType,
    decisions,
    schema,
    contextStatus: context.status,
    contextTarget: context.target,
    restorationCounts: {
      attendant: normalized.restorations.filter((r) => r.sourceColumn === 3).length,
      client: normalized.restorations.filter((r) => r.sourceColumn === 4).length,
      time: normalized.restorations.filter((r) => r.sourceColumn === 2).length,
      total: normalized.restorations.length,
    },
    businessDates: collectSheetContextNeeds(captured).dates,
    conflicts,
    rows,
    timings,
    writes: {
      bookings: 0,
      cash_flow: 0,
      schedule: 0,
      home_service: 0,
      googleSheet: 0,
      supabase: 0,
      notifications: 0,
      migrations: 0,
    } as const,
  };
  timings.total = performance.now() - totalStart;
  return result;
}
export type SheetIngestionDryRun = Awaited<ReturnType<typeof buildSheetIngestionDryRun>>;

/** Privacy-safe aggregate only. Never log the full report/rows or raw attention objects. */
export function summarizeSheetDryRun(run: SheetIngestionDryRun) {
  const started = performance.now();
  const serviceRows = run.rows.filter((row) => row.plan.intent === "service");
  const countChecks = (code: string) =>
    run.rows.filter((row) => row.checks.some((c) => c.code === code && c.passed === false)).length;
  const count = <T>(rows: T[], key: (row: T) => string) =>
    rows.reduce<Record<string, number>>((out, row) => {
      const value = key(row);
      out[value] = (out[value] ?? 0) + 1;
      return out;
    }, {});
  const attention = run.rows.flatMap((row) => row.attention);
  const summary = {
    sheetName: run.sheetName,
    rowsRead: run.rowsRead,
    parsing: {
      meaningful: run.rawMeaningfulRows,
      normalizedMeaningful: run.normalizedMeaningfulRows,
      silentDrops: run.rawMeaningfulRows - run.rows.length,
    },
    schemaValid: run.schema.checks.every((c) => c.passed),
    schemaFingerprint: run.schema.fingerprint,
    rowTypes: run.countsByType,
    decisions: run.decisions,
    restorations: run.restorationCounts,
    businessDates: run.businessDates,
    moduleRouting: Object.fromEntries(
      (["bookings", "cash_flow", "schedule", "home_service"] as const).map((module) => [
        module,
        run.rows.filter((row) => row.plan.projections.some((p) => p.module === module)).length,
      ])
    ),
    context: { status: run.contextStatus, target: run.contextTarget },
    resolution: {
      staff: count(serviceRows, (row) =>
        row.resolution.staff.method === "unavailable"
          ? "unavailable"
          : row.resolution.staff.status === "resolved"
            ? row.resolution.staff.method
            : row.resolution.staff.status
      ),
      staffServiceIncompatibleCandidates:
        run.contextStatus === "available"
          ? serviceRows.reduce(
              (sum, row) =>
                sum +
                (row.resolution.staff.rejected?.filter((r) => r.reason === "service_incompatible")
                  .length ?? 0),
              0
            )
          : null,
      services: count(serviceRows, (row) =>
        row.resolution.service.method === "unavailable"
          ? "unavailable"
          : row.resolution.service.status === "resolved"
            ? row.resolution.service.method
            : row.resolution.service.status
      ),
      customers: count(serviceRows, (row) => row.resolution.customer.classification),
    },
    homeService: {
      evidenceStates: count(serviceRows, (row) => row.plan.delivery.state),
      locationOnly: serviceRows.filter(
        (row) =>
          row.plan.delivery.location &&
          !(row.plan.delivery.numericFuel !== null && row.plan.delivery.numericFuel > 0)
      ).length,
      numericFuelOnly: serviceRows.filter(
        (row) =>
          !row.plan.delivery.location &&
          row.plan.delivery.numericFuel !== null &&
          row.plan.delivery.numericFuel > 0
      ).length,
      both: serviceRows.filter(
        (row) =>
          row.plan.delivery.location &&
          row.plan.delivery.numericFuel !== null &&
          row.plan.delivery.numericFuel > 0
      ).length,
      neither: serviceRows.filter(
        (row) =>
          !row.plan.delivery.location &&
          !(row.plan.delivery.numericFuel !== null && row.plan.delivery.numericFuel > 0)
      ).length,
      nonNumericTravelMarker: serviceRows.filter((row) => row.plan.delivery.marker !== null).length,
      explicitMarker: serviceRows.filter(
        (row) => row.plan.delivery.state === "explicit_home_service"
      ).length,
    },
    financial: {
      serviceRowsWithNumericPayment: serviceRows.filter((row) =>
        row.plan.financial.payments.some((p) => p.amount !== null)
      ).length,
      splitPaymentRows: serviceRows.filter((row) => row.plan.financial.splitPayment).length,
      paymentMarkerRows: run.rows.filter(
        (row) =>
          !["aggregate", "context"].includes(row.plan.intent) &&
          row.plan.financial.payments.some((p) => p.marker)
      ).length,
      financialOnlyRows: run.rows.filter((row) => row.plan.intent === "financial").length,
      aggregateRows: run.rows.filter((row) => row.plan.intent === "aggregate").length,
      unexplainedPaymentDifferences: countChecks("PAYMENT_MISMATCH"),
      fuelTravelEvidenceRows: serviceRows.filter(
        (row) => row.plan.financial.fuelOrTravel !== null || row.plan.delivery.marker
      ).length,
      commissionEvidenceRows: serviceRows.filter((row) => row.plan.financial.commission !== null)
        .length,
    },
    schedule: {
      dutyRows: run.rows.filter((row) => row.plan.intent === "duty").length,
      derivedBookingWorkload: serviceRows.length,
    },
    conflicts: {
      sameSheetCandidates: count(run.conflicts, (c) => c.type),
      scheduleConflicts:
        run.contextStatus === "available" ? countChecks("STAFF_SCHEDULE_CONFLICT") : null,
      canonicalBookingOverlaps:
        run.contextStatus === "available" ? countChecks("CANONICAL_BOOKING_OVERLAP") : null,
      homeServiceAmbiguity: countChecks("HOME_SERVICE_UNCERTAIN"),
    },
    attention: {
      items: attention.length,
      rows: run.rows.filter((r) => r.attention.length).length,
      byReason: count(attention, (item) => item.code),
    },
    performanceMs: { ...run.timings, reportGeneration: performance.now() - started } as Record<
      string,
      number
    >,
    writes: run.writes,
  };
  return summary;
}
