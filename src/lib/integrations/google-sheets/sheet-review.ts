import "server-only";

import type { SheetProjection, SheetSource, SheetVisit } from "./sheet-types";

export type SheetReviewReason =
  | "MISSING_BUSINESS_DATE"
  | "MISSING_TIME"
  | "MISSING_CUSTOMER"
  | "MISSING_ATTENDANT"
  | "MISSING_STAFF"
  | "AMBIGUOUS_PAYMENT_MARKER"
  | "AMBIGUOUS_SERVICE_VALUE"
  | "ORPHAN_CONTINUATION"
  | "CONFLICTING_CONTINUATION"
  | "UNASSIGNED_FINANCIAL_NOTE"
  | "UNKNOWN_ROW"
  | "OTHER";

export interface SheetReviewEntry {
  source: Pick<SheetSource, "sheetName" | "startRow" | "endRow" | "sourceKey">;
  classification: "SERVICE" | "STAFF_DUTY" | "FINANCIAL_NOTE" | "UNKNOWN_NEEDS_REVIEW";
  businessDate: string | null;
  reasons: SheetReviewReason[];
  serviceLineCount: number;
  hasCustomer: boolean;
  hasAttendantOrStaff: boolean;
  ambiguousPaymentColumns: ("cash" | "gcash" | "bankQr" | "cardTerminal")[];
}

function sourceCoordinates(source: SheetSource): SheetReviewEntry["source"] {
  return {
    sheetName: source.sheetName,
    startRow: source.startRow,
    endRow: source.endRow,
    sourceKey: source.sourceKey,
  };
}

export function ambiguousPaymentColumns(visit: SheetVisit): SheetReviewEntry["ambiguousPaymentColumns"] {
  const columns: SheetReviewEntry["ambiguousPaymentColumns"] = [];
  for (const column of ["cash", "gcash", "bankQr", "cardTerminal"] as const) {
    if (visit.paymentEvidence.some((payment) => payment[column].marker && payment[column].marker !== "-")) {
      columns.push(column);
    }
  }
  return columns;
}

function visitReasons(visit: SheetVisit): SheetReviewReason[] {
  const reasons: SheetReviewReason[] = [];
  if (!visit.businessDate) reasons.push("MISSING_BUSINESS_DATE");
  if (!visit.timeRaw) reasons.push("MISSING_TIME");
  if (!visit.customerRawName) reasons.push("MISSING_CUSTOMER");
  if (!visit.attendantRawNames) reasons.push("MISSING_ATTENDANT");
  if (ambiguousPaymentColumns(visit).length) reasons.push("AMBIGUOUS_PAYMENT_MARKER");
  if (visit.ambiguities.some((ambiguity) => /^(?:HRS|RATE|FUEL|COMMISSION) marker/.test(ambiguity))) {
    reasons.push("AMBIGUOUS_SERVICE_VALUE");
  }
  return reasons.length ? reasons : ["OTHER"];
}

export function buildSheetReviewEntries(projection: SheetProjection): SheetReviewEntry[] {
  const entries: SheetReviewEntry[] = [];

  for (const visit of projection.visits) {
    if (visit.confidence !== "needs_review") continue;
    entries.push({
      source: sourceCoordinates(visit.source), classification: "SERVICE",
      businessDate: visit.businessDate, reasons: visitReasons(visit),
      serviceLineCount: visit.services.length, hasCustomer: Boolean(visit.customerRawName),
      hasAttendantOrStaff: Boolean(visit.attendantRawNames),
      ambiguousPaymentColumns: ambiguousPaymentColumns(visit),
    });
  }

  for (const duty of projection.duties) {
    if (duty.confidence !== "needs_review") continue;
    entries.push({
      source: sourceCoordinates(duty.source), classification: "STAFF_DUTY",
      businessDate: duty.businessDate,
      reasons: [
        ...(!duty.businessDate ? ["MISSING_BUSINESS_DATE" as const] : []),
        ...(!duty.staffRawName ? ["MISSING_STAFF" as const] : []),
      ],
      serviceLineCount: 0, hasCustomer: false,
      hasAttendantOrStaff: Boolean(duty.staffRawName), ambiguousPaymentColumns: [],
    });
  }

  for (const row of projection.needsReview) {
    const classification = projection.classifiedRows.find((classified) => classified.sourceRow === row.source.startRow)?.classification;
    const reason: SheetReviewReason = row.reason === "Orphan service continuation" ? "ORPHAN_CONTINUATION"
      : row.reason === "Conflicting continuation location" ? "CONFLICTING_CONTINUATION"
        : row.reason === "Unassigned financial note" ? "UNASSIGNED_FINANCIAL_NOTE" : "UNKNOWN_ROW";
    entries.push({
      source: sourceCoordinates(row.source),
      classification: classification === "FINANCIAL_NOTE" ? "FINANCIAL_NOTE" : "UNKNOWN_NEEDS_REVIEW",
      businessDate: row.businessDate, reasons: [reason],
      serviceLineCount: 0, hasCustomer: false,
      hasAttendantOrStaff: false, ambiguousPaymentColumns: [],
    });
  }

  return entries.sort((left, right) => left.source.startRow - right.source.startRow);
}
