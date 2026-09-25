import type { ParsedSheetRow, ParsedWeeklySheet, SheetRowType } from "./sheet-parser";

export type SheetAccountingDisposition =
  | "match_candidate"
  | "needs_review"
  | "derived_informational";

export type SheetAccountingReason =
  | "HEADER"
  | "AGGREGATE_SUMMARY"
  | "INFORMATIONAL_ROW"
  | "PARSER_ISSUE"
  | "STAFF_DUTY_CANDIDATE"
  | "SERVICE_CANDIDATE"
  | "FINANCIAL_CANDIDATE";

export type SheetAccountingRow = {
  sourceRow: number;
  businessDate: string | null;
  rowType: SheetRowType;
  disposition: SheetAccountingDisposition;
  reasons: SheetAccountingReason[];
  parserIssues: string[];
};

export type SheetAccountingReport = {
  totalMeaningfulRows: number;

  countsByDisposition: Record<SheetAccountingDisposition, number>;

  countsByRowType: Record<SheetRowType, number>;

  countsByReason: Partial<Record<SheetAccountingReason, number>>;

  rows: SheetAccountingRow[];
};

function classifyAccountingRow(row: ParsedSheetRow): SheetAccountingRow {
  if (row.rowType === "header") {
    return {
      sourceRow: row.sourceRow,
      businessDate: row.businessDate,
      rowType: row.rowType,
      disposition: "derived_informational",
      reasons: ["HEADER"],
      parserIssues: [...row.issues],
    };
  }

  if (row.rowType === "aggregate_summary") {
    return {
      sourceRow: row.sourceRow,
      businessDate: row.businessDate,
      rowType: row.rowType,
      disposition: "derived_informational",
      reasons: ["AGGREGATE_SUMMARY"],
      parserIssues: [...row.issues],
    };
  }

  if (row.rowType === "informational") {
    return {
      sourceRow: row.sourceRow,
      businessDate: row.businessDate,
      rowType: row.rowType,
      disposition: "derived_informational",
      reasons: ["INFORMATIONAL_ROW"],
      parserIssues: [...row.issues],
    };
  }

  if (row.rowType === "unknown" || row.issues.length > 0) {
    return {
      sourceRow: row.sourceRow,
      businessDate: row.businessDate,
      rowType: row.rowType,
      disposition: "needs_review",
      reasons: ["PARSER_ISSUE"],
      parserIssues: [...row.issues],
    };
  }

  if (row.rowType === "staff_duty") {
    return {
      sourceRow: row.sourceRow,
      businessDate: row.businessDate,
      rowType: row.rowType,
      disposition: "match_candidate",
      reasons: ["STAFF_DUTY_CANDIDATE"],
      parserIssues: [],
    };
  }

  if (row.rowType === "service_candidate") {
    return {
      sourceRow: row.sourceRow,
      businessDate: row.businessDate,
      rowType: row.rowType,
      disposition: "match_candidate",
      reasons: ["SERVICE_CANDIDATE"],
      parserIssues: [],
    };
  }

  if (row.rowType === "financial_or_note") {
    return {
      sourceRow: row.sourceRow,
      businessDate: row.businessDate,
      rowType: row.rowType,
      disposition: "match_candidate",
      reasons: ["FINANCIAL_CANDIDATE"],
      parserIssues: [],
    };
  }

  return {
    sourceRow: row.sourceRow,
    businessDate: row.businessDate,
    rowType: row.rowType,
    disposition: "needs_review",
    reasons: ["PARSER_ISSUE"],
    parserIssues: [...row.issues, "UNACCOUNTED_ROW_TYPE"],
  };
}

export function buildSheetAccountingReport(parsed: ParsedWeeklySheet): SheetAccountingReport {
  const rows = parsed.rows.map(classifyAccountingRow);

  const countsByDisposition: SheetAccountingReport["countsByDisposition"] = {
    match_candidate: 0,
    needs_review: 0,
    derived_informational: 0,
  };

  const countsByReason: SheetAccountingReport["countsByReason"] = {};

  for (const row of rows) {
    countsByDisposition[row.disposition] += 1;

    for (const reason of row.reasons) {
      countsByReason[reason] = (countsByReason[reason] ?? 0) + 1;
    }
  }

  const accountedTotal =
    countsByDisposition.match_candidate +
    countsByDisposition.needs_review +
    countsByDisposition.derived_informational;

  if (accountedTotal !== parsed.meaningfulRowCount) {
    throw new Error(
      `Zero-silent-drop invariant failed: ${accountedTotal} accounted rows != ${parsed.meaningfulRowCount} meaningful rows`
    );
  }

  if (rows.length !== parsed.meaningfulRowCount) {
    throw new Error(
      `Accounting row count mismatch: ${rows.length} != ${parsed.meaningfulRowCount}`
    );
  }

  return {
    totalMeaningfulRows: parsed.meaningfulRowCount,
    countsByDisposition,
    countsByRowType: {
      ...parsed.countsByType,
    },
    countsByReason,
    rows,
  };
}
