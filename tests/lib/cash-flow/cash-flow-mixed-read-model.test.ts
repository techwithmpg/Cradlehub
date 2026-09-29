import { describe, expect, it, vi } from 'vitest';

const { mockCreateClient } = vi.hoisted(() => ({ mockCreateClient: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }));

import { getCashFlowData } from '@/lib/cash-flow/cash-flow-queries';

function mockTables(tables: Record<string, Array<Record<string, unknown>>>) {
  mockCreateClient.mockResolvedValue({
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const query = {
        select: () => query,
        or: () => query,
        in: (column: string, values: unknown[]) => {
          filters.push([column, values]);
          return query;
        },
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        },
        order: () => query,
        then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) => {
          const data = (tables[table] || []).filter((row) =>
            filters.every(([column, value]) =>
              Array.isArray(value) ? value.includes(row[column]) : row[column] === value
            )
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return query;
    },
  });
}

describe('Cash Flow mixed canonical and booking snapshots', () => {
  it('shows canonical money once and flags an unmatched booking without inflating Today or Day Close', async () => {
    mockTables({
      financial_accounts: [], financial_expense_categories: [], staff: [], cash_sessions: [],
      financial_transactions: [{
        id: 'transaction-a', branch_id: 'branch-a', transaction_type: 'customer_payment',
        business_date: '2026-09-29', occurred_at: '2026-09-29T02:00:00Z',
        recorded_at: '2026-09-29T02:00:00Z', status: 'posted',
        source_type: 'legacy_booking', source_id: 'booking-a',
        external_reference: null, notes: null,
        financial_account_movements: [{
          id: 'movement-a', financial_account_id: 'account-a', amount: 500,
          payment_method: 'cash', external_reference: null, created_at: '2026-09-29T02:00:00Z',
        }],
      }],
      bookings: [
        { id: 'booking-a', branch_id: 'branch-a', booking_date: '2026-09-29', start_time: '10:00:00',
          type: 'walkin', delivery_type: 'in_spa', status: 'completed', payment_status: 'paid',
          payment_method: 'cash', amount_paid: 500, metadata: { price_paid: 500 }, order_id: null,
          customers: { full_name: 'Customer A', phone: null }, services: { name: 'Service A', duration_minutes: 60 } },
        { id: 'booking-b', branch_id: 'branch-a', booking_date: '2026-09-29', start_time: '11:00:00',
          type: 'home_service', delivery_type: 'home_service', status: 'completed', payment_status: 'paid',
          payment_method: 'gcash', amount_paid: 300, metadata: { price_paid: 300 }, order_id: null,
          customers: { full_name: 'Customer B', phone: null }, services: { name: 'Service B', duration_minutes: 60 } },
      ],
    });

    const data = await getCashFlowData('branch-a', 'Main Spa', '2026-09-29');

    expect(data.today.totalInflow).toBe(500);
    expect(data.today.recentPayments).toHaveLength(1);
    expect(data.today.kpis.unreconciledBookingCount).toBe(1);
    expect(data.ledger.kpis.inflow).toBe(500);
    expect(data.ledger.records[0]).toMatchObject({
      reference: 'BK-booking-', status: 'Needs reconciliation',
      inflow: null, netEffect: 0, isReconciliationOnly: true,
    });
    expect(data.ledger.records[1]).toMatchObject({ id: 'movement-a', inflow: 500 });
    expect(data.dayClose.recordedInflow).toBe(500);
    expect(data.dayClose.openIssuesCount).toBe(1);
    expect(data.dayClose.isBalanced).toBe(false);
  });

  it.each([
    { paid: 500, remaining: 500, state: 'partial', display: 'partially_paid' },
    { paid: 1000, remaining: 0, state: 'paid', display: 'paid' },
  ])('uses one canonical $state order balance without assigning payment to either line', async ({
    paid, remaining, state, display,
  }) => {
    const booking = (id: string) => ({
      id, branch_id: 'branch-a', booking_date: '2026-09-29', start_time: '10:00:00',
      type: 'walkin', delivery_type: 'in_spa', status: 'confirmed',
      payment_status: 'pending', payment_method: 'pay_on_site', amount_paid: 0,
      metadata: { price_paid: 500 }, order_id: 'order-a',
      customers: { full_name: 'Customer', phone: null },
      services: { name: 'Service', duration_minutes: 60 },
    });
    mockTables({
      financial_accounts: [], financial_expense_categories: [], staff: [], cash_sessions: [],
      financial_transactions: [{
        id: 'payment-a', branch_id: 'branch-a', transaction_type: 'customer_payment',
        business_date: '2026-09-29', occurred_at: '2026-09-29T02:00:00Z',
        recorded_at: '2026-09-29T02:00:00Z', status: 'posted',
        source_type: 'booking_order', source_id: 'order-a',
        financial_account_movements: [{
          id: 'movement-a', financial_account_id: 'account-a', amount: paid,
          payment_method: 'cash', created_at: '2026-09-29T02:00:00Z',
        }],
      }],
      bookings: [booking('booking-a'), booking('booking-b')],
      v_booking_order_financial_summaries: [{
        order_id: 'order-a', total_payable: 1000, net_allocated: paid,
        remaining_balance: remaining, payment_state: state,
      }],
      booking_orders: [{ id: 'order-a', metadata: { total_amount: 1000 } }],
      order_payable_items: [
        { id: 'item-a', order_id: 'order-a', description: 'Service A', amount: 500, charge_type: 'service', sequence: 1 },
        { id: 'item-b', order_id: 'order-a', description: 'Service B', amount: 500, charge_type: 'service', sequence: 2 },
        { id: 'item-fee', order_id: 'order-a', description: 'Home Service travel', amount: 50, charge_type: 'home_service_fee', sequence: 3 },
        { id: 'item-discount', order_id: 'order-a', description: 'Discount', amount: -50, charge_type: 'discount', sequence: 4 },
      ],
    });
    const data = await getCashFlowData('branch-a', 'Main Spa', '2026-09-29');
    expect(data.payableOrders).toHaveLength(1);
    expect(data.payableOrders[0]).toMatchObject({
      id: 'order-a', amountPaid: paid, remainingBalance: remaining, paymentStatus: display,
    });
    expect(data.payableOrders[0]?.payableItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'item-fee', itemType: 'home_service_fee', amount: 50 }),
      expect.objectContaining({ id: 'item-discount', itemType: 'discount', amount: -50 }),
    ]));
    expect(data.today.kpis.outstandingBalance).toBe(remaining);
    expect(data.today.totalInflow).toBe(paid);
  });
});
