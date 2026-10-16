import "server-only";

import { listGoogleSheetTitles, readGoogleSheetRange, type GoogleSheetCell } from "./sheet-reader";
import type { SheetContext } from "./sheet-resolution-context";
import { normalizeSheetText } from "./sheet-source-identity";

export type SheetContactContext = SheetContext["contacts"][number];

const CONTACT_SHEET_NAME = "CLIENTS CONTACT NUMBER";
const CONTACT_READ_RANGE = "A1:G500";

function text(value: GoogleSheetCell): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedHeader(value: GoogleSheetCell): string {
  return normalizeSheetText(value).replace(/[’']/g, "").replace(/\s+/g, " ").trim();
}

function buildContactName(first: GoogleSheetCell, second: GoogleSheetCell): string {
  return [text(first), text(second)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Approved Master Sheet contact layout:
 *
 * A = sequence/index
 * B = NAME / first name or primary customer name
 * C = second name / surname / additional name
 * D = NUMBER
 * E:G = location/address evidence
 *
 * Customer identity uses B+C and D only in this pass.
 * Location/address remains source evidence and is not interpreted here.
 */
export function parseSheetContacts(input: {
  sheetName: string;
  values: GoogleSheetCell[][];
}): SheetContactContext[] {
  if (normalizeSheetText(input.sheetName) !== normalizeSheetText(CONTACT_SHEET_NAME)) {
    throw new Error("The customer identity worksheet does not match the approved Contacts source.");
  }

  const header = input.values[0] ?? [];

  const nameHeader = normalizedHeader(header[1] ?? null);
  const phoneHeader = normalizedHeader(header[3] ?? null);

  if (nameHeader !== "name" || !/^(?:number|phone|contact number)$/.test(phoneHeader)) {
    throw new Error(
      "CLIENTS CONTACT NUMBER does not match its approved B=NAME and D=NUMBER layout."
    );
  }

  const contacts: SheetContactContext[] = [];

  for (let index = 1; index < input.values.length; index += 1) {
    const row = input.values[index] ?? [];

    const name = buildContactName(row[1] ?? null, row[2] ?? null);

    const phone = text(row[3] ?? null) || null;

    // Identity without a usable name + phone cannot safely resolve a customer.
    if (!name || !phone) {
      continue;
    }

    contacts.push({
      name,
      phone,
      email: null,
      source: `${input.sheetName}:${index + 1}`,
    });
  }

  return contacts;
}

/**
 * Read-only supporting identity source.
 *
 * No Sheet mutation exists in this module.
 * The worksheet title and layout are explicitly approved rather than guessed.
 */
export async function readGoogleSheetContactsContext(): Promise<SheetContactContext[]> {
  const titles = await listGoogleSheetTitles();

  const matches = titles.filter(
    (title) => normalizeSheetText(title) === normalizeSheetText(CONTACT_SHEET_NAME)
  );

  if (matches.length === 0) {
    throw new Error("CLIENTS CONTACT NUMBER was not found among the visible worksheets.");
  }

  if (matches.length > 1) {
    throw new Error(
      "More than one worksheet matches CLIENTS CONTACT NUMBER; customer identity source requires confirmation."
    );
  }

  const sheetName = matches[0]!;

  const result = await readGoogleSheetRange({
    sheetName,
    a1Range: CONTACT_READ_RANGE,
  });

  if (result.values.length >= 500) {
    throw new Error(
      "CLIENTS CONTACT NUMBER reached the approved 500-row read bound; confirm a larger range before continuing."
    );
  }

  return parseSheetContacts({
    sheetName,
    values: result.values,
  });
}
