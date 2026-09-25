import { describe, expect, it, vi } from "vitest";
import { google, type sheets_v4 } from "googleapis";
import { buildSheetAccountingReport } from "@/lib/integrations/google-sheets/sheet-accounting";
import { parseWeeklySheet } from "@/lib/integrations/google-sheets/sheet-parser";

vi.mock("server-only", () => ({}));

const describeLive = process.env.CRADLE_SHEET_LIVE_TEST === "1" ? describe : describe.skip;

type MergeRange = {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
};

function normalizeMerge(range: sheets_v4.Schema$GridRange): MergeRange | null {
  const startRowIndex = range.startRowIndex;
  const endRowIndex = range.endRowIndex;
  const startColumnIndex = range.startColumnIndex;
  const endColumnIndex = range.endColumnIndex;

  if (
    startRowIndex === null ||
    startRowIndex === undefined ||
    endRowIndex === null ||
    endRowIndex === undefined ||
    startColumnIndex === null ||
    startColumnIndex === undefined ||
    endColumnIndex === null ||
    endColumnIndex === undefined
  ) {
    return null;
  }

  return {
    // Convert zero-based, end-exclusive API indexes
    // into one-based, end-inclusive coordinates.
    startRow: startRowIndex + 1,
    endRow: endRowIndex,
    startColumn: startColumnIndex + 1,
    endColumn: endColumnIndex,
  };
}

function mergeContainingCell(
  merges: MergeRange[],
  sourceRow: number,
  oneBasedColumn: number
): MergeRange | undefined {
  return merges.find(
    (merge) =>
      sourceRow >= merge.startRow &&
      sourceRow <= merge.endRow &&
      oneBasedColumn >= merge.startColumn &&
      oneBasedColumn <= merge.endColumn
  );
}

function compactRanges(ranges: MergeRange[]): string[] {
  return ranges
    .slice()
    .sort((a, b) => a.startRow - b.startRow || a.startColumn - b.startColumn)
    .map(
      (range) => `R${range.startRow}:R${range.endRow} C${range.startColumn}:C${range.endColumn}`
    );
}

describeLive("CradleHub Sheet merged-cell diagnostics", () => {
  it("determines whether continuation issues are explained by actual Sheet merges", async () => {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!spreadsheetId) {
      throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is required");
    }

    const { readGoogleSheetRange } = await import("@/lib/integrations/google-sheets/sheet-reader");

    const valuesResult = await readGoogleSheetRange({
      sheetName: "SEP 18-24,2026",
      a1Range: "A1:M1010",
    });

    const parsed = parseWeeklySheet(valuesResult.values);

    const accounting = buildSheetAccountingReport(parsed);

    const reviewRows = accounting.rows.filter((row) => row.disposition === "needs_review");

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
      fields: "sheets(properties(sheetId,title,index),merges)",
    });

    const targetSheet = metadata.data.sheets?.find(
      (sheet) => sheet.properties?.title === "SEP 18-24,2026"
    );

    if (!targetSheet) {
      throw new Error("Target worksheet SEP 18-24,2026 not found");
    }

    const merges = (targetSheet.merges ?? [])
      .map(normalizeMerge)
      .filter((range): range is MergeRange => range !== null);

    const parsedBySourceRow = new Map(parsed.rows.map((row) => [row.sourceRow, row]));

    // Sheet columns:
    // B = Time      -> 2
    // C = Attendant -> 3
    // D = Client    -> 4

    const missingAttendant = reviewRows.filter((row) =>
      row.parserIssues.includes("MISSING_OR_CONTINUATION_ATTENDANT")
    );

    const missingTime = reviewRows.filter((row) =>
      row.parserIssues.includes("MISSING_OR_CONTINUATION_TIME")
    );

    const missingClient = reviewRows.filter((row) =>
      row.parserIssues.includes("MISSING_OR_CONTINUATION_CLIENT")
    );

    const attendantMerged = missingAttendant.filter(
      (row) => mergeContainingCell(merges, row.sourceRow, 3) !== undefined
    );

    const timeMerged = missingTime.filter(
      (row) => mergeContainingCell(merges, row.sourceRow, 2) !== undefined
    );

    const clientMerged = missingClient.filter(
      (row) => mergeContainingCell(merges, row.sourceRow, 4) !== undefined
    );

    const attendantNotMerged = missingAttendant.filter(
      (row) => mergeContainingCell(merges, row.sourceRow, 3) === undefined
    );

    const timeNotMerged = missingTime.filter(
      (row) => mergeContainingCell(merges, row.sourceRow, 2) === undefined
    );

    const clientNotMerged = missingClient.filter(
      (row) => mergeContainingCell(merges, row.sourceRow, 4) === undefined
    );

    function topRowsForIssue(rows: typeof reviewRows, column: number): number[] {
      return [
        ...new Set(
          rows
            .map((row) => mergeContainingCell(merges, row.sourceRow, column))
            .filter((merge): merge is MergeRange => merge !== undefined)
            .map((merge) => merge.startRow)
        ),
      ].sort((a, b) => a - b);
    }

    const attendantMergeTopRows = topRowsForIssue(attendantMerged, 3);

    const timeMergeTopRows = topRowsForIssue(timeMerged, 2);

    const clientMergeTopRows = topRowsForIssue(clientMerged, 4);

    const attendantOwnersWithValue = attendantMergeTopRows.filter((sourceRow) =>
      Boolean(parsedBySourceRow.get(sourceRow)?.attendant)
    );

    const timeOwnersWithValue = timeMergeTopRows.filter((sourceRow) =>
      Boolean(parsedBySourceRow.get(sourceRow)?.time)
    );

    const clientOwnersWithValue = clientMergeTopRows.filter((sourceRow) =>
      Boolean(parsedBySourceRow.get(sourceRow)?.client)
    );

    const relevantMerges = merges.filter(
      (merge) =>
        merge.endRow >= 26 &&
        merge.startRow <= 1010 &&
        merge.startColumn <= 4 &&
        merge.endColumn >= 2
    );

    console.log("");
    console.log("--- MERGED-CELL DIAGNOSTIC EVIDENCE ---");

    console.log({
      sheet: {
        title: targetSheet.properties?.title,
        sheetId: targetSheet.properties?.sheetId,
        index: targetSheet.properties?.index,
      },

      totalMergeRanges: merges.length,

      relevantBCDMergeRanges: relevantMerges.length,

      reviewIssues: {
        missingAttendant: missingAttendant.length,
        missingTime: missingTime.length,
        missingClient: missingClient.length,
      },

      explainedByMerge: {
        attendant: attendantMerged.length,
        time: timeMerged.length,
        client: clientMerged.length,
      },

      notExplainedByMerge: {
        attendant: attendantNotMerged.length,
        time: timeNotMerged.length,
        client: clientNotMerged.length,
      },

      unresolvedSourceRows: {
        attendant: attendantNotMerged.map((row) => row.sourceRow),
        time: timeNotMerged.map((row) => row.sourceRow),
        client: clientNotMerged.map((row) => row.sourceRow),
      },

      mergeOwners: {
        attendant: attendantMergeTopRows.length,
        attendantWithValue: attendantOwnersWithValue.length,

        time: timeMergeTopRows.length,
        timeWithValue: timeOwnersWithValue.length,

        client: clientMergeTopRows.length,
        clientWithValue: clientOwnersWithValue.length,
      },

      sampleRelevantMergeRanges: compactRanges(relevantMerges).slice(0, 40),
    });

    expect(parsed.meaningfulRowCount).toBe(701);

    expect(reviewRows.length).toBe(275);

    expect(missingAttendant.length).toBe(217);

    expect(missingTime.length).toBe(32);

    expect(missingClient.length).toBe(20);

    // Diagnostic only:
    // Do not assert how many MUST be merged.
    // That is the fact this test is measuring.
  }, 45_000);
});
