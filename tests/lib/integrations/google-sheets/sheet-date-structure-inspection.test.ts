import { describe, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createLocalAdcSheetTokenProvider } from "@/lib/integrations/google-sheets/sheet-adc-token-provider";
import { parseSheetRows } from "@/lib/integrations/google-sheets/sheet-parser";
import { CRADLE_MAINSHEETS_SPREADSHEET_ID } from "@/lib/integrations/google-sheets/sheet-reader";

const inspect = process.env.CRADLE_SHEET_DATE_INSPECTION === "1" ? it : it.skip;
const TABS = ["OCT.2-8, 2026", "SEPT 25-OCT 1, 2026"];
const DAY = /^(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)(?:\s|$|[,/:.-])/i;
const DATE =
  /^(?:(?:MON|TUE|WED|THU|FRI|SAT|SUN)[A-Z]*[,\s]+)?(?:JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\.?\s+\d{1,2}(?:[,/\s-]+\d{2,4})?$/i;
const NUMERIC_DATE = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;

type GridRange = {
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
};
type SheetMetadata = { properties?: { title?: string }; merges?: GridRange[] };
type Values = { values?: (string | number | boolean)[][] };

function column(index: number): string {
  let value = index + 1;
  let label = "";
  while (value) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function mergeLabel(merge: GridRange): string {
  return `${column(merge.startColumnIndex ?? 0)}${(merge.startRowIndex ?? 0) + 1}:${column((merge.endColumnIndex ?? 1) - 1)}${merge.endRowIndex ?? "?"}`;
}

function dateLike(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length <= 48 && (DAY.test(trimmed) || DATE.test(trimmed) || NUMERIC_DATE.test(trimmed))
  );
}

function structuralRow(row: (string | number | boolean)[] = []) {
  const strings = row.map(String);
  const nonempty = strings.filter((cell) => cell.trim()).length;
  const normalized = strings.map((cell) => cell.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  return {
    nonempty,
    header: ["TIME", "ATTENDANT", "CLIENT", "SERVICE"].every((label) => normalized.includes(label)),
    summaryWords: strings.some((cell) =>
      /\b(?:SUMMARY|TOTAL|SUBTOTAL|REVENUE|AVERAGE)\b/i.test(cell)
    ),
  };
}

describe("opt-in sanitized live Sheet date-boundary inspection", () => {
  inspect(
    "reports only date candidates, row shapes, and associated merges",
    async () => {
      const token = await createLocalAdcSheetTokenProvider().getAccessToken();
      const base = `https://sheets.googleapis.com/v4/spreadsheets/${CRADLE_MAINSHEETS_SPREADSHEET_ID}`;
      const read = async (url: string): Promise<unknown> => {
        const response = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`SHEETS_READ_STATUS_${response.status}`);
        return response.json();
      };
      const metadata = (await read(`${base}?fields=sheets(properties(title),merges)`)) as {
        sheets?: SheetMetadata[];
      };
      for (const title of TABS) {
        const sheet = metadata.sheets?.find((candidate) => candidate.properties?.title === title);
        if (!sheet) throw new Error("EXPECTED_TAB_NOT_FOUND");
        const range = encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:AZ`);
        const formatted = (await read(
          `${base}/values/${range}?valueRenderOption=FORMATTED_VALUE`
        )) as Values;
        const raw = (await read(
          `${base}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`
        )) as Values;
        const formulas = (await read(
          `${base}/values/${encodeURIComponent(`'${title.replace(/'/g, "''")}'!A1:B`)}?valueRenderOption=FORMULA`
        )) as Values;
        const rows = formatted.values ?? [];
        const projection = parseSheetRows({
          spreadsheetId: CRADLE_MAINSHEETS_SPREADSHEET_ID,
          sheetName: title,
          rows: rows.map((row) => row.map(String)),
        });
        const headerColumns = rows.flatMap((row, index) =>
          structuralRow(row).header
            ? [
                {
                  row: index + 1,
                  time: row.flatMap((cell, columnIndex) =>
                    String(cell)
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "") === "TIME"
                      ? [column(columnIndex)]
                      : []
                  ),
                  attendant: row.flatMap((cell, columnIndex) =>
                    String(cell)
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "") === "ATTENDANT"
                      ? [column(columnIndex)]
                      : []
                  ),
                  client: row.flatMap((cell, columnIndex) =>
                    String(cell)
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "") === "CLIENT"
                      ? [column(columnIndex)]
                      : []
                  ),
                  service: row.flatMap((cell, columnIndex) =>
                    String(cell)
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "") === "SERVICE"
                      ? [column(columnIndex)]
                      : []
                  ),
                },
              ]
            : []
        );
        console.log("HEADER_COLUMNS", JSON.stringify({ title, headerColumns }));
        const candidates = rows.flatMap((row, rowIndex) =>
          row.flatMap((cell, columnIndex) => {
            if (typeof cell !== "string" || !dateLike(cell)) return [];
            const underlying = raw.values?.[rowIndex]?.[columnIndex];
            const merges = (sheet.merges ?? []).filter(
              (merge) =>
                rowIndex >= (merge.startRowIndex ?? 0) &&
                rowIndex < (merge.endRowIndex ?? 0) &&
                columnIndex >= (merge.startColumnIndex ?? 0) &&
                columnIndex < (merge.endColumnIndex ?? 0)
            );
            return [
              {
                row: rowIndex + 1,
                cell: `${column(columnIndex)}${rowIndex + 1}`,
                formattedDate:
                  DATE.test(cell.trim()) || NUMERIC_DATE.test(cell.trim())
                    ? cell.trim()
                    : cell
                        .trim()
                        .split(/\s|[,/:.-]/, 1)[0]
                        ?.toUpperCase(),
                underlyingType: typeof underlying,
                underlyingDateSerial:
                  typeof underlying === "number" && underlying >= 40_000 && underlying <= 60_000
                    ? underlying
                    : undefined,
                prev: structuralRow(rows[rowIndex - 1]),
                self: structuralRow(row),
                next: structuralRow(rows[rowIndex + 1]),
                merges: merges.map(mergeLabel),
              },
            ];
          })
        );
        if (process.env.CRADLE_SHEET_DATE_INSPECTION_SECTIONS_ONLY !== "1") {
          console.log(
            "DATE_STRUCTURE",
            JSON.stringify({
              title,
              rowsRead: rows.length,
              mergeCount: sheet.merges?.length ?? 0,
              candidates,
            })
          );
        }
        const dayHeadings = rows.flatMap((row, index) =>
          typeof row[0] === "string" &&
          /^(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)$/i.test(row[0].trim())
            ? [{ row: index + 1, day: row[0].trim().toUpperCase() }]
            : []
        );
        const sections = dayHeadings.map((heading, index) => {
          const next = dayHeadings[index + 1]?.row ?? rows.length + 1;
          const sectionVisits = projection.visits.filter(
            (visit) => visit.source.startRow > heading.row && visit.source.startRow < next
          );
          const sectionDuties = projection.duties.filter(
            (duty) => duty.source.startRow > heading.row && duty.source.startRow < next
          );
          const firstVisitRow = sectionVisits[0]?.source.startRow;
          const near = [heading.row, heading.row + 1, heading.row + 2].map((rowNumber) => {
            const values = rows[rowNumber - 1] ?? [];
            const mergeLabels = (sheet.merges ?? [])
              .filter(
                (merge) =>
                  rowNumber - 1 >= (merge.startRowIndex ?? 0) &&
                  rowNumber - 1 < (merge.endRowIndex ?? 0) &&
                  (merge.startColumnIndex ?? 0) < 2
              )
              .map(mergeLabel);
            return {
              row: rowNumber,
              occupiedColumns: values.flatMap((cell, columnIndex) =>
                String(cell).trim() ? [column(columnIndex)] : []
              ),
              classification:
                projection.classifiedRows.find((item) => item.sourceRow === rowNumber)
                  ?.classification ?? "BLANK",
              startsVisit: projection.visits.some((visit) => visit.source.startRow === rowNumber),
              startsDuty: projection.duties.some((duty) => duty.source.startRow === rowNumber),
              dateCells: candidates
                .filter((candidate) => candidate.row === rowNumber)
                .map((candidate) => ({
                  cell: candidate.cell,
                  formattedDate: candidate.formattedDate,
                  underlyingType: candidate.underlyingType,
                  underlyingDateSerial: candidate.underlyingDateSerial,
                })),
              formulaInAorB: (formulas.values?.[rowNumber - 1] ?? [])
                .slice(0, 2)
                .some((cell) => typeof cell === "string" && cell.startsWith("=")),
              merges: mergeLabels,
            };
          });
          return {
            heading,
            nextHeadingRow: next,
            serviceRows: projection.classifiedRows.filter(
              (row) =>
                row.sourceRow > heading.row &&
                row.sourceRow < next &&
                row.classification === "SERVICE"
            ).length,
            visits: sectionVisits.length,
            datedVisits: sectionVisits.filter((visit) => visit.businessDate).length,
            visitBusinessDates: [...new Set(sectionVisits.map((visit) => visit.businessDate))],
            duties: sectionDuties.length,
            datedDuties: sectionDuties.filter((duty) => duty.businessDate).length,
            firstVisitRow,
            summariesBeforeFirstVisit: projection.classifiedRows
              .filter(
                (row) =>
                  row.sourceRow > heading.row &&
                  row.sourceRow < (firstVisitRow ?? next) &&
                  row.classification === "SUMMARY"
              )
              .map((row) => row.sourceRow),
            firstVisitLeadClasses: firstVisitRow
              ? projection.classifiedRows
                  .filter(
                    (row) => row.sourceRow >= firstVisitRow - 6 && row.sourceRow <= firstVisitRow
                  )
                  .map((row) => ({ row: row.sourceRow, classification: row.classification }))
              : [],
            near,
          };
        });
        console.log("DAY_SECTIONS", JSON.stringify({ title, sections }));
      }
    },
    90_000
  );
});
