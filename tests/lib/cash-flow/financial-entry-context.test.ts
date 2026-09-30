import { beforeEach, describe, expect, it, vi } from "vitest";

const { getContext, getDate, getData } = vi.hoisted(() => ({
  getContext: vi.fn(),
  getDate: vi.fn(),
  getData: vi.fn(),
}));

vi.mock("@/lib/queries/crm-context", () => ({ getFrontDeskContext: getContext }));
vi.mock("@/lib/engine/slot-time", () => ({ getBranchBusinessDate: getDate }));
vi.mock("@/lib/cash-flow/cash-flow-queries", () => ({ getCashFlowData: getData }));
vi.mock("server-only", () => ({}));

import { loadFinancialEntryContextAction } from "@/lib/cash-flow/financial-entry-context";
import { CashFlowRequiredDataError } from "@/lib/cash-flow/cash-flow-errors";

describe("financial entry context for Cradle Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContext.mockResolvedValue({ branchId: "branch-1", branchName: "Main Spa" });
    getDate.mockReturnValue("2026-09-30");
    getData.mockResolvedValue({
      branchId: "branch-1",
      businessDate: "2026-09-30",
      accounts: [{ id: "account-1" }],
      expenseCategories: [{ id: "category-1" }],
      staffOptions: [{ id: "staff-1" }],
      payableOrders: [{ id: "order-1" }],
      cashSessions: { activeSessions: [], availableDrawers: [] },
      ledger: { records: [{ id: "not-needed" }] },
    });
  });

  it("loads the owning Cash Flow options for the authenticated branch and date", async () => {
    const result = await loadFinancialEntryContextAction();

    expect(getData).toHaveBeenCalledWith("branch-1", "Main Spa", "2026-09-30");
    expect(result).toEqual({
      ok: true,
      data: {
        branchId: "branch-1",
        businessDate: "2026-09-30",
        accounts: [{ id: "account-1" }],
        expenseCategories: [{ id: "category-1" }],
        staffOptions: [{ id: "staff-1" }],
        payableOrders: [{ id: "order-1" }],
        cashSessions: { activeSessions: [], availableDrawers: [] },
      },
    });
  });

  it("does not turn a missing Cash Flow contract into empty options", async () => {
    getData.mockRejectedValue(new CashFlowRequiredDataError("financial_accounts"));

    expect(await loadFinancialEntryContextAction()).toEqual({
      ok: false,
      error: "Cash Flow database contract unavailable: financial_accounts.",
    });
  });
});
