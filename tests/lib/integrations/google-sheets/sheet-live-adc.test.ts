import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createLocalAdcSheetTokenProvider } from "@/lib/integrations/google-sheets/sheet-adc-token-provider";
import { readCradleMasterSheetDiagnostics } from "@/lib/integrations/google-sheets/sheet-diagnostics";
import type { SheetTabDiagnostics } from "@/lib/integrations/google-sheets/sheet-diagnostics";

const live = process.env.CRADLE_SHEET_LIVE_DIAGNOSTIC === "1" ? it : it.skip;

function aggregate(tab: SheetTabDiagnostics) {
  return {
    sheetName: tab.sheetName,
    sourceRowCount: tab.sourceRowCount,
    classificationCounts: tab.classificationCounts,
    visitCount: tab.visitCount,
    dutyCount: tab.dutyCount,
    continuationCount: tab.serviceLineCount - tab.visitCount,
    multiServiceVisits: tab.multiServiceVisits,
    needsReviewCount: tab.needsReviewCount,
    reviewReasonCounts: tab.reviewReasonCounts,
    visitsMissingBusinessDate: tab.visitsMissingBusinessDate,
    visitsWithBusinessDate: tab.visitsWithBusinessDate,
    visitsCrossingDayBoundary: tab.visitsCrossingDayBoundary,
    outOfWeekDateCount: tab.outOfWeekDateCount,
    staleSummaryDateRejectedCount: tab.staleSummaryDateRejectedCount,
    dateBoundaryAmbiguousCount: tab.dateBoundaryAmbiguousCount,
  };
}

describe("opt-in local ADC workbook diagnostic", () => {
  live(
    "reads both authorized weekly tabs and reports aggregates only",
    async () => {
      const result = await readCradleMasterSheetDiagnostics(
        createLocalAdcSheetTokenProvider(),
        "2026-10-04"
      );
      if (result.status !== "available") {
        throw new Error(`LIVE_READ_${result.reason}`);
      }
      expect(result.current.sheetName).toBe("OCT.2-8, 2026");
      expect(result.previous.sheetName).toBe("SEPT 25-OCT 1, 2026");
      // Each available projection passed the reader's required header check.
      expect(result.current.classificationCounts.HEADER).toBeGreaterThan(0);
      expect(result.previous.classificationCounts.HEADER).toBeGreaterThan(0);
      console.log(
        "LIVE_SHEET_AGGREGATES",
        JSON.stringify({
          current: aggregate(result.current),
          previous: aggregate(result.previous),
        })
      );
      expect(result.current.visitsMissingBusinessDate).toBe(0);
      expect(result.previous.visitsMissingBusinessDate).toBe(0);
      expect(result.current.visitsCrossingDayBoundary).toBe(0);
      expect(result.previous.visitsCrossingDayBoundary).toBe(0);
    },
    60_000
  );
});
