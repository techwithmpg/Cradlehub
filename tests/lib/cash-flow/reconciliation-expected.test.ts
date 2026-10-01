import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { getPostedReconciliationExpected } from "@/lib/cash-flow/reconciliation-expected";

function clientWithRows(rows: Array<Record<string, unknown>>, error = false) {
  const filters: Record<string, unknown> = {};
  const query = {
    select: () => query,
    eq: (column: string, value: unknown) => { filters[column] = value; return query; },
    order: () => query,
    range: async (from: number, to: number) => ({
      data: error ? null : rows.filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key] === value)
      ).slice(from, to + 1),
      error: error ? { message: "query failed" } : null,
    }),
  };
  return { from: vi.fn(() => query) };
}

describe("persisted reconciliation expected totals", () => {
  it("uses posted movements by branch and business date, including signed cash operations", async () => {
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
    const client = clientWithRows(rows);
    const expected = await getPostedReconciliationExpected("main", "2026-10-01", client as never);
    expect(expected).toEqual({ cash: 400, gcash: 300, maya: 0, card: 0, other: 70 });
    expect(client.from).toHaveBeenCalledWith("financial_transactions");
  });

  it("fails closed when posted financial movements cannot be loaded", async () => {
    const client = clientWithRows([], true);
    await expect(getPostedReconciliationExpected("main", "2026-10-01", client as never))
      .rejects.toThrow("Could not load posted financial movements");
  });
});
