import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const describeLive = process.env.CRADLE_SHEET_LIVE_TEST === "1" ? describe : describe.skip;
describeLive("active Sheet smart ingestion READ ONLY", () => {
  it("measures decisions and zero silent drops without canonical context or mutations", async () => {
    const { readSheetIngestionDryRun } =
      await import("@/lib/integrations/google-sheets/sheet-live-dry-run");
    const { run, summary } = await readSheetIngestionDryRun({ sheetName: "SEP 18-24,2026" });
    console.log("SMART_SHEET_AGGREGATE_EVIDENCE", JSON.stringify(summary, null, 2));
    expect(summary.schemaValid).toBe(true);
    expect(run.rowsRead).toBe(1010);
    expect(run.rawMeaningfulRows).toBe(702);
    expect(run.normalizedMeaningfulRows).toBe(702);
    expect(run.rows).toHaveLength(702);
    expect(run.countsByType).toEqual({
      header: 7,
      aggregate_summary: 14,
      staff_duty: 38,
      service_candidate: 414,
      financial_or_note: 138,
      informational: 91,
      unknown: 0,
    });
    expect(run.restorationCounts).toEqual({ attendant: 217, client: 20, time: 2, total: 239 });
    expect(
      run.rows.filter((r) => r.parsed.issues.includes("MISSING_OR_CONTINUATION_TIME"))
    ).toHaveLength(30);
    expect(Object.values(run.decisions).reduce((a, b) => a + b, 0)).toBe(702);
    expect(
      run.rows.every((r) =>
        ["ready", "warning", "needs_attention", "informational"].includes(r.plan.decision)
      )
    ).toBe(true);
    expect(
      run.rows
        .filter((r) => r.plan.intent === "service")
        .every((r) =>
          r.plan.projections.some((p) => p.module === "schedule" && p.kind === "derived_visibility")
        )
    ).toBe(true);
    expect(
      run.rows
        .filter((r) => ["duty", "aggregate", "financial"].includes(r.plan.intent))
        .every((r) => r.bookingIntent === null)
    ).toBe(true);
    expect(summary.context).toEqual({ status: "unavailable", target: null });
    expect(summary.conflicts.canonicalBookingOverlaps).toBeNull();
    expect(Object.values(run.writes).every((n) => n === 0)).toBe(true);
  }, 90_000);
});
