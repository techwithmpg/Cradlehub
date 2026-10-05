import { addDays, parseWeeklyTab } from "@/lib/integrations/google-sheets/sheet-week";
import type { MasterSheetReviewResult } from "@/lib/integrations/google-sheets/sheet-review-service";
import type { WorkbookSource } from "@/lib/integrations/google-sheets/workbook-source-map";
import type { MasterSheetEvidenceSummary } from "./reports-types";

const empty = (
  status: MasterSheetEvidenceSummary["status"],
  observedAt: string
): MasterSheetEvidenceSummary => ({
  status,
  observedAt,
  coverage: "UNAVAILABLE",
  totalRecords: 0,
  visitCount: 0,
  dutyCount: 0,
  needsReviewCount: 0,
  evidenceAmount: 0,
  effectOnCanonicalTotals: 0,
});

export function projectOwnerSheetEvidence(
  result: MasterSheetReviewResult | null,
  source: WorkbookSource | null,
  scope: { branchId: string; from: string; to: string }
): MasterSheetEvidenceSummary {
  const observedAt =
    result && "observedAt" in result ? result.observedAt : new Date().toISOString();
  if (!source)
    return {
      ...empty(scope.branchId === "all" ? "unavailable" : "no_source", observedAt),
      scopeNote:
        scope.branchId === "all"
          ? "Master Sheet source mapping is unavailable."
          : "No Master Sheet source configured for this branch",
    };
  if (scope.branchId !== "all" && scope.branchId !== source.branchId) {
    return {
      ...empty("no_source", observedAt),
      scopeNote: "No Master Sheet source configured for this branch",
    };
  }
  const sourceFields = {
    sourceWorkbook: source.workbookLabel,
    mappedBranch: source.label,
    mappingStatus: source.decisionStatus,
    scopeNote:
      scope.branchId === "all"
        ? `${source.label} only; All Branches canonical scope has partial external source coverage.`
        : `${source.label} — provisional source mapping.`,
  } as const;
  if (!result || result.status !== "available") {
    return { ...empty(result?.status ?? "unavailable", observedAt), ...sourceFields };
  }
  const current = parseWeeklyTab(result.current.sheetName);
  const previous = parseWeeklyTab(result.previous.sheetName);
  if (!current || !previous || addDays(previous.endDate, 1) !== current.startDate) {
    return {
      ...empty("unavailable", observedAt),
      ...sourceFields,
      scopeNote: "Weekly source coverage could not be verified.",
    };
  }
  const coverageFrom = previous.startDate;
  const coverageTo = current.endDate;
  const coverage =
    scope.to < coverageFrom || scope.from > coverageTo
      ? ("NO_COVERAGE" as const)
      : scope.from >= coverageFrom && scope.to <= coverageTo
        ? ("FULL_COVERAGE" as const)
        : ("PARTIAL_COVERAGE" as const);
  const inRange = (date: string | null) =>
    Boolean(
      date && date >= scope.from && date <= scope.to && date >= coverageFrom && date <= coverageTo
    );
  const visits = [...result.current.visits, ...result.previous.visits].filter((v) =>
    inRange(v.businessDate)
  );
  const duties = [...result.current.duties, ...result.previous.duties].filter((v) =>
    inRange(v.businessDate)
  );
  const reviews = [...result.current.review, ...result.previous.review].filter((v) =>
    inRange(v.businessDate)
  );
  const financial = visits.flatMap((v) => v.financialEvidence);
  const known = financial.filter((e) => e.amount !== null && !e.ambiguous);
  return {
    status: "available",
    observedAt,
    coverage,
    coverageFrom,
    coverageTo,
    currentTab: result.current.sheetName,
    previousTab: result.previous.sheetName,
    ...sourceFields,
    sources: [
      {
        workbook: sourceFields.sourceWorkbook,
        branch: source.label,
        mapping: source.decisionStatus,
        coverage,
        from: coverageFrom,
        to: coverageTo,
        currentTab: result.current.sheetName,
        previousTab: result.previous.sheetName,
      },
    ],
    totalRecords: visits.length + duties.length + reviews.length,
    visitCount: visits.length,
    dutyCount: duties.length,
    needsReviewCount: reviews.length,
    evidenceAmount: known.reduce((sum, e) => sum + (e.amount ?? 0), 0),
    amountKnownCount: known.length,
    amountUnknownCount: financial.length - known.length,
    effectOnCanonicalTotals: 0,
    recentVisits: visits.slice(0, 30).map((v) => ({
      id: v.source.sourceKey,
      date: v.businessDate,
      time: v.time,
      customer: v.customerDisplay,
      attendant: v.staffDisplay,
      services: v.services.map((s) => s.name).join(", ") || "Unspecified",
      channel: v.financialEvidence.map((e) => e.channel).join(", ") || "Unrecorded",
      amount:
        v.financialEvidence.length &&
        v.financialEvidence.every((e) => e.amount !== null && !e.ambiguous)
          ? v.financialEvidence.reduce((sum, e) => sum + (e.amount ?? 0), 0)
          : null,
      reasons: v.reviewReasons,
      source: `${v.source.sheetName} (r${v.source.startRow}-${v.source.endRow})`,
      workbook: source.workbookLabel,
    })),
    recentReviews: reviews.slice(0, 30).map((r) => ({
      id: r.source.sourceKey,
      date: r.businessDate,
      classification: r.classification,
      reasons: r.reviewReasons,
      source: `${r.source.sheetName} (r${r.source.startRow}-${r.source.endRow})`,
      workbook: source.workbookLabel,
    })),
  };
}
