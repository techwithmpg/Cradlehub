import "server-only";

import { google } from "googleapis";
import { getGoogleSheetsReadConfig } from "./config";

export type GoogleSheetCell = string | number | boolean | null;

export type GoogleSheetRangeResult = {
  spreadsheetId: string;
  sheetName: string;
  requestedRange: string;
  resolvedRange: string | null;
  values: GoogleSheetCell[][];
};

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function escapeSheetName(sheetName: string): string {
  return sheetName.replaceAll("'", "''");
}

async function createReadOnlySheetsClient() {
  const config = getGoogleSheetsReadConfig();

  const auth = new google.auth.GoogleAuth({
    scopes: [SHEETS_READONLY_SCOPE],
  });

  return {
    spreadsheetId: config.spreadsheetId,
    sheets: google.sheets({
      version: "v4",
      auth,
    }),
  };
}

/**
 * Reads one explicit worksheet/range.
 *
 * Authentication comes from Google Application Default Credentials.
 * Local development uses keyless service-account impersonation.
 *
 * READ ONLY:
 * this module exposes no append/update/clear/batchUpdate operation.
 */
export async function readGoogleSheetRange(input: {
  sheetName: string;
  a1Range?: string;
}): Promise<GoogleSheetRangeResult> {
  const sheetName = input.sheetName.trim();

  if (!sheetName) {
    throw new Error("sheetName is required");
  }

  const a1Range = input.a1Range?.trim() || "A1:M1200";
  const { spreadsheetId, sheets } = await createReadOnlySheetsClient();

  const requestedRange = `'${escapeSheetName(sheetName)}'!${a1Range}`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: requestedRange,
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = (response.data.values ?? []).map((row) =>
    row.map((cell) => {
      if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") {
        return cell;
      }

      return null;
    })
  );

  return {
    spreadsheetId,
    sheetName,
    requestedRange,
    resolvedRange: response.data.range ?? null,
    values,
  };
}

/**
 * Returns visible worksheet titles.
 *
 * Metadata read only. This does not select or modify a worksheet.
 */
export async function listGoogleSheetTitles(): Promise<string[]> {
  const { spreadsheetId, sheets } = await createReadOnlySheetsClient();

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,index,hidden)",
  });

  return (response.data.sheets ?? [])
    .map((sheet) => sheet.properties)
    .filter(
      (
        properties
      ): properties is NonNullable<typeof properties> & {
        title: string;
      } => Boolean(properties?.title) && properties?.hidden !== true
    )
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((properties) => properties.title);
}
