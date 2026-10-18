/** @vitest-environment jsdom */

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { CrmCashFlowWorkspacePayload } from "@/components/features/cash-flow/crm-cash-flow-workspace-data";
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";

const invalidate = vi.fn();
const revalidate = vi.fn();

vi.mock("@/components/features/cash-flow/use-live-crm-cash-flow-data", () => ({
  useLiveCrmCashFlowData: (fallback: CrmCashFlowWorkspacePayload) => ({
    data: fallback,
    error: undefined,
    revalidate,
    generation: {
      isRefreshing: false,
      store: { invalidate },
    },
  }),
}));

vi.mock("@/components/features/cash-flow/cash-flow-workspace", () => ({
  CashFlowWorkspace: ({
    initialData,
    onRefresh,
    onConfirmedMutation,
    syncCrmRouteState,
  }: {
    initialData: CashFlowWorkspaceData;
    onRefresh?: () => void | Promise<void>;
    onConfirmedMutation?: () => void;
    syncCrmRouteState?: boolean;
  }) => (
    <div>
      <span>Branch: {initialData.branchName}</span>
      <span>Route sync: {String(syncCrmRouteState)}</span>
      <button onClick={() => onConfirmedMutation?.()}>
        Confirm mutation
      </button>
      <button onClick={() => void onRefresh?.()}>
        Manual refresh
      </button>
    </div>
  ),
}));

import { CrmCashFlowRetainedWorkspace } from "@/components/features/cash-flow/crm-cash-flow-retained-workspace";

const data = {
  branchId: "branch-a",
  branchName: "Main Spa",
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

const payload: CrmCashFlowWorkspacePayload = {
  data,
  request: { date: "2026-10-18", page: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  revalidate.mockResolvedValue("validated");
});

afterEach(() => {
  cleanup();
});

describe("PERF-8 retained CRM Cash Flow wrapper", () => {
  it("invalidates crm-cash-flow exactly once after confirmed mutation", () => {
    render(
      <CrmCashFlowRetainedWorkspace
        initialPayload={payload}
        initialTab="today"
        initialEntryMode={null}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm mutation" })
    );

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith("crm-cash-flow");
    expect(screen.getByText("Branch: Main Spa")).toBeTruthy();
  });

  it("uses canonical revalidate for manual refresh and enables CRM route sync", async () => {
    render(
      <CrmCashFlowRetainedWorkspace
        initialPayload={payload}
        initialTab="today"
        initialEntryMode={null}
      />
    );

    expect(screen.getByText("Route sync: true")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Manual refresh" })
    );

    await waitFor(() =>
      expect(revalidate).toHaveBeenCalledTimes(1)
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
