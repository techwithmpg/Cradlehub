import { createHash } from "node:crypto";
import type { SheetSource } from "./sheet-types";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function makeSheetSource(
  spreadsheetId: string,
  sheetName: string,
  startRow: number,
  endRow: number,
  rawRows: readonly (readonly string[])[],
): SheetSource {
  if (!spreadsheetId || !sheetName || startRow < 1 || endRow < startRow) {
    throw new Error("Invalid Sheet source coordinates");
  }

  const coordinates = JSON.stringify([spreadsheetId, sheetName, startRow, endRow]);
  return {
    spreadsheetId,
    sheetName,
    startRow,
    endRow,
    sourceKey: `master-sheet:${hash(coordinates)}`,
    contentFingerprint: hash(JSON.stringify(rawRows)),
  };
}
