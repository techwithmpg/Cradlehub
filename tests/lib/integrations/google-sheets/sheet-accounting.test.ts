import { describe, expect, it } from "vitest";
import { buildSheetAccountingReport } from "@/lib/integrations/google-sheets/sheet-accounting";
import { parseWeeklySheet, type SheetCell } from "@/lib/integrations/google-sheets/sheet-parser";

function row(values: Partial<Record<number, SheetCell>>): SheetCell[] {
  const result: SheetCell[] = Array.from({ length: 13 }, () => "");

  for (const [column, value] of Object.entries(values)) {
    result[Number(column)] = value;
  }

  return result;
}

describe("Google Sheets zero-silent-drop accounting", () => {
  it("accounts for every meaningful row exactly once", () => {
    const parsed = parseWeeklySheet([
      row({
        1: "TIME",
        2: "ATTENDANT",
        5: "SERVICE",
      }),

      row({
        0: "September 18, 2026",
      }),

      row({
        1: "9:00 AM",
        2: "ROSE",
        3: "CLIENT",
        5: "SWEDISH",
        6: "₱500.00",
        8: "₱500.00",
      }),

      row({
        2: "ROSE",
        5: "OPENING CSR",
      }),

      row({
        0: "TOTAL NO.OF HOURS",
        8: "₱5,000.00",
        9: "₱1,000.00",
      }),
    ]);

    const report = buildSheetAccountingReport(parsed);

    const total =
      report.countsByDisposition.match_candidate +
      report.countsByDisposition.needs_review +
      report.countsByDisposition.derived_informational;

    expect(total).toBe(report.totalMeaningfulRows);

    expect(report.rows).toHaveLength(report.totalMeaningfulRows);

    expect(
      report.rows.filter((entry) => entry.disposition === "derived_informational").length
    ).toBeGreaterThan(0);
  });

  it("routes parser issues to review rather than silently accepting them", () => {
    const parsed = parseWeeklySheet([
      row({
        1: "TIME",
        5: "SERVICE",
      }),

      row({
        0: "September 18, 2026",
      }),

      row({
        5: "SWEDISH",
        8: "GCASH",
      }),
    ]);

    const report = buildSheetAccountingReport(parsed);

    const reviewed = report.rows.find((entry) => entry.disposition === "needs_review");

    expect(reviewed).toBeDefined();

    expect(reviewed?.parserIssues.length).toBeGreaterThan(0);
  });
});
