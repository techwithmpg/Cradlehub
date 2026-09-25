import "server-only";
import { readGoogleSheetRange, readGoogleSheetMergeRanges } from "./sheet-reader";
import { buildSheetIngestionDryRun, summarizeSheetDryRun } from "./sheet-dry-run";
import type { SheetContext, SheetContextNeeds } from "./sheet-resolution-context";

export async function readSheetIngestionDryRun(input: {
  sheetName: string;
  loadContext?: (needs: SheetContextNeeds) => Promise<SheetContext>;
}) {
  const approvedSheet = process.env.GOOGLE_SHEETS_ACTIVE_SHEET_NAME?.trim();
  if (!approvedSheet || input.sheetName !== approvedSheet)
    throw new Error("Only the configured approved active worksheet may be read.");
  const start = performance.now();
  const [values, merges] = await Promise.all([
    (async () => {
      const started = performance.now();
      const value = await readGoogleSheetRange({ sheetName: input.sheetName, a1Range: "A1:M1200" });
      return { value, ms: performance.now() - started };
    })(),
    (async () => {
      const started = performance.now();
      const value = await readGoogleSheetMergeRanges({ sheetName: input.sheetName });
      return { value, ms: performance.now() - started };
    })(),
  ]).catch(() => {
    // Provider errors can contain request metadata; do not expose them in reports.
    throw new Error("Read-only Sheet access failed; no rows were applied.");
  });
  if (
    values.value.spreadsheetId !== merges.value.spreadsheetId ||
    values.value.sheetName !== merges.value.sheetName ||
    values.value.sheetName !== input.sheetName
  )
    throw new Error("Sheet values and merge metadata identify different sources.");
  if (values.value.values.length >= 1200)
    throw new Error(
      "The approved row bound was reached; confirm a larger read range before processing."
    );
  const run = await buildSheetIngestionDryRun({
    spreadsheetId: values.value.spreadsheetId,
    sheetName: input.sheetName,
    rawValues: values.value.values,
    merges: merges.value.merges,
    loadContext: input.loadContext,
  });
  run.timings.sheetRead = values.ms;
  run.timings.mergeMetadataRead = merges.ms;
  run.timings.total = performance.now() - start;
  return { run, summary: summarizeSheetDryRun(run) };
}
