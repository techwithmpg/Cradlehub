import "server-only";

import {
  buildSheetAccountingReport,
  type SheetAccountingDisposition,
  type SheetAccountingReason,
} from "./sheet-accounting";
import { restoreMergedIdentityCells, type MergeRestorationTarget } from "./sheet-merge-normalizer";
import {
  parseWeeklySheet,
  type ParsedPaymentComponent,
  type ParsedSheetRow,
  type ParsedWeeklySheet,
  type SheetRowType,
} from "./sheet-parser";
import {
  readGoogleSheetMergeRanges,
  readGoogleSheetRange,
  type GoogleSheetCell,
  type GoogleSheetMergeRange,
} from "./sheet-reader";

export type LiveSheetProjectionRow = {
  sourceRow: number;
  businessDate: string | null;
  rowType: SheetRowType;

  disposition: SheetAccountingDisposition;
  reasons: SheetAccountingReason[];
  parserIssues: string[];

  location: string | null;
  time: string | null;
  attendant: string | null;
  client: string | null;
  hours: string | null;
  service: string | null;

  rate: number | null;
  fuelOrTravel: number | null;
  payments: ParsedPaymentComponent[];
  commission: number | null;

  /**
   * Original Google values before merge restoration.
   * These remain the raw evidence.
   */
  rawValues: ParsedSheetRow["rawValues"];

  /**
   * One-based columns restored only where:
   * 1. the raw parser requested restoration, and
   * 2. Google merge metadata proved ownership.
   */
  restoredColumns: number[];
};

export type LiveSheetProjectionSnapshot = {
  sheetName: string;
  sheetId: number | null;
  sheetIndex: number | null;
  resolvedRange: string | null;

  readAt: string;

  rawMeaningfulRowCount: number;
  normalizedMeaningfulRowCount: number;
  restorationCount: number;

  countsByDisposition: Record<SheetAccountingDisposition, number>;

  countsByRowType: Record<SheetRowType, number>;

  businessDates: string[];

  rows: LiveSheetProjectionRow[];
};

function restorationTargetsFromRawParse(parsed: ParsedWeeklySheet): MergeRestorationTarget[] {
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

export function buildSheetProjectionSnapshot(input: {
  sheetName: string;
  rawValues: GoogleSheetCell[][];
  merges: GoogleSheetMergeRange[];
  sheetId?: number | null;
  sheetIndex?: number | null;
  resolvedRange?: string | null;
}): LiveSheetProjectionSnapshot {
  const rawParsed = parseWeeklySheet(input.rawValues);

  const targets = restorationTargetsFromRawParse(rawParsed);

  const normalized = restoreMergedIdentityCells({
    values: input.rawValues,
    merges: input.merges,
    targets,
    startRow: 1,
    startColumn: 1,
  });

  const normalizedParsed = parseWeeklySheet(normalized.values);

  if (normalizedParsed.meaningfulRowCount !== rawParsed.meaningfulRowCount) {
    throw new Error(
      `Sheet projection invariant failed: raw=${rawParsed.meaningfulRowCount}, normalized=${normalizedParsed.meaningfulRowCount}`
    );
  }

  const accounting = buildSheetAccountingReport(normalizedParsed);

  if (accounting.totalMeaningfulRows !== normalizedParsed.meaningfulRowCount) {
    throw new Error("Sheet projection accounting invariant failed.");
  }

  const rawRows = new Map(rawParsed.rows.map((row) => [row.sourceRow, row] as const));

  const accountingRows = new Map(accounting.rows.map((row) => [row.sourceRow, row] as const));

  const restoredColumnsByRow = new Map<number, Set<number>>();

  for (const restoration of normalized.restorations) {
    const columns = restoredColumnsByRow.get(restoration.sourceRow) ?? new Set<number>();

    columns.add(restoration.sourceColumn);

    restoredColumnsByRow.set(restoration.sourceRow, columns);
  }

  const rows: LiveSheetProjectionRow[] = normalizedParsed.rows.map((row) => {
    const rawRow = rawRows.get(row.sourceRow);

    const accountingRow = accountingRows.get(row.sourceRow);

    if (!rawRow || !accountingRow) {
      throw new Error(`Sheet projection row invariant failed at source row ${row.sourceRow}.`);
    }

    return {
      sourceRow: row.sourceRow,

      businessDate: row.businessDate,

      rowType: row.rowType,

      disposition: accountingRow.disposition,

      reasons: [...accountingRow.reasons],

      parserIssues: [...accountingRow.parserIssues],

      location: row.location,

      time: row.time,

      attendant: row.attendant,

      client: row.client,

      hours: row.hours,

      service: row.service,

      rate: row.rate,

      fuelOrTravel: row.fuelOrTravel,

      payments: row.payments.map((payment) => ({
        ...payment,
      })),

      commission: row.commission,

      rawValues: [...rawRow.rawValues],

      restoredColumns: Array.from(restoredColumnsByRow.get(row.sourceRow) ?? []).sort(
        (a, b) => a - b
      ),
    };
  });

  if (rows.length !== accounting.totalMeaningfulRows) {
    throw new Error(
      `Sheet projection zero-silent-drop failed: rows=${rows.length}, accounted=${accounting.totalMeaningfulRows}`
    );
  }

  const businessDates = Array.from(
    new Set(rows.map((row) => row.businessDate).filter((date): date is string => Boolean(date)))
  ).sort();

  return {
    sheetName: input.sheetName,

    sheetId: input.sheetId ?? null,

    sheetIndex: input.sheetIndex ?? null,

    resolvedRange: input.resolvedRange ?? null,

    readAt: new Date().toISOString(),

    rawMeaningfulRowCount: rawParsed.meaningfulRowCount,

    normalizedMeaningfulRowCount: normalizedParsed.meaningfulRowCount,

    restorationCount: normalized.restorations.length,

    countsByDisposition: {
      ...accounting.countsByDisposition,
    },

    countsByRowType: {
      ...accounting.countsByRowType,
    },

    businessDates,

    rows,
  };
}

function requireActiveSheetName(): string {
  const value = process.env.GOOGLE_SHEETS_ACTIVE_SHEET_NAME?.trim();

  if (!value) {
    throw new Error(
      "Missing required server environment variable: GOOGLE_SHEETS_ACTIVE_SHEET_NAME"
    );
  }

  return value;
}

export async function readActiveSheetProjection(): Promise<LiveSheetProjectionSnapshot> {
  const sheetName = requireActiveSheetName();

  const [valuesResult, mergeResult] = await Promise.all([
    readGoogleSheetRange({
      sheetName,
      a1Range: "A1:M1200",
    }),

    readGoogleSheetMergeRanges({
      sheetName,
    }),
  ]);

  if (valuesResult.sheetName !== mergeResult.sheetName) {
    throw new Error("Google Sheet projection source mismatch.");
  }

  return buildSheetProjectionSnapshot({
    sheetName,
    rawValues: valuesResult.values,

    merges: mergeResult.merges,

    sheetId: mergeResult.sheetId,

    sheetIndex: mergeResult.sheetIndex,

    resolvedRange: valuesResult.resolvedRange,
  });
}
