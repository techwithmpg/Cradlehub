import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries/crm-cash-flow-workspace", () => ({
  loadCrmCashFlowWorkspaceData: mocks.loadWorkspace,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import CrmCashFlowPage from "@/app/(dashboard)/crm/cash-flow/page";
import { CashFlowRequiredDataError } from "@/lib/cash-flow/cash-flow-errors";

const baseData = {
  branchId: "branch-1",
  branchName: "Main Spa",
  businessDate: "2026-10-18",
};

function readyResult(request: Record<string, unknown> = {}) {
  return {
    context: {
      userId: "user-1",
      role: "crm",
      branchId: "branch-1",
      branchName: "Main Spa",
    },
    payload: {
      data: baseData,
      request: {
        date: "2026-10-18",
        page: 1,
        ...request,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadWorkspace.mockResolvedValue(readyResult());
});

describe("Cash Flow page retained initial state", () => {
  it("loads workspace data once and selects Today when no tab is requested", async () => {
    const page = await CrmCashFlowPage({
      searchParams: Promise.resolve({}),
    });
    const workspace = page.props.children;

    expect(workspace.props.initialTab).toBe("today");
    expect(mocks.loadWorkspace).toHaveBeenCalledOnce();
    expect(mocks.loadWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 })
    );
    expect(workspace.props.initialPayload.data).toEqual(baseData);
  });

  it.each(["today", "ledger", "day-close", "history"])(
    "accepts a valid %s deep link on initial load",
    async (tab) => {
      const page = await CrmCashFlowPage({
        searchParams: Promise.resolve({ tab }),
      });
      const workspace = page.props.children;

      expect(workspace.props.initialTab).toBe(tab);
      expect(mocks.loadWorkspace).toHaveBeenCalledOnce();
    }
  );

  it.each(["unknown", "", ["ledger", "history"]])(
    "falls back to Today for invalid tab %s",
    async (tab) => {
      const page = await CrmCashFlowPage({
        searchParams: Promise.resolve({ tab }),
      });
      const workspace = page.props.children;

      expect(workspace.props.initialTab).toBe("today");
      expect(mocks.loadWorkspace).toHaveBeenCalledOnce();
    }
  );

  it.each([
    ["payment", "customer_payment"],
    ["expense", "expense"],
    ["cash-operations", "other_entry"],
  ])(
    "preserves the existing %s entry deep link on initial load",
    async (entry, expectedMode) => {
      const page = await CrmCashFlowPage({
        searchParams: Promise.resolve({ entry }),
      });
      const workspace = page.props.children;

      expect(workspace.props.initialEntryMode).toBe(expectedMode);
      expect(mocks.loadWorkspace).toHaveBeenCalledOnce();
    }
  );

  it("passes read-only date/filter state to the authoritative loader", async () => {
    await CrmCashFlowPage({
      searchParams: Promise.resolve({
        date: "2026-10-17",
        search: "Ana",
        category: "booking",
        method: "cash",
        status: "posted",
        page: "2",
      }),
    });

    expect(mocks.loadWorkspace).toHaveBeenCalledWith({
      date: "2026-10-17",
      search: "Ana",
      category: "booking",
      method: "cash",
      status: "posted",
      page: 2,
    });
  });

  it("shows the existing fail-closed unavailable state when required financial data cannot load", async () => {
    mocks.loadWorkspace.mockRejectedValue(
      new CashFlowRequiredDataError("financial_accounts")
    );

    const page = await CrmCashFlowPage({
      searchParams: Promise.resolve({}),
    });

    expect(page.type).toBe("section");
    expect(page.props.role).toBe("alert");
    expect(page.props.children[0].props.children).toBe(
      "Cash Flow is unavailable"
    );
    expect(mocks.loadWorkspace).toHaveBeenCalledOnce();
  });

  it("lets unexpected failures reach the existing error boundary", async () => {
    mocks.loadWorkspace.mockRejectedValue(
      new Error("Unexpected failure")
    );

    await expect(
      CrmCashFlowPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("Unexpected failure");
  });

  it("keeps the handover identity check server-side for CRM deep links", async () => {
    mocks.loadWorkspace.mockResolvedValue(readyResult());
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: { id: "staff-1" },
        error: null,
      }),
    };
    mocks.createClient.mockResolvedValue({
      from: (table: string) => {
        expect(table).toBe("staff");
        return query;
      },
    });

    const page = await CrmCashFlowPage({
      searchParams: Promise.resolve({
        handover: "session-1",
      }),
    });
    const workspace = page.props.children;

    expect(workspace.props.handoverSessionId).toBe("session-1");
    expect(workspace.props.incomingStaffId).toBe("staff-1");
  });
});
