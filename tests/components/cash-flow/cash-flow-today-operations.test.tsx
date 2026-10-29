/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CashFlowWorkspaceData, PayableOrderOption } from "@/lib/cash-flow/cash-flow-types";
import { CashFlowTodayOperations } from "@/components/features/cash-flow/cash-flow-today-operations";

const makePayableOrder = (overrides: Partial<PayableOrderOption> = {}): PayableOrderOption => ({
  id: "order-completed",
  sourceKind: "booking_order",
  orderNumber: "ORD-001",
  customerName: "Maria Santos",
  customerPhone: "09170000001",
  serviceDescription: "Swedish Massage",
  totalAmount: 1200,
  amountPaid: 0,
  remainingBalance: 1200,
  bookingDate: "2026-10-30",
  serviceTime: "1:00 PM",
  visitType: "in_spa",
  bookingStatus: "completed",
  paymentStatus: "unpaid",
  paymentEligible: true,
  readyForCheckout: true,
  ...overrides,
});

const dawnNavarroOrder: PayableOrderOption = {
  id: "order-dawn",
  sourceKind: "booking_order",
  orderNumber: "ORDER-c5cc08fd",
  customerName: "DAWN NAVARRO",
  customerPhone: "09171234567",
  serviceDescription: "Post Natal Massage",
  totalAmount: 1086,
  amountPaid: 0,
  remainingBalance: 1086,
  bookingDate: "2026-10-30",
  serviceTime: "3:00 PM",
  visitType: "home_service",
  bookingStatus: "in_progress",
  paymentStatus: "unpaid",
  paymentEligible: true,
  readyForCheckout: false, // In-progress Home Service
};

const partiallyPaidOrder: PayableOrderOption = {
  id: "order-partial",
  sourceKind: "booking_order",
  orderNumber: "ORD-003",
  customerName: "Elena Cruz",
  customerPhone: "09170000003",
  serviceDescription: "Deep Tissue Massage",
  totalAmount: 1500,
  amountPaid: 500,
  remainingBalance: 1000,
  bookingDate: "2026-10-30",
  serviceTime: "4:00 PM",
  visitType: "in_spa",
  bookingStatus: "in_progress",
  paymentStatus: "partially_paid",
  paymentEligible: true,
  readyForCheckout: false,
};

const fullyPaidOrder: PayableOrderOption = {
  id: "order-paid",
  sourceKind: "booking_order",
  orderNumber: "ORD-004",
  customerName: "Paid Customer",
  customerPhone: "09170000004",
  serviceDescription: "Foot Reflexology",
  totalAmount: 800,
  amountPaid: 800,
  remainingBalance: 0,
  bookingDate: "2026-10-30",
  serviceTime: "5:00 PM",
  visitType: "in_spa",
  bookingStatus: "completed",
  paymentStatus: "paid",
  paymentEligible: true,
  readyForCheckout: true,
};

const mockData: CashFlowWorkspaceData = {
  branchId: "branch-main",
  branchName: "Main Spa",
  businessDate: "2026-10-30",
  accounts: [
    {
      id: "drawer-1",
      name: "Cash Drawer",
      accountType: "cash_drawer",
      identifierMask: "***",
      branchId: "branch-main",
    },
    {
      id: "gcash-1",
      name: "GCash Business",
      accountType: "gcash",
      identifierMask: "***",
      branchId: "branch-main",
    },
  ],
  today: {
    totalInflow: 5000,
    kpis: {
      recordedPayments: 5000,
      outstandingBalance: 1200,
      paidBookingsCount: 3,
      needsPaymentCount: 1,
    },
    paymentMix: [],
    coverage: [],
    recentPayments: [],
  },
  ledger: {
    kpis: { inflow: 5000, outflow: 0, netFlow: 5000, unreconciledText: "0 unreconciled" },
    records: [],
    totalRecords: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
  },
  history: {
    closedDaysThisMonth: 10,
    totalInflowThisMonth: 50000,
    totalOutflowThisMonth: 5000,
    reviewExceptions: 0,
    records: [],
    auditTrail: [],
  },
  dayClose: {
    businessDate: "2026-10-30",
    isBalanced: true,
    readyForReview: false,
    lastUpdatedText: "Just now",
    reconciliationStatus: "draft",
    expectedCash: 2000,
    actualCash: null,
    cashVariance: null,
    channelVariance: null,
    recordedInflow: 5000,
    recordedOutflow: 0,
    netPosition: 5000,
    openIssuesCount: 0,
    paymentBreakdown: [],
    coverageCategories: [],
    timeline: [],
    isFinalizationSupported: true,
  },
  expenseCategories: [],
  staffOptions: [],
  cashSessions: {
    activeSessions: [
      {
        id: "sess-1",
        cash_drawer_account_id: "drawer-1",
        opened_at: "2026-10-30T08:00:00Z",
        status: "open",
        branch_id: "branch-main",
      } as any,
    ],
    availableDrawers: [],
  },
  payableOrders: [makePayableOrder(), dawnNavarroOrder, partiallyPaidOrder, fullyPaidOrder],
};

afterEach(cleanup);

describe("CashFlowTodayOperations — Outstanding Bookings & KPI Integrity", () => {
  const onRecordPaymentClick = vi.fn();
  const onNavigateToLedger = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Bookings with outstanding payments' and displays both completed and in-progress orders", () => {
    render(
      <CashFlowTodayOperations
        data={mockData}
        onRecordPaymentClick={onRecordPaymentClick}
        onNavigateToLedger={onNavigateToLedger}
      />
    );

    // Header title
    expect(screen.getByText("Bookings with outstanding payments")).toBeTruthy();
    expect(screen.getByText("3 outstanding")).toBeTruthy();

    // In-progress Home Service booking (Dawn Navarro) appears in the table!
    expect(screen.getByText("DAWN NAVARRO")).toBeTruthy();
    expect(screen.getByText("ORDER-c5cc08fd")).toBeTruthy();
    expect(screen.getByText("Post Natal Massage")).toBeTruthy();
    expect(screen.getByText("₱1,086.00")).toBeTruthy();

    // Completed unpaid order appears in the table
    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("ORD-001")).toBeTruthy();
    expect(screen.getAllByText("₱1,200.00").length).toBeGreaterThanOrEqual(1);

    // Partially paid order appears in the table
    expect(screen.getByText("Elena Cruz")).toBeTruthy();
    expect(screen.getByText("ORD-003")).toBeTruthy();
    expect(screen.getByText("₱1,000.00")).toBeTruthy();

    // Fully paid order is excluded from the outstanding table
    expect(screen.queryByText("Paid Customer")).toBeNull();
  });

  it("strictly preserves the 'Completed — awaiting collection' KPI for completed unpaid orders only", () => {
    render(
      <CashFlowTodayOperations
        data={mockData}
        onRecordPaymentClick={onRecordPaymentClick}
        onNavigateToLedger={onNavigateToLedger}
      />
    );

    // Only Maria Santos (₱1,200.00) is completed and unpaid!
    // Dawn Navarro (₱1,086.00) and Elena Cruz (₱1,000.00) are in_progress and must NOT increase this KPI!
    expect(screen.getByText("Completed — awaiting collection")).toBeTruthy();
    expect(screen.getByText("1 completed order unpaid")).toBeTruthy();
    expect(screen.getAllByText("₱1,200.00").length).toBeGreaterThanOrEqual(1);
  });

  it("displays clear operational status badges: Ready to Pay, In Progress, Partially Paid", () => {
    render(
      <CashFlowTodayOperations
        data={mockData}
        onRecordPaymentClick={onRecordPaymentClick}
        onNavigateToLedger={onNavigateToLedger}
      />
    );

    expect(screen.getByText("Ready to Pay")).toBeTruthy();
    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(screen.getByText("Partially Paid")).toBeTruthy();
  });

  it("filters outstanding bookings via search input", () => {
    render(
      <CashFlowTodayOperations
        data={mockData}
        onRecordPaymentClick={onRecordPaymentClick}
        onNavigateToLedger={onNavigateToLedger}
      />
    );

    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "Dawn" } });

    expect(screen.getAllByText("DAWN NAVARRO").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Maria Santos")).toBeNull();
    expect(screen.queryByText("Elena Cruz")).toBeNull();
  });

  it("opens Record Payment modal with selected order when Review & Confirm Payment is clicked", () => {
    render(
      <CashFlowTodayOperations
        data={mockData}
        onRecordPaymentClick={onRecordPaymentClick}
        onNavigateToLedger={onNavigateToLedger}
      />
    );

    // Select Dawn Navarro
    fireEvent.click(screen.getByLabelText("Select payment for DAWN NAVARRO"));

    // Quick Payment card updates with Dawn Navarro
    expect(screen.getAllByText("DAWN NAVARRO").length).toBeGreaterThan(1);

    // Click Review & Confirm Payment
    fireEvent.click(screen.getByRole("button", { name: "Review & Confirm Payment" }));

    expect(onRecordPaymentClick).toHaveBeenCalledWith("order-dawn", "cash");
  });
});
