import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { getPostedReconciliationExpected } from "@/lib/cash-flow/reconciliation-expected";

function clientWithData(
  txRows: Array<Record<string, unknown>>,
  sessionRows: Array<Record<string, unknown>> = [],
  errorTable?: "financial_transactions" | "cash_sessions"
) {
  return {
    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { filters[column] = value; return query; },
        order: () => query,
        range: async (from: number, to: number) => ({
          data: errorTable === table ? null : txRows.filter((row) =>
            Object.entries(filters).every(([key, value]) => row[key] === value)
          ).slice(from, to + 1),
          error: errorTable === table ? { message: "query failed" } : null,
        }),
        then: (resolve: (val: unknown) => void) => {
          if (errorTable === table) {
            resolve({ data: null, error: { message: "query failed" } });
          } else {
            const data = sessionRows.filter((row) =>
              Object.entries(filters).every(([key, value]) => row[key] === value)
            );
            resolve({ data, error: null });
          }
        },
      };
      return query;
    }),
  };
}

describe("persisted reconciliation expected totals", () => {
  it("includes cash drawer opening float and posted movements by branch and business date", async () => {
    const sessionRows = [
      { branch_id: "main", business_date: "2026-10-01", opening_float: 2000 },
      { branch_id: "other", business_date: "2026-10-01", opening_float: 1000 },
      { branch_id: "main", business_date: "2026-09-30", opening_float: 500 },
    ];
    const rows = [
      { branch_id: "main", business_date: "2026-10-01", status: "posted",
        financial_account_movements: [
          { amount: 500, payment_method: "cash" },
          { amount: 300, payment_method: "gcash" },
        ] },
      { branch_id: "main", business_date: "2026-10-01", status: "posted",
        financial_account_movements: [
          { amount: -100, payment_method: "cash" },
          { amount: 70, payment_method: "bank_transfer" },
        ] },
      { branch_id: "other", business_date: "2026-10-01", status: "posted",
        financial_account_movements: [{ amount: 999, payment_method: "cash" }] },
      { branch_id: "main", business_date: "2026-09-30", status: "posted",
        financial_account_movements: [{ amount: 999, payment_method: "cash" }] },
      { branch_id: "main", business_date: "2026-10-01", status: "voided",
        financial_account_movements: [{ amount: 999, payment_method: "cash" }] },
    ];
    const client = clientWithData(rows, sessionRows);
    const expected = await getPostedReconciliationExpected("main", "2026-10-01", client as never);
    expect(expected).toEqual({ cash: 2400, gcash: 300, maya: 0, card: 0, other: 70 });
    expect(client.from).toHaveBeenCalledWith("cash_sessions");
    expect(client.from).toHaveBeenCalledWith("financial_transactions");
  });

  it("P1-B CASE 1: reflects opening float when there are zero movements", async () => {
    const sessionRows = [
      { branch_id: "main", business_date: "2026-10-01", opening_float: 500 },
    ];
    const client = clientWithData([], sessionRows);
    const expected = await getPostedReconciliationExpected("main", "2026-10-01", client as never);
    expect(expected).toEqual({ cash: 500, gcash: 0, maya: 0, card: 0, other: 0 });
  });

  it("fails closed when posted financial movements cannot be loaded", async () => {
    const client = clientWithData([], [], "financial_transactions");
    await expect(getPostedReconciliationExpected("main", "2026-10-01", client as never))
      .rejects.toThrow("Could not load posted financial movements");
  });

  it("fails closed when cash sessions cannot be loaded", async () => {
    const client = clientWithData([], [], "cash_sessions");
    await expect(getPostedReconciliationExpected("main", "2026-10-01", client as never))
      .rejects.toThrow("Could not load cash sessions for reconciliation");
  });
});
