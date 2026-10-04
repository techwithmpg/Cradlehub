import { makeSheetSource } from "./sheet-source-identity";
import { parseOperationalDate, parseWeeklyTab } from "./sheet-week";
import type { WeeklyTab } from "./sheet-week";
import type {
  ClassifiedSheetRow,
  SheetAmountEvidence,
  SheetDuty,
  SheetPaymentEvidence,
  SheetProjection,
  SheetReviewRow,
  SheetService,
  SheetVisit,
} from "./sheet-types";

type Column =
  | "time"
  | "attendant"
  | "client"
  | "hours"
  | "service"
  | "rate"
  | "fuel"
  | "cash"
  | "gcash"
  | "bankQr"
  | "cardTerminal"
  | "commission"
  | "location";
type Columns = Partial<Record<Column, number>>;

const HEADER_ALIASES: Record<string, Column> = {
  TIME: "time",
  ATTENDANT: "attendant",
  CLIENT: "client",
  HRS: "hours",
  HOURS: "hours",
  SERVICE: "service",
  PERSERVICERATE: "rate",
  RATE: "rate",
  FUEL: "fuel",
  CASH: "cash",
  GCASH: "gcash",
  BANKTRANSFERQR: "bankQr",
  BANKQR: "bankQr",
  CARDTERMINAL: "cardTerminal",
  COMMISSION: "commission",
  LOCATION: "location",
  ADDRESS: "location",
};

const DUTY_VALUES = new Set([
  "OPENING-CLOSING CSR",
  "OPENING CSR",
  "MID SHIFT",
  "BOOK-KEEPER",
  "CLOSING CSR",
]);

const WEEKDAYS: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function weekday(raw: string): number | null {
  return WEEKDAYS[raw.trim().toUpperCase()] ?? null;
}

function dateForTab(raw: string, tab: WeeklyTab | null): string | null {
  const explicit = parseOperationalDate(raw);
  if (explicit || !tab) return explicit;
  // A real heading uses a yearless formatted value in one tab. The tab week
  // supplies the only acceptable year; do not infer one from today's date.
  const years = new Set([tab.startDate.slice(0, 4), tab.endDate.slice(0, 4)]);
  const matches = [...years]
    .map((year) => parseOperationalDate(`${raw.trim()}, ${year}`))
    .filter(
      (date): date is string => date !== null && date >= tab.startDate && date <= tab.endDate
    );
  return matches.length === 1 ? matches[0]! : null;
}

function inTabWeek(date: string, tab: WeeklyTab | null): boolean {
  return Boolean(tab && date >= tab.startDate && date <= tab.endDate);
}

function weekdayMatches(date: string, day: number): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === day;
}

function normalized(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function headerColumns(cells: readonly string[]): Columns | null {
  const columns: Columns = {};
  cells.forEach((cell, index) => {
    const key = cell.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const column = HEADER_ALIASES[key];
    if (column !== undefined) columns[column] = index;
  });
  return columns.time !== undefined &&
    columns.attendant !== undefined &&
    columns.client !== undefined &&
    columns.service !== undefined
    ? columns
    : null;
}

function cell(cells: readonly string[], columns: Columns, column: Column): string {
  const index = columns[column];
  return index === undefined ? "" : (cells[index] ?? "").trim();
}

export function parseSheetAmount(rawValue: string): SheetAmountEvidence {
  const raw = rawValue.trim();
  if (!raw) return { raw, amount: null, marker: null };
  if (raw === "-") return { raw, amount: null, marker: raw };
  const numeric = raw.replace(/^₱\s*/, "");
  if (/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(numeric)) {
    return { raw, amount: Number(numeric.replace(/,/g, "")), marker: null };
  }
  return { raw, amount: null, marker: raw };
}

function paymentEvidence(cells: readonly string[], columns: Columns): SheetPaymentEvidence {
  return {
    cash: parseSheetAmount(cell(cells, columns, "cash")),
    gcash: parseSheetAmount(cell(cells, columns, "gcash")),
    bankQr: parseSheetAmount(cell(cells, columns, "bankQr")),
    cardTerminal: parseSheetAmount(cell(cells, columns, "cardTerminal")),
  };
}

function hasPaymentValue(payment: SheetPaymentEvidence): boolean {
  return Object.values(payment).some((entry) => entry.raw !== "");
}

function addEvidence(visit: SheetVisit, cells: readonly string[], columns: Columns): void {
  const payment = paymentEvidence(cells, columns);
  if (hasPaymentValue(payment)) visit.paymentEvidence.push(payment);
  const fuel = parseSheetAmount(cell(cells, columns, "fuel"));
  const commission = parseSheetAmount(cell(cells, columns, "commission"));
  if (fuel.raw) visit.fuel.push(fuel);
  if (commission.raw) visit.commission.push(commission);

  for (const [label, evidence] of [
    ["CASH", payment.cash],
    ["GCASH", payment.gcash],
    ["BANK/QR", payment.bankQr],
    ["CARD/TERMINAL", payment.cardTerminal],
    ["FUEL", fuel],
    ["COMMISSION", commission],
  ] as const) {
    if (evidence.marker && evidence.marker !== "-") {
      visit.ambiguities.push(`${label} marker requires review: ${evidence.marker}`);
    }
  }
  if (visit.ambiguities.length) visit.confidence = "needs_review";
}

function isSummary(cells: readonly string[]): boolean {
  const joined = cells.join(" ").toUpperCase();
  return (
    /\b(SUMMARY|TOTAL|SUBTOTAL|AVERAGE|REVENUE)\b/.test(joined) ||
    cells.some((value) => value.trim().startsWith("=")) ||
    /^[A-Z]+\.?\s*\d{1,2}\s*-/.test(joined.trim())
  );
}

export function parseSheetRows(input: {
  spreadsheetId: string;
  sheetName: string;
  rows: readonly (readonly string[])[];
}): SheetProjection {
  const { spreadsheetId, sheetName, rows } = input;
  const visits: SheetVisit[] = [];
  const duties: SheetDuty[] = [];
  const classifiedRows: ClassifiedSheetRow[] = [];
  const needsReview: SheetReviewRow[] = [];
  let columns: Columns | null = null;
  let businessDate: string | null = null;
  let openVisit: SheetVisit | null = null;
  const weeklyTab = parseWeeklyTab(sheetName);

  const source = (startRow: number, endRow = startRow) =>
    makeSheetSource(spreadsheetId, sheetName, startRow, endRow, rows.slice(startRow - 1, endRow));
  const review = (rowNumber: number, cells: readonly string[], reason: string) => {
    needsReview.push({ source: source(rowNumber), businessDate, rawCells: [...cells], reason });
  };
  const classify = (
    rowNumber: number,
    cells: readonly string[],
    classification: ClassifiedSheetRow["classification"],
    reason?: string
  ) => {
    classifiedRows.push({
      sourceRow: rowNumber,
      rawCells: [...cells],
      classification,
      ...(reason ? { reason } : {}),
    });
  };

  rows.forEach((rawCells, index) => {
    const rowNumber = index + 1;
    const cells = rawCells.map((value) => String(value ?? ""));
    const nonempty = cells.map((value) => value.trim()).filter(Boolean);
    if (!nonempty.length) {
      openVisit = null;
      return;
    }

    const newHeader = headerColumns(cells);
    if (newHeader) {
      columns = newHeader;
      businessDate = null;
      openVisit = null;
      classify(rowNumber, cells, "HEADER");
      return;
    }

    if (!columns) {
      const preHeaderDate = parseOperationalDate(cells[0] ?? "");
      if (preHeaderDate && !inTabWeek(preHeaderDate, weeklyTab)) {
        classify(rowNumber, cells, "SUMMARY", "Stale summary date rejected");
        return;
      }
      const classification = isSummary(cells) ? "SUMMARY" : "UNKNOWN_NEEDS_REVIEW";
      classify(rowNumber, cells, classification, "Outside operational section");
      if (classification === "UNKNOWN_NEEDS_REVIEW")
        review(rowNumber, cells, "Meaningful row before operational header");
      return;
    }

    const serviceName = cell(cells, columns, "service");
    if (isSummary(cells) && (!serviceName || serviceName.startsWith("="))) {
      openVisit = null;
      businessDate = null;
      classify(rowNumber, cells, "SUMMARY", "Summary/formula is not a visit source");
      return;
    }

    // The live workbook's unheaded A column carries day/date boundaries;
    // its operational TIME header is in B. Service times still use the header map.
    const boundaryValue = cells[0]?.trim() ?? "";
    const day = weekday(boundaryValue);
    const previousDay = index > 0 ? weekday(rows[index - 1]?.[0] ?? "") : null;
    const rowDate = dateForTab(boundaryValue, weeklyTab);
    let boundaryRow = false;
    let boundaryFailure:
      | "Out-of-week operational date"
      | "Ambiguous operational date boundary"
      | null = null;
    if (day !== null) {
      const nextDate = dateForTab(rows[index + 1]?.[0] ?? "", weeklyTab);
      businessDate =
        nextDate && inTabWeek(nextDate, weeklyTab) && weekdayMatches(nextDate, day)
          ? nextDate
          : null;
      openVisit = null;
      boundaryRow = true;
      if (!nextDate || (inTabWeek(nextDate, weeklyTab) && !weekdayMatches(nextDate, day))) {
        boundaryFailure = "Ambiguous operational date boundary";
      }
    } else if (
      previousDay !== null &&
      (rowDate || /^(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i.test(boundaryValue))
    ) {
      boundaryRow = true;
      openVisit = null;
      if (rowDate && inTabWeek(rowDate, weeklyTab) && weekdayMatches(rowDate, previousDay)) {
        businessDate = rowDate;
      } else {
        businessDate = null;
        boundaryFailure =
          rowDate && !inTabWeek(rowDate, weeklyTab)
            ? "Out-of-week operational date"
            : "Ambiguous operational date boundary";
      }
    } else if (nonempty.length === 1 && rowDate) {
      // A date without the observed weekday + adjacent-date structure cannot
      // establish visit context; it may be a stale summary or report label.
      businessDate = null;
      openVisit = null;
      boundaryRow = true;
      boundaryFailure = inTabWeek(rowDate, weeklyTab)
        ? "Ambiguous operational date boundary"
        : "Out-of-week operational date";
    }

    if (boundaryFailure) review(rowNumber, cells, boundaryFailure);

    const duty = nonempty.find((value) => DUTY_VALUES.has(normalized(value)));
    if (duty) {
      openVisit = null;
      const staffRawName = cell(cells, columns, "attendant") || cell(cells, columns, "client");
      const ambiguities = [
        ...(!businessDate ? ["Missing operational business date"] : []),
        ...(!staffRawName ? ["Missing staff name"] : []),
      ];
      duties.push({
        sourceType: "MASTER_SHEET",
        readOnly: true,
        source: source(rowNumber),
        businessDate,
        staffRawName,
        dutyRawValue: duty,
        confidence: ambiguities.length ? "needs_review" : "recognized",
        ambiguities,
      });
      classify(rowNumber, cells, "STAFF_DUTY");
      return;
    }

    if (boundaryRow) {
      if (boundaryFailure === "Out-of-week operational date") {
        classify(rowNumber, cells, "SUMMARY", "Stale summary date rejected");
      } else if (boundaryFailure || (nonempty.length > 1 && day === null)) {
        classify(rowNumber, cells, "UNKNOWN_NEEDS_REVIEW", "Ambiguous operational date boundary");
        if (!boundaryFailure) review(rowNumber, cells, "Ambiguous operational date boundary");
      } else {
        classify(rowNumber, cells, "INFORMATIONAL", "Operational day/date boundary");
      }
      return;
    }

    const timeRaw = cell(cells, columns, "time");
    const customerRawName = cell(cells, columns, "client");
    const attendantRawNames = cell(cells, columns, "attendant");
    if (serviceName) {
      const service: SheetService = {
        sourceRow: rowNumber,
        rawName: serviceName,
        hours: parseSheetAmount(cell(cells, columns, "hours")),
        quotedRate: parseSheetAmount(cell(cells, columns, "rate")),
      };
      const hasAnchor = Boolean(timeRaw || customerRawName || attendantRawNames);
      const continuationLocation = cell(cells, columns, "location");
      if (
        !hasAnchor &&
        openVisit &&
        continuationLocation &&
        continuationLocation !== openVisit.locationRawValue
      ) {
        openVisit = null;
        classify(rowNumber, cells, "UNKNOWN_NEEDS_REVIEW", "Conflicting continuation location");
        review(rowNumber, cells, "Conflicting continuation location");
        return;
      }
      if (!hasAnchor && !openVisit) {
        classify(rowNumber, cells, "UNKNOWN_NEEDS_REVIEW", "Orphan service continuation");
        review(rowNumber, cells, "Orphan service continuation");
        return;
      }

      if (hasAnchor) {
        const ambiguities = [
          ...(!businessDate ? ["Missing operational business date"] : []),
          ...(!timeRaw ? ["Missing visit time"] : []),
          ...(!customerRawName ? ["Missing customer name"] : []),
          ...(!attendantRawNames ? ["Missing attendant name"] : []),
        ];
        openVisit = {
          sourceType: "MASTER_SHEET",
          readOnly: true,
          source: source(rowNumber),
          businessDate,
          timeRaw,
          customerRawName,
          locationRawValue: cell(cells, columns, "location"),
          attendantRawNames,
          services: [service],
          paymentEvidence: [],
          fuel: [],
          commission: [],
          confidence: ambiguities.length ? "needs_review" : "recognized",
          ambiguities,
        };
        visits.push(openVisit);
      } else if (openVisit) {
        openVisit.services.push(service);
        openVisit.source = source(openVisit.source.startRow, rowNumber);
      }

      if (openVisit) {
        addEvidence(openVisit, cells, columns);
        if (service.hours.marker && service.hours.marker !== "-")
          openVisit.ambiguities.push(`HRS marker requires review: ${service.hours.marker}`);
        if (service.quotedRate.marker && service.quotedRate.marker !== "-")
          openVisit.ambiguities.push(`RATE marker requires review: ${service.quotedRate.marker}`);
        if (openVisit.ambiguities.length) openVisit.confidence = "needs_review";
      }
      classify(rowNumber, cells, "SERVICE");
      return;
    }

    openVisit = null;
    const payment = paymentEvidence(cells, columns);
    if (
      hasPaymentValue(payment) ||
      cell(cells, columns, "fuel") ||
      cell(cells, columns, "commission")
    ) {
      classify(rowNumber, cells, "FINANCIAL_NOTE", "Payment-only row is not assigned to a visit");
      review(rowNumber, cells, "Unassigned financial note");
      return;
    }

    classify(rowNumber, cells, "UNKNOWN_NEEDS_REVIEW", "Meaningful operational row not recognized");
    review(rowNumber, cells, "Meaningful operational row not recognized");
  });

  return {
    spreadsheetId,
    sheetName,
    businessTimezone: "Asia/Manila",
    sourceRowCount: rows.length,
    visits,
    duties,
    classifiedRows,
    needsReview,
  };
}
