import { describe, expect, it, vi } from "vitest";
import { buildSheetAccountingReport } from "@/lib/integrations/google-sheets/sheet-accounting";
import { parseWeeklySheet } from "@/lib/integrations/google-sheets/sheet-parser";

vi.mock("server-only", () => ({}));

const describeLive = process.env.CRADLE_SHEET_LIVE_TEST === "1" ? describe : describe.skip;

describeLive("CradleHub live Sheet zero-silent-drop accounting", () => {
  it("accounts for every meaningful current-week row exactly once", async () => {
    const { readGoogleSheetRange } = await import("@/lib/integrations/google-sheets/sheet-reader");

    const result = await readGoogleSheetRange({
      sheetName: "SEP 18-24,2026",
      a1Range: "A1:M1010",
    });

    const parsed = parseWeeklySheet(result.values);

    const report = buildSheetAccountingReport(parsed);

    const total =
      report.countsByDisposition.match_candidate +
      report.countsByDisposition.needs_review +
      report.countsByDisposition.derived_informational;

    const reviewRows = report.rows.filter((row) => row.disposition === "needs_review");

    const reviewReasonCounts = reviewRows
      .flatMap((row) => row.parserIssues)
      .reduce<Record<string, number>>((counts, reason) => {
        counts[reason] = (counts[reason] ?? 0) + 1;

        return counts;
      }, {});

    console.log("");
    console.log("--- ZERO-SILENT-DROP LIVE EVIDENCE ---");

    console.log({
      rowsRead: result.values.length,

      totalMeaningfulRows: report.totalMeaningfulRows,

      countsByDisposition: report.countsByDisposition,

      countsByRowType: report.countsByRowType,

      countsByReason: report.countsByReason,

      reviewRowCount: reviewRows.length,

      reviewReasonCounts,

      reviewSourceRows: reviewRows.map((row) => row.sourceRow),
    });

    expect(report.totalMeaningfulRows).toBe(701);

    expect(total).toBe(701);

    expect(report.rows).toHaveLength(701);

    expect(report.countsByRowType).toEqual({
      header: 7,
      aggregate_summary: 14,
      staff_duty: 38,
      service_candidate: 414,
      financial_or_note: 137,
      informational: 91,
      unknown: 0,
    });

    expect(
      report.countsByDisposition.match_candidate +
        report.countsByDisposition.needs_review +
        report.countsByDisposition.derived_informational
    ).toBe(701);
  }, 45_000);
});
