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
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";

const routerRefresh = vi.fn();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefresh,
    push: routerPush,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/features/cash-flow/today-tab", () => ({
  TodayTab: () => <div>Today content</div>,
}));
vi.mock("@/components/features/cash-flow/ledger-tab", () => ({
  LedgerTab: () => <div>Ledger content</div>,
}));
vi.mock("@/components/features/cash-flow/day-close-tab", () => ({
  DayCloseTab: () => <div>Day close content</div>,
}));
vi.mock("@/components/features/cash-flow/history-tab", () => ({
  HistoryTab: () => <div>History content</div>,
}));

vi.mock("@/components/features/cash-flow/open-cash-drawer-modal", () => ({
  OpenCashDrawerModal: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: () => void;
  }) =>
    open ? (
      <button onClick={onSuccess}>Confirm drawer open</button>
    ) : null,
}));

vi.mock("@/components/features/cash-flow/handover-drawer-modal", () => ({
  HandoverDrawerModal: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: (handoverId?: string) => void;
  }) =>
    open ? (
      <button onClick={() => onSuccess("handover-1")}>
        Confirm handover
      </button>
    ) : null,
}));

vi.mock("@/components/features/cash-flow/close-drawer-modal", () => ({
  CloseDrawerModal: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: () => void;
  }) =>
    open ? (
      <button onClick={onSuccess}>Confirm drawer close</button>
    ) : null,
}));

vi.mock("@/components/features/cash-flow/record-financial-entry-modal", () => ({
  RecordFinancialEntryModal: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess?: () => void;
  }) =>
    open ? (
      <button onClick={() => onSuccess?.()}>
        Confirm financial entry
      </button>
    ) : null,
}));

import { CashFlowWorkspace } from "@/components/features/cash-flow/cash-flow-workspace";

function workspaceData(
  expectedCash: number,
  active: boolean
): CashFlowWorkspaceData {
  const drawer = {
    id: "drawer-1",
    name: "Front Desk Drawer",
    accountType: "cash_drawer" as const,
    identifierMask: "Drawer 1",
    branchId: "branch-a",
  };

  return {
    branchId: "branch-a",
    branchName: "Main Spa",
    businessDate: "2026-10-18",
    accounts: [drawer],
    expenseCategories: [],
    staffOptions: [
      { id: "staff-1", name: "CSR One", role: "crm" },
      { id: "staff-2", name: "CSR Two", role: "crm" },
    ],
    cashSessions: {
      availableDrawers: [drawer],
      activeSessions: active
        ? [
            {
              id: "session-1",
              branchId: "branch-a",
              businessDate: "2026-10-18",
              cashDrawerAccountId: "drawer-1",
              cashDrawerName: "Front Desk Drawer",
              status: "open",
              openingFloat: 100,
              openedBy: "staff-1",
              openedByName: "CSR One",
              openedAt: "2026-10-18T08:00:00.000Z",
              currentCustodianId: "staff-1",
              currentCustodianName: "CSR One",
              expectedCash,
            },
          ]
        : [],
    },
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
      expectedCash,
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("PERF-8 Cash Flow confirmed mutation reconciliation", () => {
  it("uses the CRM reconciliation callback once after drawer open", () => {
    const onConfirmedMutation = vi.fn();
    render(
      <CashFlowWorkspace
        initialData={workspaceData(100, false)}
        onConfirmedMutation={onConfirmedMutation}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open Cash Drawer" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm drawer open" })
    );

    expect(onConfirmedMutation).toHaveBeenCalledTimes(1);
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it.each([
    ["handover", "Hand Over", "Confirm handover"],
    ["drawer close", "Day Close", "Confirm drawer close"],
    ["financial entry", "Record Payment", "Confirm financial entry"],
  ])(
    "uses the CRM reconciliation callback once after confirmed %s",
    (_label, openButton, confirmButton) => {
      const onConfirmedMutation = vi.fn();
      render(
        <CashFlowWorkspace
          initialData={workspaceData(100, true)}
          onConfirmedMutation={onConfirmedMutation}
        />
      );

      fireEvent.click(
        screen.getAllByRole("button", { name: openButton })[0]!
      );
      fireEvent.click(
        screen.getByRole("button", { name: confirmButton })
      );

      expect(onConfirmedMutation).toHaveBeenCalledTimes(1);
      expect(routerRefresh).not.toHaveBeenCalled();
    }
  );

  it("uses canonical revalidation for manual CRM refresh", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <CashFlowWorkspace
        initialData={workspaceData(100, true)}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("does not optimistically alter expected cash after mutation success", () => {
    const onConfirmedMutation = vi.fn();
    const view = render(
      <CashFlowWorkspace
        initialData={workspaceData(100, true)}
        onConfirmedMutation={onConfirmedMutation}
      />
    );

    expect(screen.getAllByText("₱100.00").length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Record Payment" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm financial entry" })
    );

    expect(onConfirmedMutation).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("₱100.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("₱150.00")).toBeNull();

    view.rerender(
      <CashFlowWorkspace
        initialData={workspaceData(150, true)}
        onConfirmedMutation={onConfirmedMutation}
      />
    );

    expect(screen.getAllByText("₱150.00").length).toBeGreaterThan(0);
  });

  it("preserves the existing router.refresh fallback for non-retained consumers", () => {
    render(
      <CashFlowWorkspace initialData={workspaceData(100, false)} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open Cash Drawer" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm drawer open" })
    );

    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });
});
