import { buildSheetReviewEntries, type SheetReviewReason } from "./sheet-review";
import type { SheetReadResult } from "./sheet-reader";
import type { SheetProjection, SheetSource } from "./sheet-types";

type ExternalBase = {
  sourceType: "MASTER_SHEET";
  readOnly: true;
  branchState: "BRANCH_UNKNOWN";
  canonicalLink: "UNLINKED";
  source: Pick<
    SheetSource,
    "sheetName" | "startRow" | "endRow" | "sourceKey" | "contentFingerprint"
  >;
  businessDate: string | null;
  reviewReasons: SheetReviewReason[];
};

export type SheetVisitReference = ExternalBase & {
  kind: "visit";
  time: string | null;
  customerDisplay: string | null;
  staffDisplay: string | null;
  services: { name: string; hours: number | null }[];
  locationEvidence: string | null;
  financialEvidence: {
    channel: "Cash" | "GCash" | "Bank / QR" | "Card / terminal";
    amount: number | null;
    ambiguous: boolean;
  }[];
};

export type SheetDutyReference = ExternalBase & {
  kind: "duty";
  staffDisplay: string | null;
  dutyLabel: string | null;
};

export type SheetReviewReference = ExternalBase & {
  kind: "review";
  classification: "SERVICE" | "STAFF_DUTY" | "FINANCIAL_NOTE" | "UNKNOWN_NEEDS_REVIEW";
};

export type SheetReviewRecord = SheetVisitReference | SheetDutyReference | SheetReviewReference;

export type SheetReviewTab = {
  sheetName: string;
  visits: SheetVisitReference[];
  duties: SheetDutyReference[];
  review: SheetReviewReference[];
};

export type SheetReviewState =
  | { status: "unavailable"; observedAt: string; current?: never; previous?: never }
  | { status: "available"; observedAt: string; current: SheetReviewTab; previous: SheetReviewTab };

function sourceOf(source: SheetSource): ExternalBase["source"] {
  return {
    sheetName: source.sheetName,
    startRow: source.startRow,
    endRow: source.endRow,
    sourceKey: source.sourceKey,
    contentFingerprint: source.contentFingerprint,
  };
}

function displayText(value: string): string | null {
  const text = value.trim();
  return text ? text.slice(0, 160) : null;
}

function amount(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

export function projectSheetTab(projection: SheetProjection): SheetReviewTab {
  const reviews = buildSheetReviewEntries(projection);
  const reasons = new Map<string, SheetReviewReason[]>();
  for (const review of reviews) reasons.set(review.source.sourceKey, review.reasons);
  const sources = new Map<string, SheetSource>();
  for (const record of [...projection.visits, ...projection.duties, ...projection.needsReview]) {
    sources.set(record.source.sourceKey, record.source);
  }

  const base = (source: SheetSource, businessDate: string | null): ExternalBase => ({
    sourceType: "MASTER_SHEET",
    readOnly: true,
    branchState: "BRANCH_UNKNOWN",
    canonicalLink: "UNLINKED",
    source: sourceOf(source),
    businessDate,
    reviewReasons: reasons.get(source.sourceKey) ?? [],
  });

  return {
    sheetName: projection.sheetName,
    visits: projection.visits.map((visit): SheetVisitReference => {
      const financialEvidence: SheetVisitReference["financialEvidence"] = [];
      for (const payment of visit.paymentEvidence) {
        for (const [channel, value] of [
          ["Cash", payment.cash],
          ["GCash", payment.gcash],
          ["Bank / QR", payment.bankQr],
          ["Card / terminal", payment.cardTerminal],
        ] as const) {
          if (value.raw.trim())
            financialEvidence.push({
              channel,
              amount: amount(value.amount),
              ambiguous: Boolean(value.marker && value.marker !== "-"),
            });
        }
      }
      return {
        ...base(visit.source, visit.businessDate),
        kind: "visit",
        time: displayText(visit.timeRaw),
        customerDisplay: displayText(visit.customerRawName),
        staffDisplay: displayText(visit.attendantRawNames),
        services: visit.services.map((service) => ({
          name: displayText(service.rawName) ?? "Unnamed service",
          hours: amount(service.hours.amount),
        })),
        locationEvidence: displayText(visit.locationRawValue),
        financialEvidence,
      };
    }),
    duties: projection.duties.map(
      (duty): SheetDutyReference => ({
        ...base(duty.source, duty.businessDate),
        kind: "duty",
        staffDisplay: displayText(duty.staffRawName),
        dutyLabel: displayText(duty.dutyRawValue),
      })
    ),
    review: reviews.map(
      (review): SheetReviewReference => ({
        ...base(sources.get(review.source.sourceKey)!, review.businessDate),
        kind: "review",
        classification: review.classification,
      })
    ),
  };
}

export function projectSheetRead(result: SheetReadResult, observedAt: string): SheetReviewState {
  if (result.status === "unavailable") return { status: "unavailable", observedAt };
  return {
    status: "available",
    observedAt,
    current: projectSheetTab(result.current),
    previous: projectSheetTab(result.previous),
  };
}
