import { beforeEach, describe, expect, it, vi } from "vitest";
import { booking, reconciliation, DATE } from "./fixtures";
const mocks = vi.hoisted(() => ({ context: vi.fn(), client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries/crm-context", () => ({ getFrontDeskContext: mocks.context }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/engine/slot-time", async (original) => ({
  ...(await original<typeof import("@/lib/engine/slot-time")>()),
  getBranchBusinessDate: () => "2026-09-26",
}));
import { getCashFlowWorkspace } from "@/lib/queries/cash-flow";
import { getDailyPaymentSummary } from "@/lib/queries/bookings";
import { refreshCashFlow } from "@/app/(dashboard)/crm/cash-flow/actions";
import Page from "@/app/(dashboard)/crm/cash-flow/page";
// Keep the route test server-only: no browser or reconciliation mutations.
vi.mock("@/components/features/cash-flow/cash-flow-workspace", () => ({
  CashFlowWorkspace: () => null,
}));

function adapter(fail = false, count = 1) {
  const calls: { table: string; filters: Record<string, unknown>; offset: number }[] = [];
  mocks.client.mockResolvedValue({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((key, value) => {
          filters[key] = value;
          return query;
        }),
        gte: vi.fn((key, value) => {
          filters[`from:${key}`] = value;
          return query;
        }),
        lte: vi.fn((key, value) => {
          filters[`to:${key}`] = value;
          return query;
        }),
        order: vi.fn(() => query),
        range: vi.fn(async (from: number, to: number) => {
          calls.push({ table, filters, offset: from });
          const dateKey = table === "bookings" ? "booking_date" : "reconciliation_date";
          const rows =
            table === "bookings"
              ? Array.from({ length: count }, (_, i) => booking({ id: `row-${i}` }))
              : [reconciliation()];
          const date = DATE;
          const exactDate = filters[dateKey];

          const matches =
            exactDate !== undefined
              ? date === String(exactDate)
              : date >= String(filters[`from:${dateKey}`]) &&
                date <= String(filters[`to:${dateKey}`]);

          return {
            data: fail ? null : matches ? rows.slice(from, to + 1) : [],
            error: fail ? new Error("private database detail") : null,
          };
        }),
      };
      return query;
    },
  });
  return calls;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ branchId: "branch-a", branchName: "TEST Branch" });
});
describe("Cash Flow authenticated TEST query boundary", () => {
  it("derives the branch on every read, ignores extra client branch input, and uses canonical tables", async () => {
    const calls = adapter();
    const range = { from: DATE, to: DATE, branchId: "hostile-other-branch" };
    const data = await refreshCashFlow(range);
    expect(data.branchId).toBe("branch-a");
    expect(calls.map((call) => call.table)).toEqual(["bookings", "daily_cash_reconciliations"]);
    expect(calls.every((call) => call.filters.branch_id === "branch-a")).toBe(true);
    expect(data.today.reconciliation?.id).toBe("close-a");
    expect(data.today.summary.total_collected).toBe(1000);
  });
  it("paginates beyond the API default page without losing or duplicating totals", async () => {
    const calls = adapter(false, 501);
    const data = await getCashFlowWorkspace({ from: DATE, to: DATE });

    expect(data.today.entries).toHaveLength(501);
    expect(data.today.summary.total_collected).toBe(501000);

    expect(calls.filter((call) => call.table === "bookings").map((call) => call.offset)).toEqual([
      0, 500,
    ]);
  });

  it("keeps Cash Flow and Day Close payment totals aligned beyond 1,000 bookings", async () => {
    const calls = adapter(false, 1001);

    const cashFlow = await getCashFlowWorkspace({ from: DATE, to: DATE });
    const dayClose = await getDailyPaymentSummary("branch-a", DATE);

    expect(cashFlow.today.entries).toHaveLength(1001);

    expect(dayClose.total_collected).toBe(cashFlow.today.summary.total_collected);
    expect(dayClose.total_unpaid).toBe(cashFlow.today.summary.total_unpaid);
    expect(dayClose.by_method).toEqual(cashFlow.today.summary.by_method);

    expect(
      calls
        .filter((call) => call.table === "bookings")
        .map((call) => call.offset)
    ).toEqual([0, 500, 1000, 0, 500, 1000]);
  });
  it("loads Today separately when browsing history and fills empty historical days", async () => {
    const calls = adapter();
    const data = await getCashFlowWorkspace({ from: "2026-09-01", to: "2026-09-02" });
    expect(data.days.map((day) => day.date)).toEqual(["2026-09-02", "2026-09-01"]);
    expect(data.days.every((day) => day.entries.length === 0)).toBe(true);
    expect(data.today.entries).toHaveLength(1);
    expect(calls).toHaveLength(4);
  });
  it("fails closed without a branch or authenticated context", async () => {
    adapter();
    mocks.context.mockResolvedValueOnce({ branchId: "" });
    await expect(getCashFlowWorkspace()).rejects.toThrow("branch");
    mocks.context.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(getCashFlowWorkspace()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("reports query errors instead of showing fabricated zero balances", async () => {
    adapter(true);
    await expect(getCashFlowWorkspace()).rejects.toThrow("Cash Flow data could not be loaded");
  });
  it("rejects invalid ranges before reading and wires the single server route to the workspace", async () => {
    adapter();
    await expect(getCashFlowWorkspace({ from: "bad", to: DATE })).rejects.toThrow();
    expect(mocks.client).not.toHaveBeenCalled();
    const page = await Page();
    expect(page.props.initialData.branchId).toBe("branch-a");
  });
});
