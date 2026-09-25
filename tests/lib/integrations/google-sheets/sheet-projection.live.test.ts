import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const describeLive = process.env.CRADLE_SHEET_LIVE_TEST === "1" ? describe : describe.skip;

describeLive("CradleHub live Sheet CRM projection", () => {
  it("preserves the zero-silent-drop invariant through the runtime projection", async () => {
    const { readActiveSheetProjection } =
      await import("@/lib/integrations/google-sheets/sheet-projection");

    const snapshot = await readActiveSheetProjection();

    const accounted =
      snapshot.countsByDisposition.match_candidate +
      snapshot.countsByDisposition.needs_review +
      snapshot.countsByDisposition.derived_informational;

    console.log("");

    console.log("--- LIVE SHEET CRM PROJECTION EVIDENCE ---");

    console.log({
      sheetName: snapshot.sheetName,

      rawMeaningfulRows: snapshot.rawMeaningfulRowCount,

      normalizedMeaningfulRows: snapshot.normalizedMeaningfulRowCount,

      projectedRows: snapshot.rows.length,

      restorationCount: snapshot.restorationCount,

      businessDates: snapshot.businessDates,

      countsByDisposition: snapshot.countsByDisposition,

      countsByRowType: snapshot.countsByRowType,
    });

    expect(snapshot.rawMeaningfulRowCount).toBeGreaterThan(0);

    expect(snapshot.normalizedMeaningfulRowCount).toBe(snapshot.rawMeaningfulRowCount);

    expect(snapshot.rows.length).toBe(snapshot.normalizedMeaningfulRowCount);

    expect(accounted).toBe(snapshot.normalizedMeaningfulRowCount);

    expect(snapshot.businessDates.length).toBeGreaterThan(0);
  }, 45_000);
});
