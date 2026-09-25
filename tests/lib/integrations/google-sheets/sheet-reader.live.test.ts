import { describe, expect, it, vi } from "vitest";
import { parseWeeklySheet } from "@/lib/integrations/google-sheets/sheet-parser";

vi.mock("server-only", () => ({}));

const describeLive = process.env.CRADLE_SHEET_LIVE_TEST === "1" ? describe : describe.skip;

async function withTimeout<T>(
  label: string,
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const startedAt = Date.now();

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation().then((result) => {
        console.log(`${label}: PASS (${Date.now() - startedAt}ms)`);

        return result;
      }),

      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label}: TIMEOUT after ${Date.now() - startedAt}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

describeLive("CradleHub live Google Sheet bridge", () => {
  it("separates aggregate payment totals from operational transactions", async () => {
    const readerModule = await withTimeout(
      "dynamic import sheet-reader",
      () => import("@/lib/integrations/google-sheets/sheet-reader"),
      15_000
    );

    const result = await withTimeout(
      "readGoogleSheetRange",
      () =>
        readerModule.readGoogleSheetRange({
          sheetName: "SEP 18-24,2026",
          a1Range: "A1:M1010",
        }),
      20_000
    );

    expect(result.values).toHaveLength(1010);

    const startedAt = Date.now();
    const parsed = parseWeeklySheet(result.values);

    console.log(`parseWeeklySheet: PASS (${Date.now() - startedAt}ms)`);

    expect(parsed.headerRows).toEqual([26, 153, 337, 520, 625, 742, 875]);

    expect(parsed.blocks.map((block) => block.businessDate)).toEqual([
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
    ]);

    const datedRows = parsed.rows.filter((row) => row.businessDate !== null);

    const dutyRows = datedRows.filter((row) => row.rowType === "staff_duty");

    const allDatedSplitRows = datedRows.filter((row) => row.hasSplitPayment);

    const aggregateRows = datedRows.filter((row) => row.rowType === "aggregate_summary");

    const aggregateSplitRows = aggregateRows.filter((row) => row.hasSplitPayment);

    const nonAggregateSplitRows = datedRows.filter(
      (row) => row.rowType !== "aggregate_summary" && row.hasSplitPayment
    );

    const serviceSplitRows = nonAggregateSplitRows.filter(
      (row) => row.rowType === "service_candidate"
    );

    const financialSplitRows = nonAggregateSplitRows.filter(
      (row) => row.rowType === "financial_or_note"
    );

    console.log("");
    console.log("--- LIVE APPLICATION PARSER EVIDENCE ---");

    console.log({
      rowsRead: result.values.length,
      meaningfulRows: parsed.meaningfulRowCount,

      headerRows: parsed.headerRows,

      blockDates: parsed.blocks.map((block) => block.businessDate),

      dutyRows: dutyRows.length,

      allDatedSplitRows: allDatedSplitRows.length,

      aggregateRows: aggregateRows.length,

      aggregateSplitRows: aggregateSplitRows.length,

      aggregateSourceRows: aggregateRows.map((row) => row.sourceRow),

      nonAggregateSplitRows: nonAggregateSplitRows.length,

      nonAggregateSplitSourceRows: nonAggregateSplitRows.map((row) => row.sourceRow),

      serviceSplitRows: serviceSplitRows.length,

      financialSplitRows: financialSplitRows.length,

      countsByType: parsed.countsByType,
    });

    expect(dutyRows).toHaveLength(38);

    // 18 dated rows currently contain >1 numeric
    // tender component.
    expect(allDatedSplitRows).toHaveLength(18);

    // 14 are daily TOTAL / NET PROFIT summaries.
    expect(aggregateRows.map((row) => row.sourceRow)).toEqual([
      131, 147, 308, 332, 488, 514, 600, 619, 716, 736, 850, 869, 989, 1008,
    ]);

    expect(aggregateSplitRows).toHaveLength(14);

    // Only these four dated rows are
    // non-summary multi-tender records.
    expect(nonAggregateSplitRows.map((row) => row.sourceRow)).toEqual([89, 183, 269, 597]);

    expect(serviceSplitRows.map((row) => row.sourceRow)).toEqual([89, 183, 269]);

    expect(financialSplitRows.map((row) => row.sourceRow)).toEqual([597]);

    // Reclassification must not change the total
    // number of meaningful rows.
    expect(parsed.meaningfulRowCount).toBe(701);

    expect(parsed.countsByType).toEqual({
      header: 7,
      aggregate_summary: 14,
      staff_duty: 38,
      service_candidate: 414,
      financial_or_note: 137,
      informational: 91,
      unknown: 0,
    });
  }, 45_000);
});
