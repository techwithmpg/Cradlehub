/** @vitest-environment jsdom */

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
  useSearchParams: () =>
    new URLSearchParams(window.location.search),
}));

vi.mock("@/components/features/cash-flow/cash-flow-today-operations", () => ({
  CashFlowTodayOperations: () => <div>Today panel</div>,
}));
vi.mock("@/components/features/cash-flow/ledger-tab", () => ({
  LedgerTab: () => <div>Ledger panel</div>,
}));
vi.mock("@/components/features/cash-flow/day-close-tab", () => ({
  DayCloseTab: () => <div>Day Close panel</div>,
}));
vi.mock("@/components/features/cash-flow/history-tab", () => ({
  HistoryTab: () => <div>History panel</div>,
}));
vi.mock("@/components/features/cash-flow/open-cash-drawer-modal", () => ({
  OpenCashDrawerModal: () => null,
}));
vi.mock("@/components/features/cash-flow/handover-drawer-modal", () => ({
  HandoverDrawerModal: () => null,
}));
vi.mock("@/components/features/cash-flow/close-drawer-modal", () => ({
  CloseDrawerModal: () => null,
}));
vi.mock("@/components/features/crm/today/cradle-flow-quick-payment-modal", () => ({
  CradleFlowQuickPaymentModal: ({
    onClose,
    requestedOrderId,
    initialPaymentMethod,
  }: {
    onClose: () => void;
    requestedOrderId?: string;
    initialPaymentMethod?: string;
  }) => (
    <div>
      <span>Quick Payment Modal</span>
      {requestedOrderId && <span>Order: {requestedOrderId}</span>}
      {initialPaymentMethod && <span>Method: {initialPaymentMethod}</span>}
      <button onClick={onClose}>Close quick payment</button>
    </div>
  ),
}));
vi.mock("@/components/features/cash-flow/record-financial-entry-modal", () => ({
  RecordFinancialEntryModal: ({
    open,
    onOpenChange,
    initialMode,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialMode?: string | null;
  }) =>
    open ? (
      <div>
        <span>Entry mode: {initialMode}</span>
        <button onClick={() => onOpenChange(false)}>
          Close entry
        </button>
      </div>
    ) : null,
}));

import { CashFlowWorkspace } from "@/components/features/cash-flow/cash-flow-workspace";

const data = {
  branchId: "branch-a",
  branchName: "Main Spa",
  businessDate: "2026-10-18",
  accounts: [],
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

beforeEach(() => {
  window.history.replaceState(
    null,
    "",
    "/crm/cash-flow?tab=history&entry=expense"
  );
});

afterEach(() => {
  cleanup();
});

describe("PERF-8 retained CRM Cash Flow route state", () => {
  it("applies retained tab and entry deep links without restoring transactional entry state", async () => {
    render(
      <CashFlowWorkspace
        initialData={data}
        initialTab="today"
        initialEntryMode="expense"
        syncCrmRouteState
      />
    );

    expect(screen.getByText("History panel")).toBeTruthy();
    expect(screen.getByText("Entry mode: expense")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Close entry" })
    );

    await waitFor(() =>
      expect(window.location.search).toBe("?tab=history")
    );
    expect(screen.queryByText("Entry mode: expense")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Today" })
    );

    await waitFor(() =>
      expect(window.location.search).toBe("?tab=today")
    );
    expect(screen.getByText("Today panel")).toBeTruthy();
  });

  it("renders CradleFlowQuickPaymentModal when entry=payment deep link is supplied", async () => {
    window.history.replaceState(
      null,
      "",
      "/crm/cash-flow?tab=today&entry=payment"
    );

    render(
      <CashFlowWorkspace
        initialData={data}
        initialTab="today"
        initialEntryMode="customer_payment"
        syncCrmRouteState
      />
    );

    expect(screen.getByText("Quick Payment Modal")).toBeTruthy();
    expect(screen.queryByText(/Entry mode:/)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Close quick payment" })
    );

    await waitFor(() =>
      expect(window.location.search).toBe("?tab=today")
    );
    expect(screen.queryByText("Quick Payment Modal")).toBeNull();
  });
});
