import { describe, expect, it, vi } from "vitest";
import { buildSheetAccountingReport } from "@/lib/integrations/google-sheets/sheet-accounting";
import { parseWeeklySheet } from "@/lib/integrations/google-sheets/sheet-parser";

vi.mock("server-only", () => ({}));

const describeLive = process.env.CRADLE_SHEET_LIVE_TEST === "1" ? describe : describe.skip;

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

describeLive("CradleHub Sheet review diagnostics", () => {
  it("describes review structure without changing classification", async () => {
    const { readGoogleSheetRange } = await import("@/lib/integrations/google-sheets/sheet-reader");

    const result = await readGoogleSheetRange({
      sheetName: "SEP 18-24,2026",
      a1Range: "A1:M1010",
    });

    const parsed = parseWeeklySheet(result.values);

    const report = buildSheetAccountingReport(parsed);

    const reviewRows = report.rows.filter((row) => row.disposition === "needs_review");

    const parsedBySourceRow = new Map(parsed.rows.map((row) => [row.sourceRow, row]));

    const reasonCombinations: Record<string, number> = {};

    const rowTypeReviewCounts: Record<string, number> = {};

    const issueByRowType: Record<string, number> = {};

    const datePresence = {
      dated: 0,
      undated: 0,
    };

    const adjacency = {
      previous_row_is_service: 0,
      previous_row_same_date_service: 0,
      previous_row_has_time: 0,
      previous_row_has_attendant: 0,
      previous_row_has_client: 0,
    };

    const serviceReviewShapes: Record<string, number> = {};

    const sampleByCombination = new Map<string, number[]>();

    for (const accountingRow of reviewRows) {
      const parsedRow = parsedBySourceRow.get(accountingRow.sourceRow);

      if (!parsedRow) {
        throw new Error(`Missing parsed row for source row ${accountingRow.sourceRow}`);
      }

      increment(rowTypeReviewCounts, parsedRow.rowType);

      if (parsedRow.businessDate) {
        datePresence.dated += 1;
      } else {
        datePresence.undated += 1;
      }

      const issues = [...parsedRow.issues].sort();

      const combination = issues.length > 0 ? issues.join(" + ") : "NO_ISSUE";

      increment(reasonCombinations, combination);

      const samples = sampleByCombination.get(combination) ?? [];

      if (samples.length < 12) {
        samples.push(parsedRow.sourceRow);

        sampleByCombination.set(combination, samples);
      }

      for (const issue of issues) {
        increment(issueByRowType, `${parsedRow.rowType} :: ${issue}`);
      }

      const previous = parsedBySourceRow.get(parsedRow.sourceRow - 1);

      if (previous?.rowType === "service_candidate") {
        adjacency.previous_row_is_service += 1;

        if (previous.businessDate === parsedRow.businessDate) {
          adjacency.previous_row_same_date_service += 1;
        }

        if (previous.time) {
          adjacency.previous_row_has_time += 1;
        }

        if (previous.attendant) {
          adjacency.previous_row_has_attendant += 1;
        }

        if (previous.client) {
          adjacency.previous_row_has_client += 1;
        }
      }

      if (parsedRow.rowType === "service_candidate") {
        const shape = [
          parsedRow.time ? "TIME" : "NO_TIME",

          parsedRow.attendant ? "ATTENDANT" : "NO_ATTENDANT",

          parsedRow.client ? "CLIENT" : "NO_CLIENT",

          parsedRow.service ? "SERVICE" : "NO_SERVICE",

          parsedRow.hasSplitPayment ? "SPLIT_PAYMENT" : "NO_SPLIT_PAYMENT",
        ].join(" | ");

        increment(serviceReviewShapes, shape);
      }
    }

    const sortedReasonCombinations = Object.entries(reasonCombinations).sort((a, b) => b[1] - a[1]);

    const sortedServiceShapes = Object.entries(serviceReviewShapes).sort((a, b) => b[1] - a[1]);

    const combinationSamples = Object.fromEntries(
      [...sampleByCombination.entries()].sort(
        (a, b) => (reasonCombinations[b[0]] ?? 0) - (reasonCombinations[a[0]] ?? 0)
      )
    );

    console.log("");
    console.log("--- REVIEW DIAGNOSTIC EVIDENCE ---");

    console.log({
      rowsRead: result.values.length,

      meaningfulRows: parsed.meaningfulRowCount,

      reviewRows: reviewRows.length,

      rowTypeReviewCounts,

      datePresence,

      reasonCombinations: Object.fromEntries(sortedReasonCombinations),

      issueByRowType,

      serviceReviewShapes: Object.fromEntries(sortedServiceShapes),

      adjacency,

      combinationSamples,
    });

    expect(parsed.meaningfulRowCount).toBe(701);

    expect(reviewRows.length).toBe(275);

    expect(reviewRows.every((row) => row.disposition === "needs_review")).toBe(true);
  }, 45_000);
});
