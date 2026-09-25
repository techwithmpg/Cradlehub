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

function escapeSheetName(sheetName: string): string {
  return sheetName.replaceAll("'", "''");
}

function createReadOnlySheetsClient() {
  const config = getGoogleSheetsReadConfig();

  const auth = new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
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
 * Reads values from one explicit worksheet/range.
 *
 * This module is intentionally READ ONLY.
 * It exposes no append, update, clear, batchUpdate, or write operation.
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
  const { spreadsheetId, sheets } = createReadOnlySheetsClient();

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
 * Metadata-only worksheet discovery.
 *
 * Used later to safely determine which weekly worksheet should be read.
 * No worksheet is selected automatically at this stage.
 */
export async function listGoogleSheetTitles(): Promise<string[]> {
  const { spreadsheetId, sheets } = createReadOnlySheetsClient();

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,index,hidden)",
  });

  return (response.data.sheets ?? [])
    .map((sheet) => sheet.properties)
    .filter(
      (properties): properties is NonNullable<typeof properties> & { title: string } =>
        Boolean(properties?.title) && properties?.hidden !== true
    )
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((properties) => properties.title);
}
