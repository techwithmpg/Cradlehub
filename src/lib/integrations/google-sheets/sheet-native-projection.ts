import "server-only";

import { projectSheetTab } from "./sheet-review-projection";
import type { SheetReadResult } from "./sheet-reader";
import type { WorkbookSource } from "./workbook-source-map";
import type {
  SheetBookingReference,
  SheetNativeReferencesState,
  SheetTransactionReference,
} from "./sheet-native-types";

/** Parsing a time changes only sort order, never the displayed Sheet value. */
export function sheetTimeMinute(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > (match[3] ? 12 : 23) || hour < (match[3] ? 1 : 0)) return null;
  if (!match[3]) return hour * 60 + minute;
  return ((hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + minute;
}

export function projectNativeReferences(
  read: Extract<SheetReadResult, { status: "available" }>,
  mapping: WorkbookSource,
  businessDate: string,
  observedAt: string
): SheetNativeReferencesState {
  // The parser's workbook identity must agree with the approved mapping.
  if (
    read.current.spreadsheetId !== mapping.workbookId ||
    read.previous.spreadsheetId !== mapping.workbookId
  ) {
    return { status: "unavailable", observedAt };
  }

  const bookings: SheetBookingReference[] = [];
  const payments: SheetTransactionReference[] = [];
  for (const tab of [read.current, read.previous]) {
    for (const visit of projectSheetTab(tab).visits) {
      if (visit.businessDate !== businessDate) continue;
      const base = {
        sourceType: "MASTER_SHEET" as const,
        readOnly: true as const,
        canonicalLink: "UNLINKED" as const,
        branchId: mapping.branchId,
        branchLabel: mapping.label,
        branchDecisionStatus: mapping.decisionStatus,
        businessDate,
        source: visit.source,
        observedAt,
        reviewWarnings: visit.reviewReasons,
      };
      bookings.push({
        ...base,
        kind: "sheet_booking_reference",
        timeText: visit.time,
        sortMinute: sheetTimeMinute(visit.time),
        customerDisplay: visit.customerDisplay,
        attendantDisplay: visit.staffDisplay,
        services: visit.services,
        possibleMatch: null,
      });
      visit.financialEvidence.forEach((evidence, index) => {
        payments.push({
          ...base,
          kind: "sheet_transaction_reference",
          evidenceKey: `${visit.source.sourceKey}:${index}`,
          timeText: visit.time,
          sortMinute: sheetTimeMinute(visit.time),
          customerDisplay: visit.customerDisplay,
          channel: evidence.channel,
          amount: evidence.amount,
          ambiguous: evidence.ambiguous,
        });
      });
    }
  }
  if (bookings.length === 0 && payments.length === 0) {
    return {
      status: "available_empty",
      observedAt,
      branchLabel: mapping.label,
      bookings: [],
      payments: [],
    };
  }
  return { status: "available", observedAt, branchLabel: mapping.label, bookings, payments };
}
