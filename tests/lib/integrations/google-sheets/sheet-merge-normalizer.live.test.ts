import { describe, expect, it, vi } from "vitest";

import { buildSheetAccountingReport } from "@/lib/integrations/google-sheets/sheet-accounting";

import {
  restoreMergedIdentityCells,
  type MergeRestorationTarget,
} from "@/lib/integrations/google-sheets/sheet-merge-normalizer";

import { parseWeeklySheet } from "@/lib/integrations/google-sheets/sheet-parser";

vi.mock("server-only", () => ({}));

const describeLive = process.env.CRADLE_SHEET_LIVE_TEST === "1" ? describe : describe.skip;

function issueRows(parsed: ReturnType<typeof parseWeeklySheet>, issue: string): number[] {
  return parsed.rows.filter((row) => row.issues.includes(issue)).map((row) => row.sourceRow);
}

function targetsFromRawParser(
  parsed: ReturnType<typeof parseWeeklySheet>
): MergeRestorationTarget[] {
  const targets: MergeRestorationTarget[] = [];

  for (const row of parsed.rows) {
    if (row.issues.includes("MISSING_OR_CONTINUATION_TIME")) {
      targets.push({
        sourceRow: row.sourceRow,
        sourceColumn: 2,
      });
    }

    if (row.issues.includes("MISSING_OR_CONTINUATION_ATTENDANT")) {
      targets.push({
        sourceRow: row.sourceRow,
        sourceColumn: 3,
      });
    }

    if (row.issues.includes("MISSING_OR_CONTINUATION_CLIENT")) {
      targets.push({
        sourceRow: row.sourceRow,
        sourceColumn: 4,
      });
    }
  }

  return targets;
}

describeLive("CradleHub live narrow merge normalization", () => {
  it("restores only parser-identified merge-backed cells", async () => {
    const { readGoogleSheetRange, readGoogleSheetMergeRanges } =
      await import("@/lib/integrations/google-sheets/sheet-reader");

    const rawResult = await readGoogleSheetRange({
      sheetName: "SEP 18-24,2026",
      a1Range: "A1:M1010",
    });

    const mergeResult = await readGoogleSheetMergeRanges({
      sheetName: "SEP 18-24,2026",
    });

    const rawSnapshot = structuredClone(rawResult.values);

    const rawParsed = parseWeeklySheet(rawResult.values);

    const rawAccounting = buildSheetAccountingReport(rawParsed);

    const targets = targetsFromRawParser(rawParsed);

    const normalized = restoreMergedIdentityCells({
      values: rawResult.values,
      merges: mergeResult.merges,
      targets,
      startRow: 1,
      startColumn: 1,
    });

    expect(rawResult.values).toEqual(rawSnapshot);

    const normalizedParsed = parseWeeklySheet(normalized.values);

    const normalizedAccounting = buildSheetAccountingReport(normalizedParsed);

    const before = {
      attendant: issueRows(rawParsed, "MISSING_OR_CONTINUATION_ATTENDANT"),

      client: issueRows(rawParsed, "MISSING_OR_CONTINUATION_CLIENT"),

      time: issueRows(rawParsed, "MISSING_OR_CONTINUATION_TIME"),

      paymentMarker: issueRows(rawParsed, "PAYMENT_MARKER_REQUIRES_REVIEW"),

      fuelTravel: issueRows(rawParsed, "NON_NUMERIC_FUEL_OR_TRAVEL_NOTE"),

      missingBlockDate: issueRows(rawParsed, "MISSING_BLOCK_DATE"),
    };

    const after = {
      attendant: issueRows(normalizedParsed, "MISSING_OR_CONTINUATION_ATTENDANT"),

      client: issueRows(normalizedParsed, "MISSING_OR_CONTINUATION_CLIENT"),

      time: issueRows(normalizedParsed, "MISSING_OR_CONTINUATION_TIME"),

      paymentMarker: issueRows(normalizedParsed, "PAYMENT_MARKER_REQUIRES_REVIEW"),

      fuelTravel: issueRows(normalizedParsed, "NON_NUMERIC_FUEL_OR_TRAVEL_NOTE"),

      missingBlockDate: issueRows(normalizedParsed, "MISSING_BLOCK_DATE"),
    };

    const restorationCounts = {
      time: normalized.restorations.filter((entry) => entry.sourceColumn === 2).length,

      attendant: normalized.restorations.filter((entry) => entry.sourceColumn === 3).length,

      client: normalized.restorations.filter((entry) => entry.sourceColumn === 4).length,
    };

    console.log("");
    console.log("--- NARROW MERGE NORMALIZATION LIVE EVIDENCE ---");

    console.log({
      rawMeaningfulRows: rawParsed.meaningfulRowCount,

      normalizedMeaningfulRows: normalizedParsed.meaningfulRowCount,

      requestedTargets: targets.length,

      totalRestorations: normalized.restorations.length,

      restorationCounts,

      issueCountsBefore: {
        attendant: before.attendant.length,
        client: before.client.length,
        time: before.time.length,
        paymentMarker: before.paymentMarker.length,
        fuelTravel: before.fuelTravel.length,
        missingBlockDate: before.missingBlockDate.length,
      },

      issueCountsAfter: {
        attendant: after.attendant.length,
        client: after.client.length,
        time: after.time.length,
        paymentMarker: after.paymentMarker.length,
        fuelTravel: after.fuelTravel.length,
        missingBlockDate: after.missingBlockDate.length,
      },

      unresolvedTimeRows: after.time,

      countsByTypeBefore: rawParsed.countsByType,

      countsByTypeAfter: normalizedParsed.countsByType,

      accountingBefore: rawAccounting.countsByDisposition,

      accountingAfter: normalizedAccounting.countsByDisposition,
    });

    expect(rawParsed.meaningfulRowCount).toBe(701);

    expect(normalizedParsed.meaningfulRowCount).toBe(701);

    expect(restorationCounts.attendant).toBe(217);

    expect(restorationCounts.client).toBe(20);

    expect(restorationCounts.time).toBe(2);

    expect(normalized.restorations).toHaveLength(239);

    expect(normalizedParsed.countsByType).toEqual(rawParsed.countsByType);

    expect(after.attendant).toHaveLength(0);

    expect(after.client).toHaveLength(0);

    expect(after.time).toHaveLength(30);

    expect(after.paymentMarker).toEqual(before.paymentMarker);

    expect(after.fuelTravel).toEqual(before.fuelTravel);

    expect(after.missingBlockDate).toEqual(before.missingBlockDate);

    expect(normalizedAccounting.totalMeaningfulRows).toBe(701);

    expect(
      normalizedAccounting.countsByDisposition.match_candidate +
        normalizedAccounting.countsByDisposition.needs_review +
        normalizedAccounting.countsByDisposition.derived_informational
    ).toBe(701);

    expect(normalizedAccounting.countsByDisposition.needs_review).toBeLessThan(
      rawAccounting.countsByDisposition.needs_review
    );
  }, 45_000);
});
