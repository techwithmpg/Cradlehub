import { describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getDailyPaymentSummary } from "@/lib/queries/bookings";

describe("CRM daily order payment summary", () => {
  it("counts a multi-booking order's canonical partial payment once", async () => {
    const tables: Record<string, Array<Record<string, unknown>>> = {
      bookings: [
        { branch_id: "branch-a", booking_date: "2026-09-29", status: "confirmed",
          order_id: "order-a", amount_paid: 0, payment_status: "pending",
          payment_method: "pay_on_site", metadata: { price_paid: 500 } },
        { branch_id: "branch-a", booking_date: "2026-09-29", status: "confirmed",
          order_id: "order-a", amount_paid: 0, payment_status: "pending",
          payment_method: "pay_on_site", metadata: { price_paid: 500 } },
      ],
      v_booking_order_financial_summaries: [{
        order_id: "order-a", total_payable: 1000, net_allocated: 500,
        payment_state: "partial",
      }],
      booking_orders: [{ id: "order-a", metadata: { total_amount: 1000 } }],
      financial_transactions: [{
        source_id: "order-a", source_type: "booking_order", status: "posted",
        financial_account_movements: [{ amount: 500, payment_method: "cash" }],
      }],
    };
    createClient.mockResolvedValue({
      from(table: string) {
        const filters: Array<(row: Record<string, unknown>) => boolean> = [];
        const query = {
          select: () => query,
          eq: (column: string, value: unknown) => {
            filters.push((row: Record<string, unknown>) => row[column] === value);
            return query;
          },
          in: (column: string, values: unknown[]) => {
            filters.push((row: Record<string, unknown>) => values.includes(row[column]));
            return query;
          },
          then: (resolve: (result: { data: Array<Record<string, unknown>>; error: null }) => unknown) =>
            Promise.resolve({
              data: (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row))),
              error: null,
            }).then(resolve),
        };
        return query;
      },
    });
    const result = await getDailyPaymentSummary("branch-a", "2026-09-29");
    expect(result).toMatchObject({
      total_expected: 1000, total_collected: 500, total_unpaid: 500,
      paid_count: 0, unpaid_count: 2, by_method: { cash: 500 },
    });
  });
});
