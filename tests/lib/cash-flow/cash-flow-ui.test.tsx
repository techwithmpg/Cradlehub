// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// Mock Next.js navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("server-only", () => ({}));

// Mock server actions for financial entries
const mockRecordOrderPaymentAction = vi.fn();
const mockRecordLegacyBookingPaymentAction = vi.fn();
const mockRecordExpenseAction = vi.fn();
const mockRecordTipAction = vi.fn();
const mockRecordOtherEntryAction = vi.fn();
vi.mock("@/lib/cash-flow/cash-flow-actions", () => ({
  recordOrderPaymentAction: (...args: unknown[]) => mockRecordOrderPaymentAction(...args),
  recordLegacyBookingPaymentAction: (...args: unknown[]) => mockRecordLegacyBookingPaymentAction(...args),
  recordExpenseAction: (...args: unknown[]) => mockRecordExpenseAction(...args),
  recordTipAction: (...args: unknown[]) => mockRecordTipAction(...args),
  recordOtherEntryAction: (...args: unknown[]) => mockRecordOtherEntryAction(...args),
}));

import { CashFlowWorkspace } from "@/components/features/cash-flow/cash-flow-workspace";
import { TodayTab } from "@/components/features/cash-flow/today-tab";
import { LedgerTab } from "@/components/features/cash-flow/ledger-tab";
import { DayCloseTab } from "@/components/features/cash-flow/day-close-tab";
import { HistoryTab } from "@/components/features/cash-flow/history-tab";
import { RecordFinancialEntryModal } from "@/components/features/cash-flow/record-financial-entry-modal";
import { RecordPaymentSheet } from "@/components/features/cash-flow/record-payment-sheet";
import type { CashFlowWorkspaceData } from "@/lib/cash-flow/cash-flow-types";

const mockWorkspaceData: CashFlowWorkspaceData = {
  branchId: "11111111-1111-1111-1111-111111111111",
  branchName: "Main Spa Branch",
  businessDate: "2026-09-28",
  accounts: [
    {
      id: "acc-cash-1",
      name: "Main Cash Drawer",
      accountType: "cash_drawer",
      identifierMask: "Drawer #1",
      branchId: "11111111-1111-1111-1111-111111111111",
    },
    {
      id: "acc-gcash-1",
      name: "Front Desk GCash",
      accountType: "gcash",
      identifierMask: "0917-***-1234",
      branchId: "11111111-1111-1111-1111-111111111111",
    },
  ],
  expenseCategories: [
    {
      id: "cat-supplies",
      code: "supplies",
      name: "Supplies & Consumables",
      description: "Spa oils, lotions, linens",
    },
    {
      id: "cat-utilities",
      code: "utilities",
      name: "Utilities",
      description: "Electricity, water, internet",
    },
  ],
  staffOptions: [
    { id: "staff-1", name: "Maria Santos", role: "therapist" },
    { id: "staff-2", name: "Elena Cruz", role: "therapist" },
  ],
  today: {
    kpis: {
      recordedPayments: 5000,
      outstandingBalance: 1500,
      paidBookingsCount: 4,
      needsPaymentCount: 2,
    },
    paymentMix: [
      { method: "cash", label: "Cash", amount: 3000, percentage: 60, transactionCount: 3 },
      { method: "gcash", label: "GCash", amount: 2000, percentage: 40, transactionCount: 2 },
    ],
    totalInflow: 5000,
    coverage: [
      {
        id: "bookings",
        label: "Bookings",
        amount: 3500,
        countLabel: "3 paid",
        isAvailable: true,
        iconType: "calendar",
      },
      {
        id: "home_service",
        label: "Home Service",
        amount: 1500,
        countLabel: "1 paid",
        isAvailable: true,
        iconType: "home",
      },
      {
        id: "expenses",
        label: "Expenses",
        amount: 0,
        countLabel: "Not yet configured",
        isAvailable: false,
        iconType: "shopping_cart",
      },
    ],
    recentPayments: [
      {
        id: "tx-1",
        time: "2:30 PM",
        type: "Booking",
        customerName: "Sarah Jenkins",
        reference: "#BK-20260928-001",
        serviceDescription: "Signature Massage",
        paymentMethodDisplay: "Cash + GCash",
        amount: 2500,
        status: "paid",
      },
    ],
  },
  ledger: {
    kpis: {
      inflow: 5000,
      outflow: 0,
      netFlow: 5000,
      unreconciledText: "Reconciliation not configured",
    },
    records: [
      {
        id: "mov-1",
        dateTime: "2026-09-28 2:30 PM",
        reference: "BK-20260928-001",
        customerSource: "Sarah Jenkins",
        category: "Booking Payment",
        method: "Cash",
        inflow: 1500,
        outflow: null,
        netEffect: 1500,
        status: "Paid",
      },
      {
        id: "mov-2",
        dateTime: "2026-09-28 2:30 PM",
        reference: "BK-20260928-001",
        customerSource: "Sarah Jenkins",
        category: "Booking Payment",
        method: "GCash",
        inflow: 1000,
        outflow: null,
        netEffect: 1000,
        status: "Paid",
      },
    ],
    totalRecords: 2,
    page: 1,
    pageSize: 12,
    totalPages: 1,
  },
  dayClose: {
    businessDate: "2026-09-28",
    isBalanced: true,
    readyForReview: true,
    lastUpdatedText: "today at 10:28 PM",
    recordedInflow: 5000,
    recordedOutflow: 0,
    netPosition: 5000,
    openIssuesCount: 0,
    paymentBreakdown: [
      { method: "cash", label: "Cash", amount: 3000, percentage: 60, transactionCount: 3 },
      { method: "gcash", label: "GCash", amount: 2000, percentage: 40, transactionCount: 2 },
    ],
    coverageCategories: [
      {
        id: "bookings",
        label: "Bookings",
        amount: 3500,
        countLabel: "3 paid",
        isAvailable: true,
        iconType: "calendar",
      },
    ],
    timeline: [
      {
        id: "t-1",
        time: "2:30 PM",
        title: "Booking payment received",
        amount: 2500,
        paymentMethod: "Cash + GCash",
      },
    ],
    isFinalizationSupported: false,
  },
  history: {
    closedDaysThisMonth: 0,
    totalInflowThisMonth: 5000,
    totalOutflowThisMonth: 0,
    reviewExceptions: 0,
    records: [],
    selectedClose: null,
    auditTrail: [],
  },
  payableOrders: [
    {
      id: "ord-1",
      sourceKind: "booking_order",
      orderNumber: "BK-20260928-002",
      customerName: "Michael Tan",
      customerPhone: "0917 123 4567",
      serviceDescription: "Deep Tissue Massage",
      totalAmount: 1800,
      amountPaid: 0,
      remainingBalance: 1800,
      bookingDate: "2026-09-28",
      serviceTime: "2:00 PM – 4:00 PM",
      branchName: "Main Spa",
      visitType: "in_spa",
      bookingStatus: "Confirmed",
      paymentStatus: "unpaid",
      payableItems: [
        {
          id: "item-1",
          description: "Deep Tissue Massage",
          amount: 1800,
          itemType: "service",
          subDescription: "60 mins",
        },
      ],
    },
    {
      id: "ord-2",
      sourceKind: "booking_order",
      orderNumber: "BK-20260928-003",
      customerName: "Maria Santos",
      customerPhone: "0918 987 6543",
      serviceDescription: "Signature Home Service Massage",
      totalAmount: 3800,
      amountPaid: 2000,
      remainingBalance: 1800,
      bookingDate: "2026-09-28",
      serviceTime: "3:00 PM – 5:00 PM",
      branchName: "Main Spa",
      visitType: "home_service",
      bookingStatus: "Completed",
      paymentStatus: "partially_paid",
      payableItems: [
        {
          id: "item-hs-svc",
          description: "Signature Home Service Massage",
          amount: 3500,
          itemType: "service",
          subDescription: "2 hrs • 1 therapist",
        },
        {
          id: "item-hs-fee",
          description: "Home Service Gas Fee / Travel Fee",
          amount: 300,
          itemType: "home_service_fee",
          subDescription: "Travel fee for home service location",
        },
      ],
      previousPayments: [{ date: "2026-09-27", amount: 2000, method: "GCash" }],
    },
    {
      id: "ord-3",
      sourceKind: "booking_order",
      orderNumber: "BK-20260928-004",
      customerName: "Anna Reyes",
      customerPhone: "0919 555 4321",
      serviceDescription: "Swedish Massage",
      totalAmount: 1200,
      amountPaid: 1200,
      remainingBalance: 0,
      bookingDate: "2026-09-28",
      branchName: "Main Spa",
      visitType: "in_spa",
      bookingStatus: "Completed",
      paymentStatus: "paid",
    },
  ],
};

describe("CF5 Cash Flow UI Foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== "undefined" && !window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => "blob:mock-receipt-preview");
    }
  });

  afterEach(() => {
    cleanup();
  });

  it("1. Cash Flow Workspace renders header and title correctly", () => {
    render(<CashFlowWorkspace initialData={mockWorkspaceData} />);
    expect(screen.getByRole("heading", { level: 1, name: /Cash Flow/i })).toBeTruthy();
    expect(screen.getByText(/Main Spa Branch · 2026-09-28/i)).toBeTruthy();
    expect(screen.getByText(/Financial activity and daily reconciliation/i)).toBeTruthy();
  });

  it("2. Today tab renders 4 KPI cards and payment mix with actual data", () => {
    render(
      <TodayTab
        kpis={mockWorkspaceData.today.kpis}
        paymentMix={mockWorkspaceData.today.paymentMix}
        totalInflow={mockWorkspaceData.today.totalInflow}
        coverage={mockWorkspaceData.today.coverage}
        recentPayments={mockWorkspaceData.today.recentPayments}
        onNavigateToLedger={vi.fn()}
        onRecordPaymentClick={vi.fn()}
      />
    );

    // KPI card labels — exact match to avoid regex collisions with description text
    expect(screen.getAllByText("RECEIPTS").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₱5,000.00/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("EXPENSES").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NET FLOW").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NEEDS ATTENTION").length).toBeGreaterThan(0);

    // Payment mix table heading (authorized CF8 design)
    expect(screen.getByText("Money received")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
  });

  it("3. Today tab displays split-tender payment accurately without flattening", () => {
    render(
      <TodayTab
        kpis={mockWorkspaceData.today.kpis}
        paymentMix={mockWorkspaceData.today.paymentMix}
        totalInflow={mockWorkspaceData.today.totalInflow}
        coverage={mockWorkspaceData.today.coverage}
        recentPayments={mockWorkspaceData.today.recentPayments}
        onNavigateToLedger={vi.fn()}
        onRecordPaymentClick={vi.fn()}
      />
    );

    // Split tender badge should show combined methods
    expect(screen.getByText("Cash + GCash")).toBeTruthy();
    expect(screen.getByText("Sarah Jenkins")).toBeTruthy();
  });

  it("4. Cash flow coverage: expense data is used for KPI math, not yet rendered as cards", () => {
    render(
      <TodayTab
        kpis={mockWorkspaceData.today.kpis}
        paymentMix={mockWorkspaceData.today.paymentMix}
        totalInflow={mockWorkspaceData.today.totalInflow}
        coverage={mockWorkspaceData.today.coverage}
        recentPayments={mockWorkspaceData.today.recentPayments}
        onNavigateToLedger={vi.fn()}
        onRecordPaymentClick={vi.fn()}
      />
    );

    // The authorized Today tab uses coverage data for KPI computation (NET FLOW),
    // not to render individual coverage category cards.
    // The attention panel and quick-actions replace the old coverage grid.
    expect(screen.getByText(/NET FLOW/i)).toBeTruthy();
    expect(screen.getByText("Needs your attention")).toBeTruthy();
  });

  it("5. Ledger tab renders KPI cards and ledger table with Inflow and Net Effect", () => {
    render(
      <LedgerTab
        kpis={mockWorkspaceData.ledger.kpis}
        records={mockWorkspaceData.ledger.records}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    expect(screen.getAllByText("INFLOW").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OUTFLOW").length).toBeGreaterThan(0);
    expect(screen.getByText("NET FLOW")).toBeTruthy();
    expect(screen.getByText("UNRECONCILED")).toBeTruthy();
    expect(screen.getByText("Reconciliation not configured")).toBeTruthy();

    // Table rows
    expect(screen.getAllByText("BK-20260928-001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sarah Jenkins").length).toBeGreaterThan(0);
  });

  it("6. Ledger tab search filter filters rows dynamically", () => {
    render(
      <LedgerTab
        kpis={mockWorkspaceData.ledger.kpis}
        records={mockWorkspaceData.ledger.records}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Customer, reference, description/i);
    fireEvent.change(searchInput, { target: { value: "Nonexistent Customer" } });

    expect(screen.getByText("No matching ledger records")).toBeTruthy();
  });

  it("7. Day Close tab renders auto-generated day summary banner and balanced status", () => {
    render(<DayCloseTab summary={mockWorkspaceData.dayClose} onNavigateToLedger={vi.fn()} />);

    expect(screen.getByText(/Auto-generated Day Summary · 2026-09-28/i)).toBeTruthy();
    expect(screen.getByText(/Ready for review/i)).toBeTruthy();
    expect(screen.getByText(/Records are balanced/i)).toBeTruthy();

    // Mark as reviewed is disabled/preview
    const reviewButton = screen.getByRole("button", { name: /Mark as reviewed/i });
    expect(reviewButton.hasAttribute("disabled")).toBe(true);
  });

  it("8. History tab renders designed empty state when no historical day closes exist", () => {
    render(
      <HistoryTab
        history={mockWorkspaceData.history}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    expect(screen.getByText("CLOSED DAYS THIS MONTH")).toBeTruthy();
    expect(screen.getByText("No historical day close records")).toBeTruthy();
    expect(screen.getByText("No day close selected")).toBeTruthy();
    expect(screen.queryByText("Day close reviewed")).toBeNull();
    expect(screen.getByText("No day-close audit activity yet.")).toBeTruthy();
  });

  it("9. Cash Flow opens on Today by default", () => {
    render(<CashFlowWorkspace initialData={mockWorkspaceData} />);
    // Today tab: payment mix table uses "Money received" heading in the authorized CF8 design
    expect(screen.getByText("Money received")).toBeTruthy();
    // Ledger-only text should not be visible when on Today tab
    expect(screen.queryByText("UNRECONCILED")).toBeNull();
  });

  it("9a. A valid initial Ledger tab renders from the loaded workspace data", () => {
    render(<CashFlowWorkspace initialData={mockWorkspaceData} initialTab="ledger" />);
    expect(screen.getByText("NET FLOW")).toBeTruthy();
    expect(screen.queryByText("Payment mix")).toBeNull();
  });

  it("9aa. A Cradle Flow expense link opens the existing financial entry modal in Expense mode", () => {
    render(<CashFlowWorkspace initialData={mockWorkspaceData} initialEntryMode="expense" />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByPlaceholderText(/Shell Gas Station, Clean Linen Services/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Record Expense/i })).toBeTruthy();
  });

  it("9b. Tab clicks show all loaded views without router navigation or refresh", () => {
    render(<CashFlowWorkspace initialData={mockWorkspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "Ledger" }));
    expect(screen.getByText("NET FLOW")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Day Close" }));
    expect(screen.getByText(/Auto-generated Day Summary · 2026-09-28/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("No historical day close records")).toBeTruthy();

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("9c. A successful payment still refreshes financial data", async () => {
    mockRecordOrderPaymentAction.mockResolvedValueOnce({
      ok: true,
      data: { success: true, transactionId: "tx-new-123", orderId: "ord-1" },
    });
    render(<CashFlowWorkspace initialData={mockWorkspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    fireEvent.click(screen.getByText("BK-20260928-002 — Michael Tan"));
    fireEvent.click(screen.getByRole("button", { name: /Record Entry/i }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("9d. A successful expense still refreshes financial data", async () => {
    mockRecordExpenseAction.mockResolvedValueOnce({ ok: true, transactionId: "tx-exp-123" });
    render(<CashFlowWorkspace initialData={mockWorkspaceData} />);

    fireEvent.click(screen.getByRole("button", { name: "Record Expense" }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "450" } });
    fireEvent.change(screen.getByPlaceholderText(/Shell Gas Station, Clean Linen Services/i), {
      target: { value: "Ace Hardware" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Fuel for home service van/i), {
      target: { value: "Supplies" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Record Expense" }).at(-1)!);

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("10. Record Financial Entry modal renders centered with 4 modes and Customer Payment active", () => {
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    // Modal title & subtitle and backwards compatibility alias
    expect(RecordPaymentSheet).toBe(RecordFinancialEntryModal);
    expect(screen.getByRole("heading", { name: "Record Financial Entry" })).toBeTruthy();
    expect(
      screen.getByText(/Record customer payments, expenses, tips, and other cash-flow entries/i)
    ).toBeTruthy();

    // 4 Mode cards
    expect(screen.getByText("Customer Payment")).toBeTruthy();
    expect(screen.getByText("Expense")).toBeTruthy();
    expect(screen.getByText("Tip")).toBeTruthy();
    expect(screen.getByText("Other Entry")).toBeTruthy();

    // Initial order data
    expect(screen.getAllByText(/Michael Tan/i).length).toBeGreaterThan(0);
    expect(screen.getByText("BK-20260928-002 — Michael Tan")).toBeTruthy();

    // Add another payment method button
    const addMethodButton = screen.getByRole("button", { name: /Add Another Payment Method/i });
    fireEvent.click(addMethodButton);

    // Should now have 2 tender lines
    expect(screen.getByText("Tender #1")).toBeTruthy();
    expect(screen.getByText("Tender #2")).toBeTruthy();

    // Switch to Expense mode
    const expenseButton = screen.getByRole("button", { name: /Expense/i });
    fireEvent.click(expenseButton);

    expect(screen.getByText(/1\. Expense Classification & Payment Account/i)).toBeTruthy();

    // Return to Customer Payment
    const paymentButton = screen.getByRole("button", { name: /Customer Payment/i });
    fireEvent.click(paymentButton);
    expect(screen.getByText("1. Select Booking / Order")).toBeTruthy();
  });

  it("11. Record Entry calls server action using CF4 atomic writer", async () => {
    mockRecordOrderPaymentAction.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transactionId: "tx-new-123",
        orderId: "ord-1",
      },
    });

    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    const submitButton = screen.getByRole("button", { name: /Record Entry/i });
    fireEvent.click(screen.getByText("BK-20260928-002 — Michael Tan"));
    fireEvent.click(submitButton);

    expect(mockRecordOrderPaymentAction).toHaveBeenCalled();
    const callArg = mockRecordOrderPaymentAction.mock.calls[0]![0];
    expect(callArg.orderId).toBe("ord-1");
    expect(callArg.payments).toHaveLength(1);
    expect(callArg.payments[0].paymentMethod).toBe("cash");
  });

  it("12. Fully-paid booking is protected and disables payment submission", () => {
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        initialOrderId="ord-3"
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    expect(screen.getAllByText(/Anna Reyes/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/This booking is already fully paid. No further payment required./i)
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Record Entry/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("13. Home Service booking separates service charge from travel fee", () => {
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        initialOrderId="ord-2"
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    expect(screen.getAllByText(/Maria Santos/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Signature Home Service Massage")).toBeTruthy();
    expect(screen.getByText(/Home Service Gas Fee \/ Travel Fee/i)).toBeTruthy();
    expect(screen.getByText(/Travel fee for home service location/i)).toBeTruthy();
    expect(screen.getByText(/Less: Previous Payments/i)).toBeTruthy();
    expect(screen.getAllByText("₱1,800.00").length).toBeGreaterThan(0);
  });

  it("14. Pay full balance populates tender amount with outstanding balance", () => {
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        initialOrderId="ord-2"
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    const payFullButton = screen.getByRole("button", { name: /Pay full balance/i });
    fireEvent.click(payFullButton);

    const amountInputs = screen.getAllByRole("spinbutton");
    expect((amountInputs[0] as HTMLInputElement).value).toBe("1800");
  });

  it("15. Runtime data is completely free of hardcoded mock amounts", () => {
    // Zero-data case: ensuring zero data produces clean ₱0.00 and 0 bookings, NOT ₱14,750 or 11 bookings
    const emptyWorkspaceData: CashFlowWorkspaceData = {
      ...mockWorkspaceData,
      today: {
        ...mockWorkspaceData.today,
        kpis: {
          recordedPayments: 0,
          outstandingBalance: 0,
          paidBookingsCount: 0,
          needsPaymentCount: 0,
        },
        paymentMix: [],
        totalInflow: 0,
        recentPayments: [],
      },
    };

    render(
      <TodayTab
        kpis={emptyWorkspaceData.today.kpis}
        paymentMix={emptyWorkspaceData.today.paymentMix}
        totalInflow={emptyWorkspaceData.today.totalInflow}
        coverage={emptyWorkspaceData.today.coverage}
        recentPayments={emptyWorkspaceData.today.recentPayments}
        onNavigateToLedger={vi.fn()}
        onRecordPaymentClick={vi.fn()}
      />
    );

    // Should display ₱0.00 and 0, never hardcoded screenshot numbers
    expect(screen.getAllByText("₱0.00").length).toBeGreaterThan(0);
    expect(screen.queryByText("₱14,750.00")).toBeNull();
    expect(screen.queryByText("₱4,850.00")).toBeNull();
    expect(screen.getByText("No financial activity recorded today")).toBeTruthy();
  });

  it("16. Record Financial Entry Modal supports switching to Expense, Tip, and Other Entry modes", () => {
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        businessDate={mockWorkspaceData.businessDate}
        expenseCategories={mockWorkspaceData.expenseCategories}
        staffOptions={mockWorkspaceData.staffOptions}
      />
    );

    // Initial mode is Customer Payment
    expect(screen.getByText("1. Select Booking / Order")).toBeTruthy();

    // Switch to Operational Expense
    const expenseTab = screen.getByRole("button", { name: /Expense/i });
    fireEvent.click(expenseTab);
    expect(screen.getByText(/1\. Expense Classification & Payment Account/i)).toBeTruthy();
    expect(screen.getAllByText("Supplies & Consumables").length).toBeGreaterThan(0);

    // Switch to Staff Tip
    const tipTab = screen.getByRole("button", { name: /Tip/i });
    fireEvent.click(tipTab);
    expect(screen.getByText(/1\. Tip Custody Model/i)).toBeTruthy();
    expect(screen.getByText("Maria Santos (therapist)")).toBeTruthy();

    // Switch to Other Entry
    const otherTab = screen.getByRole("button", { name: /Other Entry/i });
    fireEvent.click(otherTab);
    expect(screen.getByText(/1\. Select Entry Type/i)).toBeTruthy();
    expect(screen.getAllByText("Misc Income").length).toBeGreaterThan(0);
  });

  it("17. Operational Expense form validates required fields and calls recordExpenseAction", async () => {
    mockRecordExpenseAction.mockResolvedValueOnce({
      ok: true,
      transactionId: "tx-exp-123",
    });

    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        businessDate={mockWorkspaceData.businessDate}
        expenseCategories={mockWorkspaceData.expenseCategories}
        staffOptions={mockWorkspaceData.staffOptions}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Expense/i }));

    // Fill expense description and amount
    const descInput = screen.getByPlaceholderText(/Fuel for home service van/i);
    fireEvent.change(descInput, { target: { value: "Massage oils and candles" } });

    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "450" } });

    // Submit expense
    const submitBtn = screen.getByRole("button", { name: /Record Expense/i });
    fireEvent.click(submitBtn);

    expect(mockRecordExpenseAction).toHaveBeenCalled();
    const payload = mockRecordExpenseAction.mock.calls[0]![0];
    expect(payload.amount).toBe(450);
    expect(payload.description).toBe("Massage oils and candles");
    expect(payload.categoryId).toBe("cat-supplies");
    expect(payload.financialAccountId).toBe("acc-cash-1");
  });

  it("18. Staff Tip form dispatches direct cash vs company-custodied tips via recordTipAction", async () => {
    mockRecordTipAction.mockResolvedValueOnce({
      ok: true,
      transactionId: "tx-tip-123",
    });

    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        businessDate={mockWorkspaceData.businessDate}
        expenseCategories={mockWorkspaceData.expenseCategories}
        staffOptions={mockWorkspaceData.staffOptions}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Tip/i }));

    const tipAmountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(tipAmountInput, { target: { value: "200" } });

    const submitBtn = screen.getByRole("button", { name: /Record Tip/i });
    fireEvent.click(submitBtn);

    expect(mockRecordTipAction).toHaveBeenCalled();
    const payload = mockRecordTipAction.mock.calls[0]![0];
    expect(payload.amount).toBe(200);
    expect(payload.beneficiaryStaffId).toBe("staff-1");
    expect(payload.custodyType).toBe("direct_cash");
  });

  it("19. Other Entry form dispatches misc income and blocks locked generic adjustments", async () => {
    mockRecordOtherEntryAction.mockResolvedValueOnce({
      ok: true,
      transactionId: "tx-misc-123",
    });

    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        businessDate={mockWorkspaceData.businessDate}
        expenseCategories={mockWorkspaceData.expenseCategories}
        staffOptions={mockWorkspaceData.staffOptions}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Other Entry/i }));

    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "500" } });

    const descInput = screen.getByPlaceholderText(/Space rental fee for photoshoot/i);
    fireEvent.change(descInput, { target: { value: "Space rental fee" } });

    const submitBtn = screen.getByRole("button", { name: /Record Other Entry/i });
    fireEvent.click(submitBtn);

    expect(mockRecordOtherEntryAction).toHaveBeenCalled();
    const payload = mockRecordOtherEntryAction.mock.calls[0]![0];
    expect(payload.entryType).toBe("misc_income");
    expect(payload.amount).toBe(500);
    expect(payload.incomeDescription).toBe("Space rental fee");

    // Switch to locked Generic Adjustment
    fireEvent.click(screen.getByText("Adjustment (Locked)"));
    expect(
      screen.getByText(/General adjustment entries without formal approval policy are locked\./i)
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Record Other Entry/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("20. Cash Flow Workspace header renders Record Expense button and opens modal with expense initialMode", () => {
    render(<CashFlowWorkspace initialData={mockWorkspaceData} />);
    // Multiple "Record Expense" buttons may exist (header + Today quick-actions). Verify at least one.
    const recordExpenseBtns = screen.getAllByRole("button", { name: /Record Expense/i });
    expect(recordExpenseBtns.length).toBeGreaterThan(0);

    // Click the first one (header button)
    fireEvent.click(recordExpenseBtns[0]!);
    // Modal should open directly into Expense mode
    expect(screen.getByText(/1\. Expense Classification & Payment Account/i)).toBeTruthy();
    const submitButtons = screen.getAllByRole("button", { name: /Record Expense/i });
    expect(submitButtons.length).toBeGreaterThan(0);
  });

  it("21. Today tab Quick Actions: Record expense button invokes onRecordExpenseClick callback", () => {
    const onRecordExpenseClick = vi.fn();
    render(
      <TodayTab
        kpis={mockWorkspaceData.today.kpis}
        paymentMix={mockWorkspaceData.today.paymentMix}
        totalInflow={mockWorkspaceData.today.totalInflow}
        coverage={mockWorkspaceData.today.coverage}
        recentPayments={mockWorkspaceData.today.recentPayments}
        onNavigateToLedger={vi.fn()}
        onRecordPaymentClick={vi.fn()}
        onRecordExpenseClick={onRecordExpenseClick}
      />
    );

    // In the authorized CF8 design, the expense quick-action button triggers the callback.
    // "Record expense" is in the Quick actions section of TodayTab.
    const expenseBtns = screen.getAllByRole("button", { name: /Record expense/i });
    expect(expenseBtns.length).toBeGreaterThan(0);
    fireEvent.click(expenseBtns[0]!);
    expect(onRecordExpenseClick).toHaveBeenCalledTimes(1);
  });

  it('22. RecordFinancialEntryModal opens directly in Expense mode when initialMode="expense"', () => {
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        businessDate={mockWorkspaceData.businessDate}
        expenseCategories={mockWorkspaceData.expenseCategories}
        initialMode="expense"
      />
    );

    expect(screen.getByText(/1\. Expense Classification & Payment Account/i)).toBeTruthy();
    expect(screen.getByText(/Receipt Attachment/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Record Expense/i })).toBeTruthy();
  });

  it("23. [T03 & T04] Receipt attachment UI validates file MIME type and max size (5 MB)", () => {
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        businessDate={mockWorkspaceData.businessDate}
        expenseCategories={mockWorkspaceData.expenseCategories}
        initialMode="expense"
      />
    );

    const fileInput = screen.getByTestId("expense-receipt-file-input") as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // T03: Invalid MIME (e.g. text/plain)
    const invalidFile = new File(["hello world"], "notes.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    expect(
      screen.getByText(/Invalid file type\. Allowed formats: JPEG, PNG, WebP, PDF/i)
    ).toBeTruthy();

    // T04: Exceeds 5 MB (5 * 1024 * 1024 + 1 bytes)
    const oversizedFile = new File([new ArrayBuffer(5242881)], "large.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    expect(screen.getByText(/File size exceeds the 5 MB limit/i)).toBeTruthy();
  });

  it("24. Expense form sends the file to the server action without a browser storage path", async () => {
    mockRecordExpenseAction.mockResolvedValueOnce({
      ok: true,
      transactionId: "tx-exp-123",
    });

    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        businessDate={mockWorkspaceData.businessDate}
        expenseCategories={mockWorkspaceData.expenseCategories}
        initialMode="expense"
        branchId="11111111-1111-1111-1111-111111111111"
      />
    );

    // Fill form
    const amountInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(amountInput, { target: { value: "850" } });

    const payeeInput = screen.getByPlaceholderText(/Shell Gas Station, Clean Linen Services/i);
    fireEvent.change(payeeInput, { target: { value: "Ace Hardware" } });

    const descInput = screen.getByPlaceholderText(/Fuel for home service van/i);
    fireEvent.change(descInput, { target: { value: "Disinfectant and towels" } });

    // Attach valid JPEG receipt
    const fileInput = screen.getByTestId("expense-receipt-file-input") as HTMLInputElement;
    const validFile = new File(["fake-jpg-content"], "receipt.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(screen.getByText("receipt.jpg")).toBeTruthy();

    // Submit
    const submitBtn = screen.getByRole("button", { name: /Record Expense/i });
    fireEvent.click(submitBtn);

    // The action owns validation, upload, and path generation.
    await waitFor(() => {
      expect(mockRecordExpenseAction).toHaveBeenCalledTimes(1);
    });
    const payload = mockRecordExpenseAction.mock.calls[0]![0];
    const formData = mockRecordExpenseAction.mock.calls[0]![1] as FormData;
    expect(payload.amount).toBe(850);
    expect(payload.payee).toBe("Ace Hardware");
    expect(payload.receiptImagePath).toBeUndefined();
    expect(formData.get("receipt")).toBe(validFile);
  });

  it("25. Expense action failure is displayed to the user", async () => {
    mockRecordExpenseAction.mockResolvedValueOnce({
      ok: false,
      error: "Simulated database transaction failure",
    });

    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        businessDate={mockWorkspaceData.businessDate}
        expenseCategories={mockWorkspaceData.expenseCategories}
        initialMode="expense"
        branchId="11111111-1111-1111-1111-111111111111"
      />
    );

    // Fill form
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "300" } });
    fireEvent.change(screen.getByPlaceholderText(/Shell Gas Station, Clean Linen Services/i), {
      target: { value: "Shell" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Fuel for home service van/i), {
      target: { value: "Gasoline" },
    });

    // Attach valid file
    const fileInput = screen.getByTestId("expense-receipt-file-input") as HTMLInputElement;
    const validFile = new File(["fake-pdf-content"], "receipt.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /Record Expense/i }));

    await waitFor(() => {
      expect(screen.getByText(/Simulated database transaction failure/i)).toBeTruthy();
    });
  });

  it("routes a legacy booking and exact split tenders to the booking payment action", async () => {
    mockRecordLegacyBookingPaymentAction.mockResolvedValueOnce({ ok: true, data: { transactionId: "tx-legacy" } });
    const legacy = {
      ...mockWorkspaceData.payableOrders[0]!,
      id: "legacy-booking-1",
      sourceKind: "legacy_booking" as const,
      amountPaid: 100,
      totalAmount: 900,
      remainingBalance: 800,
    };
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={[legacy]}
        branchId={mockWorkspaceData.branchId}
        businessDate={mockWorkspaceData.businessDate}
      />
    );
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Another Payment Method/i }));
    fireEvent.click(screen.getByRole("button", { name: /Record Entry/i }));

    await waitFor(() => expect(mockRecordLegacyBookingPaymentAction).toHaveBeenCalledOnce());
    const payload = mockRecordLegacyBookingPaymentAction.mock.calls[0]![0];
    expect(payload).toMatchObject({
      bookingId: "legacy-booking-1",
      branchId: mockWorkspaceData.branchId,
      expectedAmountPaid: 100,
      businessDate: mockWorkspaceData.businessDate,
      payments: [
        { amount: 300, paymentMethod: "cash", financialAccountId: "acc-cash-1" },
        { amount: 500, paymentMethod: "gcash", financialAccountId: "acc-gcash-1" },
      ],
    });
    expect(mockRecordOrderPaymentAction).not.toHaveBeenCalled();
  });

  it("keeps a legacy booking visible when no payment account is configured and blocks posting", () => {
    const legacy = {
      ...mockWorkspaceData.payableOrders[0]!,
      id: "legacy-booking-1",
      sourceKind: "legacy_booking" as const,
    };
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={[]}
        payableOrders={[legacy]}
        branchId={mockWorkspaceData.branchId}
        businessDate={mockWorkspaceData.businessDate}
      />
    );
    expect(screen.getByText("BK-20260928-002 — Michael Tan")).toBeTruthy();
    expect(screen.getByText(/No compatible financial account is configured/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Record Entry/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("preserves the payment request key when the same form is retried", async () => {
    mockRecordLegacyBookingPaymentAction
      .mockResolvedValueOnce({ ok: false, error: "Network response lost" })
      .mockResolvedValueOnce({ ok: true, data: { transactionId: "tx-legacy", isIdempotentReplay: true } });
    const legacy = {
      ...mockWorkspaceData.payableOrders[0]!,
      id: "legacy-booking-1",
      sourceKind: "legacy_booking" as const,
    };
    render(
      <RecordFinancialEntryModal
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={[legacy]}
        branchId={mockWorkspaceData.branchId}
        businessDate={mockWorkspaceData.businessDate}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Record Entry/i }));
    await waitFor(() => expect(screen.getByText("Network response lost")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Record Entry/i }));
    await waitFor(() => expect(mockRecordLegacyBookingPaymentAction).toHaveBeenCalledTimes(2));
    expect(mockRecordLegacyBookingPaymentAction.mock.calls[0]![0].idempotencyKey)
      .toBe(mockRecordLegacyBookingPaymentAction.mock.calls[1]![0].idempotencyKey);
  });
});
