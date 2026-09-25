import { createHash } from "node:crypto";
import type { ParsedSheetRow, SheetCell } from "./sheet-parser";
import type { SheetCheck, SheetSourceIdentity } from "./sheet-ingestion-types";

export function normalizeSheetText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
export function sheetHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function buildSheetSourceIdentity(
  spreadsheetId: string,
  sheetName: string,
  row: ParsedSheetRow,
  rawValues: SheetCell[]
): SheetSourceIdentity {
  const address = [spreadsheetId, sheetName, row.sourceRow];
  // Exact identifiers are not lowercased. Only cell content is normalized.
  return {
    spreadsheetId,
    sheetName,
    sourceRow: row.sourceRow,
    businessDate: row.businessDate,
    key: sheetHash(address),
    fingerprint: sheetHash([
      address,
      row.businessDate,
      rawValues.map(normalizeSheetText),
      row.rawValues.map(normalizeSheetText),
    ]),
  };
}
export function compareSheetSourceVersions(
  previous: SheetSourceIdentity,
  next: SheetSourceIdentity
) {
  return previous.key !== next.key
    ? "different_source"
    : previous.fingerprint === next.fingerprint
      ? "unchanged"
      : "changed_source";
}

const HEADER_COLUMNS = [
  ["time"],
  ["attendant"],
  ["client"],
  ["hrs.", "hrs", "hours"],
  ["service"],
  ["per service rate"],
  ["fuel"],
  ["cash"],
  ["gcash"],
  ["bank transfer/qr", "bank transfer"],
  ["card/terminal"],
  ["commission"],
];
export function inspectSheetSchema(values: SheetCell[][]): {
  fingerprint: string;
  checks: SheetCheck[];
} {
  // Also catch malformed header candidates that the legacy TIME+SERVICE detector misses.
  const headers = values.flatMap((row, index) => {
    const cells = row
      .slice(1, 13)
      .map((cell) => normalizeSheetText(cell).replace(/\s*\/\s*/g, "/"));
    return cells[0] === "time" || (cells[1] === "attendant" && cells[2] === "client")
      ? [{ sourceRow: index + 1, cells }]
      : [];
  });
  const invalidRows = headers
    .filter(({ cells }) => HEADER_COLUMNS.some((allowed, i) => !allowed.includes(cells[i] ?? "")))
    .map((row) => row.sourceRow);
  const valid = headers.length > 0 && invalidRows.length === 0;
  return {
    fingerprint: sheetHash(headers.map((row) => row.cells)),
    checks: [
      {
        code: "UNKNOWN_SHEET_FORMAT",
        phase: "schema",
        passed: valid,
        severity: "critical",
        impact: "needs_attention",
        field: "schema",
        message: "The operational column layout must match the approved format.",
        requiredAction:
          "Confirm the worksheet layout and approve its column mapping before revalidation.",
        evidence: { headerCount: headers.length, invalidHeaderRows: invalidRows },
      },
    ],
  };
}
