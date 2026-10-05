import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mockClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: mockClient }));

import { fetchOwnerReportsData } from "@/lib/queries/owner-reports";

function client() {
  const branch = { id: "main-id", name: "Main Branch" };
  const booking = {
    id: "booking-1",
    branch_id: branch.id,
    service_id: "service-1",
    staff_id: null,
    customer_id: "customer-1",
    booking_date: "2026-10-04",
    status: "completed",
    metadata: { price_paid: 1000 },
    payment_method: "cash",
    payment_status: "paid",
    amount_paid: 900,
    branches: branch,
    services: { id: "service-1", name: "Massage", service_categories: { name: "Massage" } },
    staff: null,
    customers: null,
  };
  const financial = [
    {
      id: "tx-1",
      branch_id: branch.id,
      business_date: "2026-10-04",
      transaction_type: "customer_payment",
      financial_account_movements: [{ amount: 500, payment_method: "cash" }],
    },
    {
      id: "tx-2",
      branch_id: branch.id,
      business_date: "2026-10-04",
      transaction_type: "other_income",
      financial_account_movements: [{ amount: 100, payment_method: "gcash" }],
    },
    {
      id: "tx-3",
      branch_id: branch.id,
      business_date: "2026-10-04",
      transaction_type: "cash_adjustment",
      financial_account_movements: [{ amount: 300, payment_method: "cash" }],
    },
  ];
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let range: [number, number] | null = null;
      const query = {
        select: () => query,
        order: () => query,
        eq: (field: string, value: unknown) => {
          filters[field] = value;
          return query;
        },
        gte: () => query,
        lte: () => query,
        range: (from: number, to: number) => {
          range = [from, to];
          return query;
        },
        then: (resolve: (value: unknown) => unknown) => {
          const rows =
            table === "branches" ? [branch] : table === "bookings" ? [booking] : financial;
          const filtered = rows.filter(
            (row) =>
              !filters.branch_id || (row as { branch_id?: string }).branch_id === filters.branch_id
          );
          const paged = range ? filtered.slice(range[0], range[1] + 1) : filtered;
          return Promise.resolve({ data: paged, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

describe("Owner Reports financial authority", () => {
  it("uses posted receipt movements and leaves booking snapshots and Sheet outside financial totals", async () => {
    mockClient.mockResolvedValue(client());
    const report = await fetchOwnerReportsData({
      preset: "custom",
      from: "2026-10-04",
      to: "2026-10-04",
      branchId: "all",
    });
    expect(report.kpis?.canonicalRevenue).toBe(600);
    expect(report.kpis?.collectedPayments).toBe(500);
    expect(report.kpis?.averageBookingValue).toBe(1000);
    expect(report.paymentBreakdown?.totalTransactions).toBe(2);
    expect(report.serviceData?.[0]?.revenue).toBe(0);
    expect(report.staffData).toEqual([]);
    expect(report.sheetEvidence).toBeUndefined();
    expect(report.dailyFinancials?.[0]?.transactions).toBe(2);
  });

  it("accepts the active Main branch and rejects an unknown branch instead of falling back to All", async () => {
    mockClient.mockResolvedValue(client());
    const main = await fetchOwnerReportsData({
      preset: "custom",
      from: "2026-10-04",
      to: "2026-10-04",
      branchId: "main-id",
    });
    expect(main.branchId).toBe("main-id");
    await expect(
      fetchOwnerReportsData({
        preset: "custom",
        from: "2026-10-04",
        to: "2026-10-04",
        branchId: "sm-id",
      })
    ).rejects.toThrow("Invalid report branch");
  });
});
