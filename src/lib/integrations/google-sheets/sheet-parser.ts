export type SheetCell = string | number | boolean | null | undefined;

export type SheetRowType =
  | "header"
  | "aggregate_summary"
  | "staff_duty"
  | "service_candidate"
  | "financial_or_note"
  | "informational"
  | "unknown";

export type PaymentMethod = "cash" | "gcash" | "bank_qr" | "card_terminal";

export type ParsedPaymentComponent = {
  method: PaymentMethod;
  raw: SheetCell;
  amount: number | null;
  marker: string | null;
};

export type ParsedSheetRow = {
  sourceRow: number;
  businessDate: string | null;
  rowType: SheetRowType;

  rawValues: SheetCell[];

  location: string | null;
  time: string | null;
  attendant: string | null;
  client: string | null;
  hours: string | null;
  service: string | null;

  rate: number | null;
  rateRaw: SheetCell;

  fuelOrTravel: number | null;
  fuelOrTravelRaw: SheetCell;

  payments: ParsedPaymentComponent[];
  hasSplitPayment: boolean;

  commission: number | null;
  commissionRaw: SheetCell;

  issues: string[];
};

export type ParsedSheetBlock = {
  headerRow: number;
  startRow: number;
  endRow: number;
  businessDate: string | null;
};

export type ParsedWeeklySheet = {
  headerRows: number[];
  blocks: ParsedSheetBlock[];
  rows: ParsedSheetRow[];
  meaningfulRowCount: number;
  countsByType: Record<SheetRowType, number>;
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const DUTY_PATTERN =
  /^(OPENING CSR|CLOSING CSR|OPENING-CLOSING CSR|OPENING CLOSING CSR|MID SHIFT|BOOK-KEEPER|BOOK KEEPER)$/i;

const DASH_ONLY_PATTERN = /^-+$/;

const AGGREGATE_SUMMARY_PATTERN = /^(TOTAL NO\.?\s*OF HOURS|NET PROFIT\s*:?)$/i;

function text(value: SheetCell): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function nullableText(value: SheetCell): string | null {
  const valueText = text(value);
  return valueText ? valueText : null;
}

function isMeaningfulRow(row: SheetCell[]): boolean {
  return row.some((value) => text(value) !== "");
}

export function parseMoney(value: SheetCell): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = text(value);

  if (!raw || DASH_ONLY_PATTERN.test(raw)) {
    return null;
  }

  const negativeByParentheses = raw.startsWith("(") && raw.endsWith(")");

  const cleaned = raw.replace(/[₱,$]/g, "").replace(/\s+/g, "").replace(/[()]/g, "");

  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negativeByParentheses ? -parsed : parsed;
}

function parseBusinessDate(value: SheetCell): string | null {
  const raw = text(value);

  const match = raw.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})$/i
  );

  if (!match) {
    return null;
  }

  const monthName = match[1]?.toLowerCase();
  const dayText = match[2];
  const yearText = match[3];

  if (!monthName || !dayText || !yearText) {
    return null;
  }

  const month = MONTHS[monthName];
  const day = Number(dayText);
  const year = Number(yearText);

  if (!month || !Number.isInteger(day) || !Number.isInteger(year)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function isHeaderRow(row: SheetCell[]): boolean {
  return text(row[1]).toUpperCase() === "TIME" && text(row[5]).toUpperCase() === "SERVICE";
}

function parsePaymentComponent(method: PaymentMethod, value: SheetCell): ParsedPaymentComponent {
  const rawText = text(value);

  if (!rawText || DASH_ONLY_PATTERN.test(rawText)) {
    return {
      method,
      raw: value,
      amount: null,
      marker: null,
    };
  }

  const amount = parseMoney(value);

  if (amount !== null) {
    return {
      method,
      raw: value,
      amount,
      marker: null,
    };
  }

  return {
    method,
    raw: value,
    amount: null,
    marker: rawText.toUpperCase(),
  };
}

function classifyRow(row: SheetCell[]): SheetRowType {
  if (isHeaderRow(row)) {
    return "header";
  }

  const firstColumn = text(row[0]);

  if (firstColumn && AGGREGATE_SUMMARY_PATTERN.test(firstColumn)) {
    return "aggregate_summary";
  }

  const service = text(row[5]);

  if (service && DUTY_PATTERN.test(service)) {
    return "staff_duty";
  }

  const hasServiceSignals = [
    row[1],
    row[2],
    row[3],
    row[5],
    row[6],
    row[7],
    row[8],
    row[9],
    row[10],
    row[11],
    row[12],
  ].some((value) => text(value) !== "");

  if (service && hasServiceSignals) {
    return "service_candidate";
  }

  const hasFinancialSignals = [row[7], row[8], row[9], row[10], row[11], row[12]].some(
    (value) => text(value) !== ""
  );

  if (hasFinancialSignals) {
    return "financial_or_note";
  }

  if (isMeaningfulRow(row)) {
    return "informational";
  }

  return "unknown";
}

function resolveBlockDate(
  values: SheetCell[][],
  headerIndex: number,
  nextHeaderIndex: number
): string | null {
  const searchEnd = Math.min(nextHeaderIndex, headerIndex + 20);

  for (let index = headerIndex + 1; index < searchEnd; index += 1) {
    const candidate = parseBusinessDate(values[index]?.[0]);

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function parseRow(
  rawValues: SheetCell[],
  sourceRow: number,
  businessDate: string | null
): ParsedSheetRow {
  const rowType = classifyRow(rawValues);

  const payments: ParsedPaymentComponent[] = [
    parsePaymentComponent("cash", rawValues[8]),
    parsePaymentComponent("gcash", rawValues[9]),
    parsePaymentComponent("bank_qr", rawValues[10]),
    parsePaymentComponent("card_terminal", rawValues[11]),
  ];

  const numericPaymentCount = payments.filter(
    (payment) => payment.amount !== null && Number.isFinite(payment.amount) && payment.amount !== 0
  ).length;

  const issues: string[] = [];

  if (rowType !== "header" && rowType !== "informational" && !businessDate) {
    issues.push("MISSING_BLOCK_DATE");
  }

  if (rowType === "service_candidate") {
    if (!text(rawValues[1])) {
      issues.push("MISSING_OR_CONTINUATION_TIME");
    }

    if (!text(rawValues[2])) {
      issues.push("MISSING_OR_CONTINUATION_ATTENDANT");
    }

    if (!text(rawValues[3])) {
      issues.push("MISSING_OR_CONTINUATION_CLIENT");
    }
  }

  if (payments.some((payment) => payment.marker !== null)) {
    issues.push("PAYMENT_MARKER_REQUIRES_REVIEW");
  }

  const fuelOrTravelRaw = rawValues[7];
  const fuelOrTravelText = text(fuelOrTravelRaw);
  const fuelOrTravel = parseMoney(fuelOrTravelRaw);

  if (fuelOrTravelText && fuelOrTravel === null && !DASH_ONLY_PATTERN.test(fuelOrTravelText)) {
    issues.push("NON_NUMERIC_FUEL_OR_TRAVEL_NOTE");
  }

  return {
    sourceRow,
    businessDate,
    rowType,

    rawValues: [...rawValues],

    location: nullableText(rawValues[0]),
    time: nullableText(rawValues[1]),
    attendant: nullableText(rawValues[2]),
    client: nullableText(rawValues[3]),
    hours: nullableText(rawValues[4]),
    service: nullableText(rawValues[5]),

    rate: parseMoney(rawValues[6]),
    rateRaw: rawValues[6],

    fuelOrTravel,
    fuelOrTravelRaw,

    payments,
    hasSplitPayment: numericPaymentCount > 1,

    commission: parseMoney(rawValues[12]),
    commissionRaw: rawValues[12],

    issues,
  };
}

export function parseWeeklySheet(inputValues: SheetCell[][]): ParsedWeeklySheet {
  const values = inputValues.map((row) => [...row]);

  const headerIndexes: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    if (isHeaderRow(values[index] ?? [])) {
      headerIndexes.push(index);
    }
  }

  const blocks: ParsedSheetBlock[] = headerIndexes.map((headerIndex, blockIndex) => {
    const nextHeaderIndex = headerIndexes[blockIndex + 1] ?? values.length;

    return {
      headerRow: headerIndex + 1,
      startRow: headerIndex + 2,
      endRow: nextHeaderIndex,
      businessDate: resolveBlockDate(values, headerIndex, nextHeaderIndex),
    };
  });

  const dateByRowIndex = new Map<number, string | null>();

  headerIndexes.forEach((headerIndex, blockIndex) => {
    const nextHeaderIndex = headerIndexes[blockIndex + 1] ?? values.length;

    const businessDate = blocks[blockIndex]?.businessDate ?? null;

    for (let index = headerIndex + 1; index < nextHeaderIndex; index += 1) {
      dateByRowIndex.set(index, businessDate);
    }
  });

  const parsedRows: ParsedSheetRow[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const row = values[index] ?? [];

    if (!isMeaningfulRow(row)) {
      continue;
    }

    const businessDate = dateByRowIndex.get(index) ?? null;

    parsedRows.push(parseRow(row, index + 1, businessDate));
  }

  const countsByType: Record<SheetRowType, number> = {
    header: 0,
    aggregate_summary: 0,
    staff_duty: 0,
    service_candidate: 0,
    financial_or_note: 0,
    informational: 0,
    unknown: 0,
  };

  for (const row of parsedRows) {
    countsByType[row.rowType] += 1;
  }

  return {
    headerRows: headerIndexes.map((index) => index + 1),
    blocks,
    rows: parsedRows,
    meaningfulRowCount: parsedRows.length,
    countsByType,
  };
}
