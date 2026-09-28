// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
let mockSearchParamTab = 'today';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'tab' ? mockSearchParamTab : null),
  }),
}));

vi.mock('server-only', () => ({}));

// Mock server action for payment recording
const mockRecordOrderPaymentAction = vi.fn();
vi.mock('@/lib/cash-flow/cash-flow-actions', () => ({
  recordOrderPaymentAction: (...args: unknown[]) => mockRecordOrderPaymentAction(...args),
}));

import { CashFlowWorkspace } from '@/components/features/cash-flow/cash-flow-workspace';
import { TodayTab } from '@/components/features/cash-flow/today-tab';
import { LedgerTab } from '@/components/features/cash-flow/ledger-tab';
import { DayCloseTab } from '@/components/features/cash-flow/day-close-tab';
import { HistoryTab } from '@/components/features/cash-flow/history-tab';
import { RecordPaymentSheet } from '@/components/features/cash-flow/record-payment-sheet';
import type { CashFlowWorkspaceData } from '@/lib/cash-flow/cash-flow-types';

const mockWorkspaceData: CashFlowWorkspaceData = {
  branchId: '11111111-1111-1111-1111-111111111111',
  branchName: 'Main Spa Branch',
  businessDate: '2026-09-28',
  accounts: [
    {
      id: 'acc-cash-1',
      name: 'Main Cash Drawer',
      accountType: 'cash_drawer',
      identifierMask: 'Drawer #1',
      branchId: '11111111-1111-1111-1111-111111111111',
    },
    {
      id: 'acc-gcash-1',
      name: 'Front Desk GCash',
      accountType: 'gcash',
      identifierMask: '0917-***-1234',
      branchId: '11111111-1111-1111-1111-111111111111',
    },
  ],
  today: {
    kpis: {
      recordedPayments: 5000,
      outstandingBalance: 1500,
      paidBookingsCount: 4,
      needsPaymentCount: 2,
    },
    paymentMix: [
      { method: 'cash', label: 'Cash', amount: 3000, percentage: 60, transactionCount: 3 },
      { method: 'gcash', label: 'GCash', amount: 2000, percentage: 40, transactionCount: 2 },
    ],
    totalInflow: 5000,
    coverage: [
      { id: 'bookings', label: 'Bookings', amount: 3500, countLabel: '3 paid', isAvailable: true, iconType: 'calendar' },
      { id: 'home_service', label: 'Home Service', amount: 1500, countLabel: '1 paid', isAvailable: true, iconType: 'home' },
      { id: 'expenses', label: 'Expenses', amount: 0, countLabel: 'Not yet configured', isAvailable: false, iconType: 'shopping_cart' },
    ],
    recentPayments: [
      {
        id: 'tx-1',
        time: '2:30 PM',
        type: 'Booking',
        customerName: 'Sarah Jenkins',
        reference: '#BK-20260928-001',
        serviceDescription: 'Signature Massage',
        paymentMethodDisplay: 'Cash + GCash',
        amount: 2500,
        status: 'paid',
      },
    ],
  },
  ledger: {
    kpis: {
      inflow: 5000,
      outflow: 0,
      netFlow: 5000,
      unreconciledText: 'Reconciliation not configured',
    },
    records: [
      {
        id: 'mov-1',
        dateTime: '2026-09-28 2:30 PM',
        reference: 'BK-20260928-001',
        customerSource: 'Sarah Jenkins',
        category: 'Booking Payment',
        method: 'Cash',
        inflow: 1500,
        outflow: null,
        netEffect: 1500,
        status: 'Paid',
      },
      {
        id: 'mov-2',
        dateTime: '2026-09-28 2:30 PM',
        reference: 'BK-20260928-001',
        customerSource: 'Sarah Jenkins',
        category: 'Booking Payment',
        method: 'GCash',
        inflow: 1000,
        outflow: null,
        netEffect: 1000,
        status: 'Paid',
      },
    ],
    totalRecords: 2,
    page: 1,
    pageSize: 12,
    totalPages: 1,
  },
  dayClose: {
    businessDate: '2026-09-28',
    isBalanced: true,
    readyForReview: true,
    lastUpdatedText: 'today at 10:28 PM',
    recordedInflow: 5000,
    recordedOutflow: 0,
    netPosition: 5000,
    openIssuesCount: 0,
    paymentBreakdown: [
      { method: 'cash', label: 'Cash', amount: 3000, percentage: 60, transactionCount: 3 },
      { method: 'gcash', label: 'GCash', amount: 2000, percentage: 40, transactionCount: 2 },
    ],
    coverageCategories: [
      { id: 'bookings', label: 'Bookings', amount: 3500, countLabel: '3 paid', isAvailable: true, iconType: 'calendar' },
    ],
    timeline: [
      { id: 't-1', time: '2:30 PM', title: 'Booking payment received', amount: 2500, paymentMethod: 'Cash + GCash' },
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
      id: 'ord-1',
      orderNumber: 'BK-20260928-002',
      customerName: 'Michael Tan',
      serviceDescription: 'Deep Tissue Massage',
      totalAmount: 1800,
      amountPaid: 0,
      remainingBalance: 1800,
      bookingDate: '2026-09-28',
    },
  ],
};

describe('CF5 Cash Flow UI Foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamTab = 'today';
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Cash Flow Workspace renders header and title correctly', () => {
    render(<CashFlowWorkspace initialData={mockWorkspaceData} />);
    expect(screen.getByRole('heading', { level: 1, name: /Cash Flow/i })).toBeTruthy();
    expect(screen.getByText(/Main Spa Branch · 2026-09-28/i)).toBeTruthy();
    expect(screen.getByText(/Financial activity and daily reconciliation/i)).toBeTruthy();
  });

  it('2. Today tab renders 4 KPI cards and payment mix with actual data', () => {
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

    // KPI cards
    expect(screen.getByText(/RECORDED PAYMENTS/i)).toBeTruthy();
    expect(screen.getAllByText(/₱5,000.00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/OUTSTANDING/i)).toBeTruthy();
    expect(screen.getAllByText(/₱1,500.00/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/PAID BOOKINGS/i)).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText(/NEEDS PAYMENT/i)).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    // Payment mix
    expect(screen.getByText('Payment mix')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
  });

  it('3. Today tab displays split-tender payment accurately without flattening', () => {
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
    expect(screen.getByText('Cash + GCash')).toBeTruthy();
    expect(screen.getByText('Sarah Jenkins')).toBeTruthy();
  });

  it('4. Cash flow coverage renders future modules as Not yet configured', () => {
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

    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByText('Not yet configured')).toBeTruthy();
  });

  it('5. Ledger tab renders KPI cards and ledger table with Inflow and Net Effect', () => {
    render(
      <LedgerTab
        kpis={mockWorkspaceData.ledger.kpis}
        records={mockWorkspaceData.ledger.records}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    expect(screen.getAllByText('INFLOW').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OUTFLOW').length).toBeGreaterThan(0);
    expect(screen.getByText('NET FLOW')).toBeTruthy();
    expect(screen.getByText('UNRECONCILED')).toBeTruthy();
    expect(screen.getByText('Reconciliation not configured')).toBeTruthy();

    // Table rows
    expect(screen.getAllByText('BK-20260928-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sarah Jenkins').length).toBeGreaterThan(0);
  });

  it('6. Ledger tab search filter filters rows dynamically', () => {
    render(
      <LedgerTab
        kpis={mockWorkspaceData.ledger.kpis}
        records={mockWorkspaceData.ledger.records}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Customer, reference, description/i);
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Customer' } });

    expect(screen.getByText('No matching ledger records')).toBeTruthy();
  });

  it('7. Day Close tab renders auto-generated day summary banner and balanced status', () => {
    render(
      <DayCloseTab
        summary={mockWorkspaceData.dayClose}
        onNavigateToLedger={vi.fn()}
      />
    );

    expect(screen.getByText(/Auto-generated Day Summary · 2026-09-28/i)).toBeTruthy();
    expect(screen.getByText(/Ready for review/i)).toBeTruthy();
    expect(screen.getByText(/Records are balanced/i)).toBeTruthy();

    // Mark as reviewed is disabled/preview
    const reviewButton = screen.getByRole('button', { name: /Mark as reviewed/i });
    expect(reviewButton.hasAttribute('disabled')).toBe(true);
  });

  it('8. History tab renders designed empty state when no historical day closes exist', () => {
    render(
      <HistoryTab
        history={mockWorkspaceData.history}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    expect(screen.getByText('CLOSED DAYS THIS MONTH')).toBeTruthy();
    expect(screen.getByText('No historical day close records')).toBeTruthy();
    expect(screen.getByText('No day-close audit activity yet.')).toBeTruthy();
  });

  it('9. Tab switching updates navigation query parameter', () => {
    render(<CashFlowWorkspace initialData={mockWorkspaceData} />);

    const ledgerButton = screen.getByRole('button', { name: 'Ledger' });
    fireEvent.click(ledgerButton);

    expect(mockPush).toHaveBeenCalledWith('/crm/cash-flow?tab=ledger', { scroll: false });
  });

  it('10. Record Payment sheet opens and supports split-tender addition', () => {
    render(
      <RecordPaymentSheet
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    expect(screen.getByRole('heading', { name: 'Record Payment' })).toBeTruthy();
    expect(screen.getByText(/Michael Tan/i)).toBeTruthy();

    // Add another payment method button
    const addMethodButton = screen.getByRole('button', { name: /Add Another Payment Method/i });
    fireEvent.click(addMethodButton);

    // Should now have 2 tender lines
    expect(screen.getByText('Tender #1')).toBeTruthy();
    expect(screen.getByText('Tender #2')).toBeTruthy();
  });

  it('11. Record Payment calls server action using CF4 atomic writer', async () => {
    mockRecordOrderPaymentAction.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        transactionId: 'tx-new-123',
        orderId: 'ord-1',
      },
    });

    render(
      <RecordPaymentSheet
        open={true}
        onOpenChange={vi.fn()}
        accounts={mockWorkspaceData.accounts}
        payableOrders={mockWorkspaceData.payableOrders}
        businessDate={mockWorkspaceData.businessDate}
      />
    );

    const submitButtons = screen.getAllByRole('button', { name: /Record Payment/i });
    fireEvent.click(submitButtons[submitButtons.length - 1]!);

    expect(mockRecordOrderPaymentAction).toHaveBeenCalled();
    const callArg = mockRecordOrderPaymentAction.mock.calls[0]![0];
    expect(callArg.orderId).toBe('ord-1');
    expect(callArg.payments).toHaveLength(1);
    expect(callArg.payments[0].paymentMethod).toBe('cash');
  });

  it('12. Runtime data is completely free of hardcoded mock amounts', () => {
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
    expect(screen.getAllByText('₱0.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('₱14,750.00')).toBeNull();
    expect(screen.queryByText('₱4,850.00')).toBeNull();
    expect(screen.getByText('No payment activity recorded today')).toBeTruthy();
  });
});
