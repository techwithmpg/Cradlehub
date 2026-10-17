import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCrmContext: vi.fn(),
  loadWorkspace: vi.fn(),
}));

vi.mock("@/lib/queries/crm-context", () => ({
  getCrmContext: mocks.getCrmContext,
}));
vi.mock("@/lib/queries/crm-customers-workspace", () => ({
  loadCrmCustomersWorkspaceData: mocks.loadWorkspace,
}));

import { refreshCrmCustomersWorkspaceAction } from "@/lib/actions/crm-customers-data-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCrmContext.mockResolvedValue({ role: "crm", branchId: "branch-authorized" });
  mocks.loadWorkspace.mockResolvedValue({
    tab: "all",
    page: 1,
    search: undefined,
    allCustomers: [],
    repeatCustomers: [],
    lapsedCustomers: [],
    waitlistRows: [],
    kpiData: {
      totalCustomers: 0,
      repeatClients: 0,
      lapsedClients: 0,
      newThisMonth: 0,
      totalVisits: 0,
    },
    totalPages: 1,
  });
});

describe("PERF-6 CRM Customers refresh authority", () => {
  it("derives branch scope from server CRM context and accepts no client branch override", async () => {
    await refreshCrmCustomersWorkspaceAction({
      tab: "repeat",
      page: 2,
      search: " Ana ",
    });

    expect(mocks.getCrmContext).toHaveBeenCalledTimes(1);
    expect(mocks.loadWorkspace).toHaveBeenCalledWith({
      branchId: "branch-authorized",
      request: {
        tab: "repeat",
        page: 2,
        search: "Ana",
      },
    });
  });

  it("normalizes untrusted tab/page input before querying", async () => {
    await refreshCrmCustomersWorkspaceAction({
      tab: "not-real",
      page: -9,
    });

    expect(mocks.loadWorkspace).toHaveBeenCalledWith({
      branchId: "branch-authorized",
      request: {
        tab: "all",
        page: 1,
        search: undefined,
      },
    });
  });
});
