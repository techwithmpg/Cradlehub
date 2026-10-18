import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getFrontDeskContext: vi.fn(),
  getBranchBusinessDate: vi.fn(),
  getCashFlowData: vi.fn(),
}));

vi.mock("@/lib/queries/crm-context", () => ({
  getFrontDeskContext: mocks.getFrontDeskContext,
}));
vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: mocks.getBranchBusinessDate,
}));
vi.mock("@/lib/cash-flow/cash-flow-queries", () => ({
  getCashFlowData: mocks.getCashFlowData,
}));

import { loadCrmCashFlowWorkspaceData } from "@/lib/queries/crm-cash-flow-workspace";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFrontDeskContext.mockResolvedValue({
    userId: "auth-user",
    role: "crm",
    branchId: "authorized-branch",
    branchName: "Main Spa",
  });
  mocks.getBranchBusinessDate.mockReturnValue("2026-10-18");
  mocks.getCashFlowData.mockResolvedValue({
    branchId: "authorized-branch",
    branchName: "Main Spa",
    businessDate: "2026-10-18",
  });
});

describe("PERF-8 CRM Cash Flow server authority", () => {
  it("ignores untrusted branch identity and uses server Front Desk context", async () => {
    const result = await loadCrmCashFlowWorkspaceData({
      date: "2026-10-17",
      branchId: "attacker-branch",
    } as never);

    expect(mocks.getCashFlowData).toHaveBeenCalledWith(
      "authorized-branch",
      "Main Spa",
      "2026-10-17",
      expect.objectContaining({ page: 1 })
    );
    expect(result.context.branchId).toBe("authorized-branch");
  });

  it("falls back to the server business date for malformed or impossible dates", async () => {
    await loadCrmCashFlowWorkspaceData({
      date: "2026-02-31",
    });

    expect(mocks.getCashFlowData).toHaveBeenCalledWith(
      "authorized-branch",
      "Main Spa",
      "2026-10-18",
      expect.any(Object)
    );
  });

  it("normalizes read filters without accepting them as financial authority", async () => {
    const result = await loadCrmCashFlowWorkspaceData({
      search: "  customer  ",
      category: "booking",
      method: "cash",
      status: "posted",
      page: -10,
    });

    expect(result.payload.request).toEqual({
      date: "2026-10-18",
      search: "customer",
      category: "booking",
      method: "cash",
      status: "posted",
      page: 1,
    });
  });
});
