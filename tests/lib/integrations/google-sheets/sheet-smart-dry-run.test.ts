import { describe, expect, it, vi } from "vitest";
import {
  buildSheetIngestionDryRun,
  summarizeSheetDryRun,
} from "@/lib/integrations/google-sheets/sheet-dry-run";
import { unavailableSheetContext } from "@/lib/integrations/google-sheets/sheet-resolution-context";
import type { SheetContextNeeds } from "@/lib/integrations/google-sheets/sheet-resolution-context";
import { decideSheetRow } from "@/lib/integrations/google-sheets/sheet-attention";
import { planSheetRow } from "@/lib/integrations/google-sheets/sheet-projection-planner";
import { sheetIssue } from "@/lib/integrations/google-sheets/sheet-preflight";
import { header, serviceRow, capture } from "./smart-sheet-fixtures";

const base = { spreadsheetId: "fixture", sheetName: "active", merges: [] };
describe("smart dry run orchestration", () => {
  it("restores only merge-backed identity, preserves raw evidence and accounts for every row", async () => {
    const values = [
      header,
      ["September 18, 2026"],
      serviceRow(),
      serviceRow({ 1: "", 2: "", 3: "" }),
      serviceRow({ 1: "", 2: "", 3: "" }),
    ];
    const snapshot = structuredClone(values);
    const run = await buildSheetIngestionDryRun({
      ...base,
      rawValues: values,
      merges: [2, 3, 4].map((column) => ({
        startRow: 3,
        endRow: 4,
        startColumn: column,
        endColumn: column,
      })),
    });
    expect(values).toEqual(snapshot);
    expect(run.restorationCounts).toEqual({ attendant: 1, client: 1, time: 1, total: 3 });
    expect(run.rows.find((r) => r.source.sourceRow === 4)).toMatchObject({
      rawValues: snapshot[3],
      parsed: { attendant: "Nikki", client: "Test Customer" },
    });
    expect(run.rows.find((r) => r.source.sourceRow === 5)?.parsed.attendant).toBeNull();
    expect(run.rows).toHaveLength(run.rawMeaningfulRows);
    expect(Object.values(run.decisions).reduce((a, b) => a + b, 0)).toBe(run.rawMeaningfulRows);
    expect(Object.keys(run.decisions).sort()).toEqual([
      "informational",
      "needs_attention",
      "ready",
      "warning",
    ]);
  });
  it("does not load canonical context when headers change", async () => {
    const loadContext = vi.fn(async (needs: SheetContextNeeds) =>
      unavailableSheetContext(`test: ${needs.dates.length} dates`)
    );
    const changed = [...header];
    changed[8] = "CARD";
    const run = await buildSheetIngestionDryRun({
      ...base,
      rawValues: [changed, serviceRow()],
      loadContext,
    });
    expect(loadContext).not.toHaveBeenCalled();
    expect(
      run.rows.every((r) => r.plan.decision === "needs_attention" && r.plan.severity === "critical")
    ).toBe(true);
  });
  it("loads context once per batch and deduplicates lookup needs", async () => {
    const loadContext = vi.fn(async (needs: SheetContextNeeds) =>
      unavailableSheetContext(`test: ${needs.dates.length} dates`)
    );
    await buildSheetIngestionDryRun({
      ...base,
      rawValues: [
        header,
        ["September 18, 2026"],
        ...Array.from({ length: 200 }, () => serviceRow()),
      ],
      loadContext,
    });
    expect(loadContext).toHaveBeenCalledTimes(1);
    expect(loadContext.mock.calls[0]?.[0]).toMatchObject({ dates: ["2026-09-18"] });
  });
  it("keeps duties, aggregate evidence and financial-only entries outside Bookings", async () => {
    const run = await buildSheetIngestionDryRun({
      ...base,
      rawValues: [
        header,
        ["September 18, 2026"],
        ["", "", "Nikki", "", "", "OPENING CSR"],
        ["Expenses", "", "", "", "", "", "", "", 150],
        ["TOTAL SALES", "", "", "", "", "", 500],
      ],
    });
    for (const row of run.rows.filter((r) => r.plan.intent !== "context"))
      expect(row.bookingIntent).toBeNull();
    expect(run.rows.find((r) => r.plan.intent === "duty")?.dutyIntent?.dutyType).toBe(
      "OPENING CSR"
    );
    expect(
      run.rows.find((r) => r.plan.intent === "financial")?.financialIntent?.candidateSubtype
    ).toBe("expense");
    expect(run.rows.find((r) => r.plan.intent === "aggregate")?.plan).toMatchObject({
      decision: "informational",
      projections: [{ module: "cash_flow", kind: "evidence_only" }],
    });
  });
  it("retains split channels and returns precise attention with dependent workload", async () => {
    const run = await buildSheetIngestionDryRun({
      ...base,
      rawValues: [header, ["September 18, 2026"], serviceRow({ 8: 200, 9: 200, 10: "GV" })],
    });
    const row = run.rows.find((r) => r.plan.intent === "service")!;
    expect(row.plan.financial.splitPayment).toBe(true);
    expect(row.plan.financial.numericPaymentTotal).toBe(400);
    const marker = row.attention.find((a) => a.code === "PAYMENT_MARKER_UNKNOWN")!;
    expect(marker).toMatchObject({
      rawValue: "GV",
      afterCorrection: "revalidate_before_apply",
      decision: "needs_attention",
    });
    expect(marker.source.fingerprint).toBe(row.source.fingerprint);
    expect(row.plan.projections.find((p) => p.module === "schedule")).toMatchObject({
      kind: "derived_visibility",
      dependsOn: ["bookings"],
    });
    expect(row.plan.projections.find((p) => p.module === "cash_flow")).toMatchObject({
      kind: "pending_confirmation",
      dependsOn: ["bookings"],
    });
  });
  it("keeps warning distinct from needs_attention", () => {
    const plan = planSheetRow(capture([serviceRow()])[0]!);
    const warning = sheetIssue(
      "EXPLAINED_NOTE",
      "payments",
      "Retain the approved explanation.",
      {},
      "warning"
    );
    expect(decideSheetRow(plan, [warning]).decision).toBe("warning");
    expect(decideSheetRow(plan, [{ ...warning, passed: null }]).decision).toBe("needs_attention");
  });
  it("keeps source key stable but fingerprint and attention IDs change on edits", async () => {
    const a = await buildSheetIngestionDryRun({
      ...base,
      rawValues: [header, serviceRow({ 8: "?" })],
    });
    const b = await buildSheetIngestionDryRun({
      ...base,
      rawValues: [header, serviceRow({ 8: "GV" })],
    });
    expect(a.rows[1]!.source.key).toBe(b.rows[1]!.source.key);
    expect(a.rows[1]!.source.fingerprint).not.toBe(b.rows[1]!.source.fingerprint);
    expect(a.rows[1]!.attention[0]!.id).not.toBe(b.rows[1]!.attention[0]!.id);
    expect(summarizeSheetDryRun(a).parsing.silentDrops).toBe(0);
  });
});
