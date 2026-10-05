import { describe, expect, it } from "vitest";
import { projectOwnerSheetEvidence } from "@/lib/owner/sheet-report-projection";
import type { MasterSheetReviewResult } from "@/lib/integrations/google-sheets/sheet-review-service";
import type { WorkbookSource } from "@/lib/integrations/google-sheets/workbook-source-map";

const source: WorkbookSource = {
  workbookId: "test-workbook",
  workbookLabel: "TEST WORKBOOK",
  branchId: "main-id",
  label: "Main Branch",
  enabled: true,
  decisionStatus: "PROVISIONAL",
};
const visit = (date: string, amount: number | null, ambiguous = false) => ({
  businessDate: date,
  time: null,
  customerDisplay: "Sample",
  staffDisplay: "External name",
  services: [{ name: "Unknown service", hours: null }],
  financialEvidence: [{ channel: "Cash", amount, ambiguous }],
  reviewReasons: [],
  source: {
    sheetName: "OCT.2-8, 2026",
    startRow: 3,
    endRow: 3,
    sourceKey: date,
    contentFingerprint: "x",
  },
});
const result = {
  status: "available",
  observedAt: "2026-10-05T00:00:00.000Z",
  current: {
    sheetName: "OCT.2-8, 2026",
    visits: [visit("2026-10-04", 500), visit("2026-10-05", null)],
    duties: [],
    review: [],
  },
  previous: {
    sheetName: "SEP.25-OCT.1, 2026",
    visits: [visit("2026-09-29", 800, true)],
    duties: [],
    review: [],
  },
} as unknown as MasterSheetReviewResult;

describe("Owner Sheet reporting projection", () => {
  it("filters Today and 7 Days by business date without summing ambiguous evidence", () => {
    const today = projectOwnerSheetEvidence(result, source, {
      branchId: "main-id",
      from: "2026-10-04",
      to: "2026-10-04",
    });
    expect(today.coverage).toBe("FULL_COVERAGE");
    expect(today.visitCount).toBe(1);
    expect(today.evidenceAmount).toBe(500);
    expect(today.effectOnCanonicalTotals).toBe(0);
    const seven = projectOwnerSheetEvidence(result, source, {
      branchId: "main-id",
      from: "2026-09-29",
      to: "2026-10-05",
    });
    expect(seven.visitCount).toBe(3);
    expect(seven.evidenceAmount).toBe(500);
    expect(seven.amountUnknownCount).toBe(2);
  });

  it("reports partial and no coverage instead of presenting missing history as zero", () => {
    const partial = projectOwnerSheetEvidence(result, source, {
      branchId: "all",
      from: "2026-09-06",
      to: "2026-10-05",
    });
    expect(partial.coverage).toBe("PARTIAL_COVERAGE");
    expect(partial.scopeNote).toContain("partial external source coverage");
    expect(partial.mappingStatus).toBe("PROVISIONAL");
    const none = projectOwnerSheetEvidence(result, source, {
      branchId: "main-id",
      from: "2026-09-01",
      to: "2026-09-07",
    });
    expect(none.coverage).toBe("NO_COVERAGE");
    expect(none.visitCount).toBe(0);
  });

  it("does not send Main evidence to SM and keeps failure separate", () => {
    const sm = projectOwnerSheetEvidence(result, source, {
      branchId: "sm-id",
      from: "2026-10-04",
      to: "2026-10-04",
    });
    expect(sm.status).toBe("no_source");
    expect(sm.recentVisits).toBeUndefined();
    expect(sm.scopeNote).toContain("No Master Sheet source configured");
    const unavailable = projectOwnerSheetEvidence(
      { status: "unavailable", observedAt: "2026-10-05T00:00:00.000Z" },
      source,
      { branchId: "main-id", from: "2026-10-04", to: "2026-10-04" }
    );
    expect(unavailable.coverage).toBe("UNAVAILABLE");
  });
});
