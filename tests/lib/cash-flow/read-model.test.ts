import { describe, expect, it } from "vitest";
import {
  buildCashFlowDay,
  filterCashFlowEntries,
  EMPTY_CASH_FLOW_FILTERS,
  reconciliationSummary,
  validateCashFlowRange,
} from "@/lib/cash-flow/read-model";
import { buildDailyPaymentSummary } from "@/lib/bookings/payment-summary";
import { booking, reconciliation, DATE } from "./fixtures";

describe("Cash Flow canonical read model", () => {
  it("shares daily-summary semantics for partial payments, refunds, completed and excluded CRM statuses", () => {
    const rows = [
      booking(),
      booking({
        id: "partial",
        payment_status: "pending",
        amount_paid: 300,
        payment_method: "gcash",
      }),
      booking({ id: "unpaid", payment_status: "unpaid", amount_paid: 0 }),
      booking({
        id: "refunded",
        payment_status: "refunded",
        amount_paid: 100,
        payment_method: "other",
      }),
      booking({ id: "complete", status: "completed", amount_paid: 200, payment_method: "card" }),
      ...["cancelled", "no_show", "expired"].map((status) => booking({ id: status, status })),
    ];
    const day = buildCashFlowDay(DATE, rows, null);
    expect(day.summary).toEqual(buildDailyPaymentSummary(rows, DATE));
    expect(day.summary).toMatchObject({
      total_collected: 1600,
      total_unpaid: 1700,
      total_expected: 5000,
      total_count: 5,
      paid_count: 2,
      unpaid_count: 2,
      by_method: { cash: 1000, gcash: 300, card: 200, other: 100 },
    });
    expect(day.entries.map((row) => row.id)).not.toContain("cancelled");
    expect(day).not.toHaveProperty("expenses");
    expect(day).not.toHaveProperty("profit");
  });
  it("aggregates all six supported payment methods without duplicating booking snapshots", () => {
    const rows = ["cash", "gcash", "maya", "card", "pay_on_site", "other"].map((payment_method) =>
      booking({ id: payment_method, payment_method, amount_paid: 50 })
    );
    const day = buildCashFlowDay(DATE, [...rows, rows[0]!], null);
    expect(day.summary.total_collected).toBe(300);
    expect(Object.values(day.summary.by_method)).toEqual([50, 50, 50, 50, 50, 50]);
  });
  it("attributes a Home Service quote fee only to its assigned booking line", () => {
    const rows = [true, false, undefined].map((applied, index) =>
      booking({
        id: String(index),
        delivery_type: "home_service",
        metadata: {
          price_paid: 1200,
          private_address: "must not serialize",
          pricing_breakdown: {
            service_line_price: 1000,
            home_service_travel_fee: 200,
            travel_fee_applied_to_booking: applied,
          },
        },
      })
    );
    const entries = buildCashFlowDay(DATE, rows, null).entries;
    expect(entries.map((row) => row.source)).toEqual([
      "home_service",
      "home_service",
      "home_service",
    ]);
    expect(entries.map((row) => row.travelFee)).toEqual([200, 0, null]);
    expect(JSON.stringify(entries)).not.toContain("private_address");
    expect(entries[0]?.servicePrice).toBe(1000);
  });
  it("uses saved reconciliation variance and locks approved expected counts to their snapshot", () => {
    const day = buildCashFlowDay(
      DATE,
      [booking({ amount_paid: 2000 })],
      reconciliation({ status: "approved" })
    );
    expect(day.summary.total_collected).toBe(2000);
    expect(day.variance).toBe(-10);
    expect(reconciliationSummary(day).total_collected).toBe(1000);
    expect(
      reconciliationSummary({ ...day, reconciliation: reconciliation() }).total_collected
    ).toBe(2000);
  });
  it("filters search, date, source, method and status together", () => {
    const day = buildCashFlowDay(
      DATE,
      [
        booking(),
        booking({
          id: "home",
          delivery_type: "home_service",
          payment_method: "maya",
          payment_status: "pending",
        }),
      ],
      null
    );
    const filters = {
      search: " test-001 ",
      date: DATE,
      source: "home_service",
      method: "maya",
      status: "pending",
    };
    expect(filterCashFlowEntries(day.entries, filters).map((row) => row.id)).toEqual(["home"]);
    expect(filterCashFlowEntries(day.entries, { ...filters, date: "2026-09-25" })).toEqual([]);
    expect(filterCashFlowEntries(day.entries, EMPTY_CASH_FLOW_FILTERS)).toHaveLength(2);
  });
  it("separates historical days and supports empty dates without inventing a close", () => {
    const day = buildCashFlowDay("2026-09-25", [booking()], null);
    expect(day.entries).toEqual([]);
    expect(day.summary.total_collected).toBe(0);
    expect(day.variance).toBeNull();
    expect(day.reconciliation).toBeNull();
  });
  it.each([
    { from: "2026-02-30", to: "2026-03-01" },
    { from: DATE, to: "2026-09-25" },
    { from: "2026-01-01", to: "2026-02-01" },
    { from: "invalid", to: DATE },
  ])("rejects malformed or excessive ranges %j", (range) => {
    expect(() => validateCashFlowRange(range)).toThrow();
  });
  it("accepts 31 inclusive days", () => {
    expect(validateCashFlowRange({ from: "2026-01-01", to: "2026-01-31" }).to).toBe("2026-01-31");
  });
});
