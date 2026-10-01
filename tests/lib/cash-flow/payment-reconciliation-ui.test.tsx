// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TodayTab } from '@/components/features/cash-flow/today-tab';
import { LedgerTab } from '@/components/features/cash-flow/ledger-tab';

describe('Cash Flow reconciliation presentation', () => {
  it('flags an unmatched booking snapshot on Today without adding it to receipts', () => {
    const onNavigateToLedger = vi.fn();
    render(<TodayTab
      kpis={{ recordedPayments: 500, outstandingBalance: 0, paidBookingsCount: 1, needsPaymentCount: 0, unreconciledBookingCount: 1 }}
      paymentMix={[]}
      totalInflow={500}
      coverage={[]}
      recentPayments={[]}
      onNavigateToLedger={onNavigateToLedger}
      onRecordPaymentClick={vi.fn()}
    />);

    expect(screen.getByText('Booking payment reconciliation')).toBeTruthy();
    expect(screen.getByText(/snapshot amounts are excluded from receipts/i)).toBeTruthy();
    expect(screen.getAllByText('₱500.00').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'View Ledger' }));
    expect(onNavigateToLedger).toHaveBeenCalledOnce();
  });

  it('shows an unmatched snapshot as a non-monetary Ledger review row', () => {
    render(<LedgerTab
      kpis={{ inflow: 500, outflow: 0, netFlow: 500, unreconciledText: '1 booking payment snapshot needs review', unreconciledCount: 1 }}
      businessDate="2026-09-29"
      records={[{
        id: 'unmatched-legacy_booking-booking-b', dateTime: '2026-09-29',
        reference: 'BK-booking-', customerSource: 'Booking snapshot 300.00; 300.00 requires review',
        category: 'Booking payment snapshot', method: 'Unverified',
        inflow: null, outflow: null, netEffect: 0,
        status: 'Needs reconciliation', isReconciliationOnly: true,
      }, {
        id: 'movement-a', dateTime: '2026-09-29 10:00 AM',
        reference: 'TX-A', customerSource: 'Canonical payment', category: 'Booking Payment',
        method: 'Cash', inflow: 500, outflow: null, netEffect: 500, status: 'Paid',
      }]}
    />);

    const row = screen.getByText('BK-booking-').closest('tr');
    expect(row).toBeTruthy();
    expect(within(row!).getByText('Needs reconciliation')).toBeTruthy();
    expect(within(row!).getAllByText('—')).toHaveLength(3);
    expect(screen.getByText('TX-A')).toBeTruthy();
    expect(screen.getByText('1 booking payment snapshot needs review')).toBeTruthy();
  });
});
