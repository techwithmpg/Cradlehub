import "server-only";

import { ambiguousPaymentColumns, buildSheetReviewEntries } from "./sheet-review";
import type { SheetReviewEntry, SheetReviewReason } from "./sheet-review";
import { createGoogleSheetsReader } from "./sheet-reader";
import type { SheetReader, SheetReadResult, SheetTokenProvider } from "./sheet-reader";
import type { SheetProjection, SheetRowClassification } from "./sheet-types";

export interface SheetTabDiagnostics {
  sheetName: string;
  sourceRowCount: number;
  visitCount: number;
  recognizedVisits: number;
  dutyCount: number;
  recognizedDuties: number;
  needsReviewCount: number;
  classificationCounts: Record<SheetRowClassification, number>;
  multiServiceVisits: number;
  serviceLineCount: number;
  visitsMissingBusinessDate: number;
  visitsWithBusinessDate: number;
  visitsCrossingDayBoundary: number;
  outOfWeekDateCount: number;
  staleSummaryDateRejectedCount: number;
  dateBoundaryAmbiguousCount: number;
  visitsMissingCustomer: number;
  visitsMissingAttendant: number;
  visitsWithAmbiguousPaymentMarkers: number;
  orphanContinuations: number;
  unassignedFinancialNotes: number;
  reviewReasonCounts: Partial<Record<SheetReviewReason, number>>;
  reviewEntries: SheetReviewEntry[];
}

export type SheetDiagnosticResult =
  | { status: "available"; current: SheetTabDiagnostics; previous: SheetTabDiagnostics }
  | { status: "unavailable"; reason: "DIAGNOSTICS_DISABLED" }
  | Extract<SheetReadResult, { status: "unavailable" }>;

export function summarizeSheetProjection(projection: SheetProjection): SheetTabDiagnostics {
  const classificationCounts: SheetTabDiagnostics["classificationCounts"] = {
    HEADER: 0,
    SUMMARY: 0,
    STAFF_DUTY: 0,
    SERVICE: 0,
    FINANCIAL_NOTE: 0,
    INFORMATIONAL: 0,
    UNKNOWN_NEEDS_REVIEW: 0,
  };
  for (const row of projection.classifiedRows) classificationCounts[row.classification] += 1;

  const reviewEntries = buildSheetReviewEntries(projection);
  const dayBoundaryRows = projection.classifiedRows
    .filter((row) =>
      /^(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/i.test(
        row.rawCells[0]?.trim() ?? ""
      )
    )
    .map((row) => row.sourceRow);
  const reviewReasonCounts: SheetTabDiagnostics["reviewReasonCounts"] = {};
  for (const entry of reviewEntries) {
    for (const reason of entry.reasons)
      reviewReasonCounts[reason] = (reviewReasonCounts[reason] ?? 0) + 1;
  }

  return {
    sheetName: projection.sheetName,
    sourceRowCount: projection.sourceRowCount,
    visitCount: projection.visits.length,
    recognizedVisits: projection.visits.filter((visit) => visit.confidence === "recognized").length,
    dutyCount: projection.duties.length,
    recognizedDuties: projection.duties.filter((duty) => duty.confidence === "recognized").length,
    needsReviewCount: reviewEntries.length,
    classificationCounts,
    multiServiceVisits: projection.visits.filter((visit) => visit.services.length > 1).length,
    serviceLineCount: projection.visits.reduce((total, visit) => total + visit.services.length, 0),
    visitsMissingBusinessDate: projection.visits.filter((visit) => !visit.businessDate).length,
    visitsWithBusinessDate: projection.visits.filter((visit) => Boolean(visit.businessDate)).length,
    visitsCrossingDayBoundary: projection.visits.filter((visit) =>
      dayBoundaryRows.some((row) => row > visit.source.startRow && row <= visit.source.endRow)
    ).length,
    outOfWeekDateCount: reviewReasonCounts.OUT_OF_WEEK_DATE ?? 0,
    staleSummaryDateRejectedCount: projection.classifiedRows.filter(
      (row) => row.reason === "Stale summary date rejected"
    ).length,
    dateBoundaryAmbiguousCount: reviewReasonCounts.DATE_BOUNDARY_AMBIGUOUS ?? 0,
    visitsMissingCustomer: projection.visits.filter((visit) => !visit.customerRawName).length,
    visitsMissingAttendant: projection.visits.filter((visit) => !visit.attendantRawNames).length,
    visitsWithAmbiguousPaymentMarkers: projection.visits.filter(
      (visit) => ambiguousPaymentColumns(visit).length > 0
    ).length,
    orphanContinuations: reviewReasonCounts.ORPHAN_CONTINUATION ?? 0,
    unassignedFinancialNotes: reviewReasonCounts.UNASSIGNED_FINANCIAL_NOTE ?? 0,
    reviewReasonCounts,
    reviewEntries,
  };
}

/** In-process diagnostic harness. No route, logging, or data persistence is created. */
export async function readSheetDiagnostics(
  reader: SheetReader,
  businessDate?: string
): Promise<SheetDiagnosticResult> {
  if (process.env.NODE_ENV === "production") {
    return { status: "unavailable", reason: "DIAGNOSTICS_DISABLED" };
  }
  const result = await reader.readCurrentAndPrevious(businessDate);
  if (result.status === "unavailable") return result;
  return {
    status: "available",
    current: summarizeSheetProjection(result.current),
    previous: summarizeSheetProjection(result.previous),
  };
}

/** Development/test entry point. A server-only token provider must be supplied for a live read. */
export async function readCradleMasterSheetDiagnostics(
  tokenProvider?: SheetTokenProvider,
  businessDate?: string
): Promise<SheetDiagnosticResult> {
  return readSheetDiagnostics(createGoogleSheetsReader({ tokenProvider }), businessDate);
}
