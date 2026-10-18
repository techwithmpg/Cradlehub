/** @vitest-environment jsdom */

import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import { useLiveCrmCashFlowData } from "@/components/features/cash-flow/use-live-crm-cash-flow-data";
import { refreshCrmCashFlowWorkspaceAction } from "@/lib/actions/crm-cash-flow-data-actions";
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";
import type { CrmCashFlowWorkspacePayload } from "@/components/features/cash-flow/crm-cash-flow-workspace-data";

vi.mock("@/lib/actions/crm-cash-flow-data-actions", () => ({
  refreshCrmCashFlowWorkspaceAction: vi.fn(),
}));

function data(label: string): CashFlowWorkspaceData {
  return {
    branchId: "branch-a",
    branchName: label,
    businessDate: "2026-10-18",
    accounts: [],
    expenseCategories: [],
    staffOptions: [],
    cashSessions: { activeSessions: [], availableDrawers: [] },
    today: {
      kpis: {
        recordedPayments: 0,
        outstandingBalance: 0,
        paidBookingsCount: 0,
        needsPaymentCount: 0,
      },
      paymentMix: [],
      totalInflow: 0,
      coverage: [],
      recentPayments: [],
    },
    ledger: {
      kpis: {
        inflow: 0,
        outflow: 0,
        netFlow: 0,
        unreconciledText: "0",
      },
      records: [],
      totalRecords: 0,
      page: 1,
      pageSize: 12,
      totalPages: 1,
    },
    dayClose: {
      businessDate: "2026-10-18",
      isBalanced: true,
      readyForReview: false,
      lastUpdatedText: "",
      reconciliationStatus: "not_started",
      expectedCash: null,
      actualCash: null,
      cashVariance: null,
      channelVariance: null,
      recordedInflow: 0,
      recordedOutflow: 0,
      netPosition: 0,
      openIssuesCount: 0,
      paymentBreakdown: [],
      coverageCategories: [],
      timeline: [],
      isFinalizationSupported: false,
    },
    history: {
      closedDaysThisMonth: 0,
      totalInflowThisMonth: 0,
      totalOutflowThisMonth: 0,
      reviewExceptions: 0,
      records: [],
      selectedClose: null,
      auditTrail: [],
    },
    payableOrders: [],
  };
}

function payload(label: string): CrmCashFlowWorkspacePayload {
  return {
    data: data(label),
    request: { date: "2026-10-18", page: 1 },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function wrapperFor(
  store: ReturnType<typeof createWorkspaceGenerationStore>
) {
  const cache = new Map();
  const Wrapper = ({ children }: PropsWithChildren) => (
    <SWRConfig value={{ provider: () => cache }}>
      <WorkspaceSWRScopeContext.Provider value="user-1:crm:branch-a">
        <WorkspaceGenerationContext.Provider value={store}>
          {children}
        </WorkspaceGenerationContext.Provider>
      </WorkspaceSWRScopeContext.Provider>
    </SWRConfig>
  );
  Wrapper.displayName = "CrmCashFlowGenerationTestWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.mocked(refreshCrmCashFlowWorkspaceAction).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PERF-8 generation-aware CRM Cash Flow reads", () => {
  it("renders the server fallback with zero duplicate initial fetch", () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-cash-flow");

    const { result } = renderHook(
      () => useLiveCrmCashFlowData(payload("Initial")),
      { wrapper: wrapperFor(store) }
    );

    expect(result.current.data?.data.branchName).toBe("Initial");
    expect(refreshCrmCashFlowWorkspaceAction).not.toHaveBeenCalled();
  });

  it("performs zero canonical reads while hidden, including focus and reconnect", () => {
    const store = createWorkspaceGenerationStore();

    renderHook(
      () => useLiveCrmCashFlowData(payload("Retained")),
      { wrapper: wrapperFor(store) }
    );

    act(() => {
      store.invalidate("crm-cash-flow");
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });

    expect(refreshCrmCashFlowWorkspaceAction).not.toHaveBeenCalled();
    expect(store.getSnapshot("crm-cash-flow").isDirty).toBe(true);
  });

  it("reconciles exactly once when dirty retained Cash Flow becomes active", async () => {
    const store = createWorkspaceGenerationStore();
    vi.mocked(refreshCrmCashFlowWorkspaceAction).mockResolvedValue(
      payload("Fresh")
    );

    const { result } = renderHook(
      () => useLiveCrmCashFlowData(payload("Retained")),
      { wrapper: wrapperFor(store) }
    );

    act(() => {
      store.invalidate("crm-cash-flow");
      store.setActive("crm-cash-flow");
    });

    await waitFor(() =>
      expect(refreshCrmCashFlowWorkspaceAction).toHaveBeenCalledTimes(1)
    );
    await waitFor(() =>
      expect(result.current.data?.data.branchName).toBe("Fresh")
    );
    expect(store.getSnapshot("crm-cash-flow").isDirty).toBe(false);
  });

  it("rejects a stale financial response after a newer invalidation", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-cash-flow");
    const first = deferred<CrmCashFlowWorkspacePayload>();
    const second = deferred<CrmCashFlowWorkspacePayload>();

    vi.mocked(refreshCrmCashFlowWorkspaceAction)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(
      () => useLiveCrmCashFlowData(payload("Retained")),
      { wrapper: wrapperFor(store) }
    );

    act(() => store.invalidate("crm-cash-flow"));

    await waitFor(() =>
      expect(refreshCrmCashFlowWorkspaceAction).toHaveBeenCalledTimes(1)
    );

    act(() => store.invalidate("crm-cash-flow"));
    first.resolve(payload("STALE"));

    await waitFor(() =>
      expect(refreshCrmCashFlowWorkspaceAction).toHaveBeenCalledTimes(2)
    );
    expect(result.current.data?.data.branchName).toBe("Retained");

    second.resolve(payload("Fresh"));

    await waitFor(() =>
      expect(result.current.data?.data.branchName).toBe("Fresh")
    );
    expect(store.getSnapshot("crm-cash-flow").isDirty).toBe(false);
  });
});
