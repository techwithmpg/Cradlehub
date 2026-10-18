/** @vitest-environment jsdom */

import type { PropsWithChildren } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import { createWorkspaceGenerationStore } from "@/components/features/dashboard/workspace-generation";
import { WorkspaceGenerationContext } from "@/components/features/dashboard/use-workspace-generation";
import { WorkspaceSWRScopeContext } from "@/components/features/dashboard/workspace-swr-cache";
import {
  WorkspaceModuleLifecycleContext,
  type WorkspaceModuleLifecycleValue,
} from "@/components/features/dashboard/use-workspace-visibility";
import { useLiveCrmCashFlowData } from "@/components/features/cash-flow/use-live-crm-cash-flow-data";
import { refreshCrmCashFlowWorkspaceAction } from "@/lib/actions/crm-cash-flow-data-actions";
import type { CrmCashFlowWorkspacePayload } from "@/components/features/cash-flow/crm-cash-flow-workspace-data";
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";

vi.mock("@/lib/actions/crm-cash-flow-data-actions", () => ({
  refreshCrmCashFlowWorkspaceAction: vi.fn(),
}));

const data = {
  branchId: "branch-a",
  branchName: "Main",
  businessDate: "2026-10-18",
  accounts: [],
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
    kpis: { inflow: 0, outflow: 0, netFlow: 0, unreconciledText: "0" },
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
} as CashFlowWorkspaceData;

const fallback: CrmCashFlowWorkspacePayload = {
  data,
  request: { date: "2026-10-18", page: 1 },
};

function lifecycle(
  overrides: Partial<WorkspaceModuleLifecycleValue>
): WorkspaceModuleLifecycleValue {
  return {
    isActive: true,
    isRetained: true,
    isDirty: false,
    isStale: true,
    isRefreshing: false,
    hasUnsavedChanges: false,
    becameActiveAt: 100,
    invalidationGeneration: 0,
    validatedGeneration: 0,
    markDirty: vi.fn(),
    markClean: vi.fn(),
    setRefreshing: vi.fn(),
    setUnsavedChanges: vi.fn(),
    ...overrides,
  };
}

function Harness() {
  useLiveCrmCashFlowData(fallback);
  return null;
}

function Providers({
  children,
  lifecycleValue,
  store,
}: PropsWithChildren<{
  lifecycleValue: WorkspaceModuleLifecycleValue;
  store: ReturnType<typeof createWorkspaceGenerationStore>;
}>) {
  const cache = new Map();
  return (
    <SWRConfig value={{ provider: () => cache }}>
      <WorkspaceSWRScopeContext.Provider value="user-1:crm:branch-a">
        <WorkspaceGenerationContext.Provider value={store}>
          <WorkspaceModuleLifecycleContext.Provider value={lifecycleValue}>
            {children}
          </WorkspaceModuleLifecycleContext.Provider>
        </WorkspaceGenerationContext.Provider>
      </WorkspaceSWRScopeContext.Provider>
    </SWRConfig>
  );
}

beforeEach(() => {
  vi.mocked(refreshCrmCashFlowWorkspaceAction).mockReset();
  vi.mocked(refreshCrmCashFlowWorkspaceAction).mockResolvedValue(fallback);
});

afterEach(() => {
  cleanup();
});

describe("PERF-8 CRM Cash Flow stale retained reactivation", () => {
  it("reconciles a clean stale Cash Flow module once for the current activation", async () => {
    const store = createWorkspaceGenerationStore();
    store.setActive("crm-cash-flow");
    const value = lifecycle({ becameActiveAt: 100 });

    const view = render(
      <Providers lifecycleValue={value} store={store}>
        <Harness />
      </Providers>
    );

    await waitFor(() =>
      expect(refreshCrmCashFlowWorkspaceAction).toHaveBeenCalledTimes(1)
    );

    view.rerender(
      <Providers
        lifecycleValue={lifecycle({
          becameActiveAt: 100,
          isRefreshing: false,
        })}
        store={store}
      >
        <Harness />
      </Providers>
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshCrmCashFlowWorkspaceAction).toHaveBeenCalledTimes(1);
  });

  it("does not fetch stale Cash Flow while hidden", async () => {
    const store = createWorkspaceGenerationStore();

    render(
      <Providers
        lifecycleValue={lifecycle({
          isActive: false,
          becameActiveAt: 100,
        })}
        store={store}
      >
        <Harness />
      </Providers>
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshCrmCashFlowWorkspaceAction).not.toHaveBeenCalled();
  });
});
