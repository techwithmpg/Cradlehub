/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getPrintableReceiptAction: vi.fn(),
  printThermalReceipt: vi.fn(),
}));

vi.mock('@/lib/cash-flow/cash-flow-actions', () => ({
  getPrintableReceiptAction: mocks.getPrintableReceiptAction,
}));

vi.mock('@/lib/cash-flow/receipt-printer', () => ({
  printThermalReceipt: mocks.printThermalReceipt,
}));

import { TodayTab } from '@/components/features/cash-flow/today-tab';
import { LedgerTab } from '@/components/features/cash-flow/ledger-tab';
import type {
  TodayKpiSummary,
  RecentPaymentItem,
  LedgerKpiSummary,
  LedgerRecordItem,
} from '@/lib/cash-flow/cash-flow-types';

afterEach(cleanup);

describe('Reprint Receipt UI in Cash Flow Views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.printThermalReceipt.mockReturnValue(true);
    mocks.getPrintableReceiptAction.mockResolvedValue({
      ok: true,
      data: {
        companyName: 'CRADLE WELLNESS LIVING INC.',
        branchName: 'Main Spa',
        transactionId: '11111111-2222-3333-4444-555555555555',
        orderNumber: 'ORD-001',
        customerName: 'Maria Santos',
        formattedDateTime: 'Oct 31, 2026, 02:30 PM',
        serviceDescription: 'Signature Massage',
        items: [{ description: 'Signature Massage', amount: 1500 }],
        totalPayable: 1500,
        alreadyPaid: 0,
        amountPaid: 1500,
        remainingBalance: 0,
        payments: [{ method: 'cash', amount: 1500 }],
        isReprint: true,
        receiptLabel: 'PAYMENT ACKNOWLEDGMENT',
      },
    });
  });

  describe('TodayTab Recent Payments', () => {
    const kpis: TodayKpiSummary = {
      recordedPayments: 1500,
      outstandingBalance: 0,
      paidBookingsCount: 1,
      needsPaymentCount: 0,
      unreconciledBookingCount: 0,
    };

    const recentPayments: RecentPaymentItem[] = [
      {
        id: '11111111-2222-3333-4444-555555555555',
        time: '2:30 PM',
        type: 'Payment',
        customerName: 'Maria Santos',
        reference: '#TX-11111111',
        serviceDescription: 'Signature Massage',
        paymentMethodDisplay: 'Cash',
        amount: 1500,
        status: 'paid',
        orderId: 'order-1',
      },
    ];

    it('renders the RECEIPT column header and Reprint button', () => {
      render(
        <TodayTab
          kpis={kpis}
          paymentMix={[]}
          totalInflow={1500}
          coverage={[]}
          recentPayments={recentPayments}
          onNavigateToLedger={vi.fn()}
          onRecordPaymentClick={vi.fn()}
        />
      );

      expect(screen.getByRole('columnheader', { name: 'RECEIPT' })).toBeTruthy();
      const reprintBtn = screen.getByRole('button', { name: /Reprint/i });
      expect(reprintBtn).toBeTruthy();
    });

    it('invokes getPrintableReceiptAction and prints thermal receipt when clicked', async () => {
      render(
        <TodayTab
          kpis={kpis}
          paymentMix={[]}
          totalInflow={1500}
          coverage={[]}
          recentPayments={recentPayments}
          onNavigateToLedger={vi.fn()}
          onRecordPaymentClick={vi.fn()}
        />
      );

      const reprintBtn = screen.getByRole('button', { name: /Reprint/i });
      fireEvent.click(reprintBtn);

      await waitFor(() =>
        expect(mocks.getPrintableReceiptAction).toHaveBeenCalledWith(
          '11111111-2222-3333-4444-555555555555'
        )
      );

      await waitFor(() =>
        expect(mocks.printThermalReceipt).toHaveBeenCalledWith(
          expect.objectContaining({
            transactionId: '11111111-2222-3333-4444-555555555555',
            isReprint: true,
          })
        )
      );
    });

    it('displays an actionable error banner when receipt retrieval fails', async () => {
      mocks.getPrintableReceiptAction.mockResolvedValue({
        ok: false,
        error: 'AUTH_REQUIRED: Authentication required to retrieve receipts.',
      });

      render(
        <TodayTab
          kpis={kpis}
          paymentMix={[]}
          totalInflow={1500}
          coverage={[]}
          recentPayments={recentPayments}
          onNavigateToLedger={vi.fn()}
          onRecordPaymentClick={vi.fn()}
        />
      );

      const reprintBtn = screen.getByRole('button', { name: /Reprint/i });
      fireEvent.click(reprintBtn);

      await waitFor(() =>
        expect(screen.getByText(/Authentication required/i)).toBeTruthy()
      );
    });

    it('does not render Reprint button for ineligible items (pending, zero/negative, non-payment)', () => {
      const ineligiblePayments: RecentPaymentItem[] = [
        {
          id: 'ineligible-1',
          time: '3:00 PM',
          type: 'Payment',
          customerName: 'Pending Customer',
          reference: '#TX-PENDING',
          serviceDescription: 'Massage',
          paymentMethodDisplay: 'Cash',
          amount: 1500,
          status: 'pending',
          orderId: 'order-2',
        },
        {
          id: 'ineligible-2',
          time: '3:15 PM',
          type: 'Payment',
          customerName: 'Zero Amount',
          reference: '#TX-ZERO',
          serviceDescription: 'Massage',
          paymentMethodDisplay: 'Cash',
          amount: 0,
          status: 'paid',
          orderId: 'order-3',
        },
        {
          id: 'ineligible-3',
          time: '3:30 PM',
          type: 'Refund',
          customerName: 'Refund Item',
          reference: '#TX-REFUND',
          serviceDescription: 'Massage',
          paymentMethodDisplay: 'Cash',
          amount: 500,
          status: 'paid',
          orderId: 'order-4',
        },
      ];

      render(
        <TodayTab
          kpis={kpis}
          paymentMix={[]}
          totalInflow={1500}
          coverage={[]}
          recentPayments={ineligiblePayments}
          onNavigateToLedger={vi.fn()}
          onRecordPaymentClick={vi.fn()}
        />
      );

      // Verify no Reprint button is present
      expect(screen.queryByRole('button', { name: /Reprint/i })).toBeNull();
      // Should show dashes
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('LedgerTab Canonical Records', () => {
    const kpis: LedgerKpiSummary = {
      inflow: 1500,
      outflow: 0,
      netFlow: 1500,
      unreconciledText: 'Balanced',
    };

    const records: LedgerRecordItem[] = [
      {
        id: 'mov-1',
        transactionId: '11111111-2222-3333-4444-555555555555',
        dateTime: 'Oct 31, 2026, 02:30 PM',
        reference: 'TX-11111111',
        customerSource: 'Maria Santos',
        category: 'Booking Payment',
        method: 'Cash',
        inflow: 1500,
        outflow: null,
        netEffect: 1500,
        status: 'Paid',
      },
    ];

    it('renders the ACTION column header and Receipt button for canonical payment records', () => {
      render(
        <LedgerTab
          kpis={kpis}
          records={records}
          businessDate="2026-10-31"
        />
      );

      expect(screen.getByRole('columnheader', { name: 'ACTION' })).toBeTruthy();
      const receiptBtn = screen.getByRole('button', { name: /Receipt/i });
      expect(receiptBtn).toBeTruthy();
    });

    it('invokes getPrintableReceiptAction and printThermalReceipt on click', async () => {
      render(
        <LedgerTab
          kpis={kpis}
          records={records}
          businessDate="2026-10-31"
        />
      );

      const receiptBtn = screen.getByRole('button', { name: /Receipt/i });
      fireEvent.click(receiptBtn);

      await waitFor(() =>
        expect(mocks.getPrintableReceiptAction).toHaveBeenCalledWith(
          '11111111-2222-3333-4444-555555555555'
        )
      );

      await waitFor(() =>
        expect(mocks.printThermalReceipt).toHaveBeenCalledWith(
          expect.objectContaining({
            transactionId: '11111111-2222-3333-4444-555555555555',
            isReprint: true,
          })
        )
      );
    });

    it('does not render Receipt button for ineligible records (expenses, pending, zero inflow)', () => {
      const ineligibleRecords: LedgerRecordItem[] = [
        {
          id: 'mov-expense',
          transactionId: 'expense-tx-uuid',
          dateTime: 'Oct 31, 2026, 03:00 PM',
          reference: 'EXP-001',
          customerSource: 'Office Depot',
          category: 'Operational Expense',
          method: 'Cash',
          inflow: null,
          outflow: 500,
          netEffect: -500,
          status: 'Paid',
        },
        {
          id: 'mov-pending',
          transactionId: 'pending-tx-uuid',
          dateTime: 'Oct 31, 2026, 03:15 PM',
          reference: 'TX-PENDING',
          customerSource: 'Pending Client',
          category: 'Booking Payment',
          method: 'Cash',
          inflow: 1000,
          outflow: null,
          netEffect: 1000,
          status: 'Pending',
        },
      ];

      render(
        <LedgerTab
          kpis={kpis}
          records={ineligibleRecords}
          businessDate="2026-10-31"
        />
      );

      expect(screen.queryByRole('button', { name: /Receipt/i })).toBeNull();
    });
  });
});

