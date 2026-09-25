import { describe, expect, it } from "vitest";
import { planSheetRow } from "@/lib/integrations/google-sheets/sheet-projection-planner";
import {
  preflightSheetRow,
  findSheetConflictCandidates,
} from "@/lib/integrations/google-sheets/sheet-preflight";
import {
  inspectSheetSchema,
  compareSheetSourceVersions,
} from "@/lib/integrations/google-sheets/sheet-source-identity";
import { capture, header, serviceRow } from "./smart-sheet-fixtures";

describe("smart Sheet projection and local preflight", () => {
  it("keeps clean service ownership in Bookings and only derived Schedule workload", () => {
    const row = capture([serviceRow()])[0]!;
    const plan = planSheetRow(row);
    expect(plan.projections).toContainEqual(
      expect.objectContaining({ module: "bookings", kind: "canonical_write_candidate" })
    );
    expect(plan.projections).toContainEqual(
      expect.objectContaining({
        module: "schedule",
        kind: "derived_visibility",
        dependsOn: ["bookings"],
      })
    );
    expect(preflightSheetRow(row, plan)).toEqual([]);
    expect(plan.decision).toBe("needs_attention"); // A plan alone is not canonical validation.
  });
  it("preserves cash and split Cash/GCash components", () => {
    const row = capture([serviceRow({ 8: 300, 9: 200 })])[0]!;
    const plan = planSheetRow(row);
    expect(plan.financial).toMatchObject({
      splitPayment: true,
      numericPaymentTotal: 500,
      difference: 0,
    });
    expect(plan.financial.payments.map((p) => p.amount)).toEqual([300, 200, null, null]);
    expect(plan.projections.find((p) => p.module === "cash_flow")?.dependsOn).toEqual(["bookings"]);
  });
  it("stages location plus fuel without assigning Home Service", () => {
    const row = capture([serviceRow({ 0: "Test destination", 7: 100 })])[0]!;
    const plan = planSheetRow(row);
    expect(plan.delivery).toMatchObject({ state: "location_and_fuel", confirmedDelivery: null });
    expect(plan.projections.find((p) => p.module === "home_service")?.kind).toBe(
      "pending_confirmation"
    );
    expect(preflightSheetRow(row, plan)).toContainEqual(
      expect.objectContaining({ code: "HOME_SERVICE_UNCERTAIN", impact: "warning" })
    );
  });
  it.each(["PWD", "SENIOR", "PICK UP"])("preserves ambiguous travel marker %s", (marker) => {
    const row = capture([serviceRow({ 7: marker })])[0]!;
    expect(planSheetRow(row).delivery).toMatchObject({
      state: "ambiguous",
      marker,
      confirmedDelivery: null,
    });
  });
  it("routes duty to Schedule without a booking or invented shift", () => {
    const row = capture([["", "", "Test CSR", "", "", "OPENING CSR"]])[0]!;
    const plan = planSheetRow(row);
    expect(plan.intent).toBe("duty");
    expect(plan.projections.map((p) => p.module)).toEqual(["schedule"]);
    expect(row.parsed.time).toBeNull();
  });
  it("routes financial-only expense evidence to Cash Flow, never Bookings", () => {
    const row = capture([["LAUNDRY", "", "", "", "", "", "", "", 100]])[0]!;
    expect(planSheetRow(row)).toMatchObject({
      intent: "financial",
      projections: [{ module: "cash_flow", kind: "pending_confirmation" }],
    });
  });
  it.each([
    "TOTAL NO.OF HOURS",
    "TOTAL SALES",
    "NET PROFIT:",
    "TOTAL EXPENSE FOR THE DAY",
    "TOTAL WEEKLY INCOME",
  ])("keeps %s as evidence, not a transaction", (label) => {
    const row = capture([[label, "", "", "", "", "", "", "", 1000]])[0]!;
    expect(planSheetRow(row)).toMatchObject({
      intent: "aggregate",
      decision: "informational",
      projections: [{ module: "cash_flow", kind: "evidence_only" }],
    });
  });
  it("keeps labels informational and unknown rows needing attention", () => {
    const row = capture([["Notes"]])[0]!;
    expect(planSheetRow(row).decision).toBe("informational");
    row.parsed.rowType = "unknown";
    expect(preflightSheetRow(row, planSheetRow(row))).toContainEqual(
      expect.objectContaining({ code: "ROW_MEANING_UNKNOWN", severity: "critical" })
    );
  });
  it.each([
    [5, "SERVICE_UNKNOWN"],
    [2, "STAFF_MISSING"],
    [3, "CUSTOMER_MISSING"],
    [1, "TIME_MISSING"],
  ] as const)(
    "catches missing column %s without dropping incomplete service evidence",
    (column, code) => {
      const row = capture([serviceRow({ [column]: "" })])[0]!;
      expect(preflightSheetRow(row, planSheetRow(row)).map((c) => c.code)).toContain(code);
    }
  );
  it("requires explanation for markers and payment differences without guessing", () => {
    const row = capture([serviceRow({ 8: 100, 9: "GV" })])[0]!;
    expect(preflightSheetRow(row, planSheetRow(row)).map((c) => c.code)).toEqual(
      expect.arrayContaining(["PAYMENT_MISMATCH", "PAYMENT_MARKER_UNKNOWN"])
    );
  });
  it("detects overlap and exact appointment similarity as candidates", () => {
    const rows = capture([serviceRow(), serviceRow({ 1: "10:30 AM" }), serviceRow()]);
    expect(findSheetConflictCandidates(rows, rows.map(planSheetRow)).map((c) => c.type)).toEqual(
      expect.arrayContaining(["provider_overlap", "possible_duplicate_booking"])
    );
  });
  it("uses deterministic version fingerprints and preserves raw values", () => {
    const input = serviceRow();
    const before = structuredClone(input);
    const first = capture([input])[0]!;
    const same = capture([input])[0]!;
    const changed = capture([serviceRow({ 8: 450 })])[0]!;
    expect(first.rawValues).toEqual(before);
    expect(compareSheetSourceVersions(first.source, same.source)).toBe("unchanged");
    expect(compareSheetSourceVersions(first.source, changed.source)).toBe("changed_source");
    expect(first.source.key).toBe(changed.source.key);
  });
  it("rejects changed schema while accepting the observed bank/card header variants", () => {
    expect(inspectSheetSchema([header]).checks[0]?.passed).toBe(true);
    const changed = [...header];
    changed[9] = "NEW FIELD";
    expect(inspectSheetSchema([changed]).checks[0]).toMatchObject({
      passed: false,
      severity: "critical",
    });
    expect(inspectSheetSchema([]).checks[0]?.passed).toBe(false);
  });
});
