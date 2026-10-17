import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCustomersPage: vi.fn(),
  getRepeatCustomers: vi.fn(),
  getLapsedCustomers: vi.fn(),
  getCrmStats: vi.fn(),
  getWaitlistAction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries/customers", () => ({
  getCustomersPage: mocks.getCustomersPage,
  getRepeatCustomers: mocks.getRepeatCustomers,
  getLapsedCustomers: mocks.getLapsedCustomers,
  getCrmStats: mocks.getCrmStats,
}));
vi.mock("@/app/(dashboard)/crm/waitlist/actions", () => ({
  getWaitlistAction: mocks.getWaitlistAction,
}));

import { loadCrmCustomersWorkspaceData } from "@/lib/queries/crm-customers-workspace";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCustomersPage.mockResolvedValue({ data: [], pageCount: 1 });
  mocks.getRepeatCustomers.mockResolvedValue({ customers: [], total: 0 });
  mocks.getLapsedCustomers.mockResolvedValue([]);
  mocks.getCrmStats.mockResolvedValue({
    total: 10,
    repeat: 4,
    lapsed: 2,
    newThisMonth: 1,
    totalVisits: 30,
  });
  mocks.getWaitlistAction.mockResolvedValue({ ok: true, data: [] });
});

describe("PERF-6 CRM Customers workspace loader", () => {
  it("loads All list and base stats together under the authorized branch", async () => {
    const result = await loadCrmCustomersWorkspaceData({
      branchId: "branch-a",
      request: { tab: "all", page: 2, search: "Ana" },
    });

    expect(mocks.getCustomersPage).toHaveBeenCalledWith({
      branchId: "branch-a",
      search: "Ana",
      page: 2,
      pageSize: 25,
    });
    expect(mocks.getCrmStats).toHaveBeenCalledWith("branch-a");
    expect(result.kpiData.totalCustomers).toBe(10);
  });

  it("does not recompute base CRM stats when switching to Repeat", async () => {
    await loadCrmCustomersWorkspaceData({
      branchId: "branch-a",
      request: { tab: "repeat", page: 1 },
    });

    expect(mocks.getRepeatCustomers).toHaveBeenCalledWith(2, 1, 25, "branch-a");
    expect(mocks.getCrmStats).not.toHaveBeenCalled();
  });

  it("does not recompute base CRM stats for Lapsed or Follow-up segments", async () => {
    await loadCrmCustomersWorkspaceData({
      branchId: "branch-a",
      request: { tab: "lapsed", page: 1 },
    });
    expect(mocks.getCrmStats).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.getWaitlistAction.mockResolvedValue({ ok: true, data: [] });

    await loadCrmCustomersWorkspaceData({
      branchId: "branch-a",
      request: { tab: "followup", page: 1 },
    });
    expect(mocks.getWaitlistAction).toHaveBeenCalledWith("branch-a");
    expect(mocks.getCrmStats).not.toHaveBeenCalled();
  });
});
