import { beforeEach, describe, expect, it, vi } from "vitest";
import { header, serviceRow } from "./smart-sheet-fixtures";
vi.mock("server-only", () => ({}));
const reader = vi.hoisted(() => ({
  readGoogleSheetRange: vi.fn(),
  readGoogleSheetMergeRanges: vi.fn(),
}));
vi.mock("@/lib/integrations/google-sheets/sheet-reader", () => reader);
import { readSheetIngestionDryRun } from "@/lib/integrations/google-sheets/sheet-live-dry-run";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GOOGLE_SHEETS_ACTIVE_SHEET_NAME", "SEP 18-24,2026");
  reader.readGoogleSheetRange.mockResolvedValue({
    spreadsheetId: "fixture",
    sheetName: "SEP 18-24,2026",
    values: [header, ["September 18, 2026"], serviceRow()],
  });
  reader.readGoogleSheetMergeRanges.mockResolvedValue({
    spreadsheetId: "fixture",
    sheetName: "SEP 18-24,2026",
    merges: [],
  });
});
describe("active-tab-only reader", () => {
  it("rejects historical tabs before any read", async () => {
    await expect(readSheetIngestionDryRun({ sheetName: "historical" })).rejects.toThrow(
      "approved active"
    );
    expect(reader.readGoogleSheetRange).not.toHaveBeenCalled();
  });
  it("reads one active range plus metadata and produces safe metrics", async () => {
    const { summary } = await readSheetIngestionDryRun({ sheetName: "SEP 18-24,2026" });
    expect(reader.readGoogleSheetRange).toHaveBeenCalledTimes(1);
    expect(reader.readGoogleSheetMergeRanges).toHaveBeenCalledTimes(1);
    expect(summary.parsing.silentDrops).toBe(0);
    expect(summary.performanceMs.sheetRead).toBeGreaterThanOrEqual(0);
  });
  it("rejects mismatched source metadata", async () => {
    reader.readGoogleSheetMergeRanges.mockResolvedValue({
      spreadsheetId: "other",
      sheetName: "SEP 18-24,2026",
      merges: [],
    });
    await expect(readSheetIngestionDryRun({ sheetName: "SEP 18-24,2026" })).rejects.toThrow(
      "different sources"
    );
  });
  it("fails safely if the bounded read could truncate meaningful rows", async () => {
    reader.readGoogleSheetRange.mockResolvedValue({
      spreadsheetId: "fixture",
      sheetName: "SEP 18-24,2026",
      values: Array.from({ length: 1200 }, () => serviceRow()),
    });
    await expect(readSheetIngestionDryRun({ sheetName: "SEP 18-24,2026" })).rejects.toThrow(
      "row bound"
    );
  });
  it("does not expose provider request metadata on errors", async () => {
    reader.readGoogleSheetRange.mockRejectedValue(new Error("private request metadata"));
    await expect(readSheetIngestionDryRun({ sheetName: "SEP 18-24,2026" })).rejects.toThrow(
      "Read-only Sheet access failed"
    );
  });
});
