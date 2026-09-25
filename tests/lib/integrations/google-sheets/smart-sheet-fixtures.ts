import { parseWeeklySheet } from "@/lib/integrations/google-sheets/sheet-parser";
import type { GoogleSheetCell as SheetCell } from "@/lib/integrations/google-sheets/sheet-reader";
import { buildSheetSourceIdentity } from "@/lib/integrations/google-sheets/sheet-source-identity";
import type { SheetCapturedRow } from "@/lib/integrations/google-sheets/sheet-ingestion-types";

export const header: SheetCell[] = [
  "",
  "TIME",
  "ATTENDANT",
  "CLIENT",
  "HRS.",
  "SERVICE",
  "PER SERVICE RATE",
  "FUEL",
  "CASH",
  "GCASH",
  "BANK TRANSFER/QR",
  "CARD/ TERMINAL",
  "COMMISSION",
];
export function serviceRow(overrides: Partial<Record<number, SheetCell>> = {}): SheetCell[] {
  const row: SheetCell[] = [
    "",
    "10:00 AM",
    "Nikki",
    "Test Customer",
    "1",
    "Swedish Massage",
    500,
    "",
    500,
    "",
    "",
    "",
    100,
  ];
  for (const [index, value] of Object.entries(overrides)) row[Number(index)] = value ?? null;
  return row;
}
export function capture(values: SheetCell[][]): SheetCapturedRow[] {
  return parseWeeklySheet([header, ["September 18, 2026"], ...values])
    .rows.slice(2)
    .map((parsed) => ({
      parsed,
      rawValues: [...parsed.rawValues],
      restorations: [],
      source: buildSheetSourceIdentity("test-sheet", "test-week", parsed, parsed.rawValues),
    }));
}
