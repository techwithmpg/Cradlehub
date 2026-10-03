import { describe, expect, it, vi } from 'vitest';

const { mockCreateClient } = vi.hoisted(() => ({ mockCreateClient: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }));

import { getCashFlowData } from '@/lib/cash-flow/cash-flow-queries';

function mockTables(tables: Record<string, Array<Record<string, unknown>>>, failTable?: string) {
  mockCreateClient.mockResolvedValue({
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const query = {
        select: () => query,
        limit: () => query,
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
        then: (resolve: (value: { data: Record<string, unknown>[]; error: { message: string } | null }) => void) => {
          const data = (tables[table] || []).filter((row) =>
            filters.every(([column, value]) =>
              Array.isArray(value) ? value.includes(row[column]) : row[column] === value
            )
          );
          return Promise.resolve({ data, error: table === failTable ? { message: 'missing relation' } : null }).then(resolve);
        },
      };
      return query;
    },
  });
}

describe('Cash Flow mixed canonical and booking snapshots', () => {
  it.each([
    ['confirmed', 'cancelled'],
    ['cancelled', 'confirmed'],
    ['confirmed', 'expired'],
    ['expired', 'confirmed'],
  ])('keeps mixed-order eligibility and collectible amount stable for %s + %s', async (first, second) => {
    const booking = (id: string, status: string) => ({
      id, branch_id: 'branch-a', booking_date: '2026-09-29', start_time: '10:00:00',
      type: 'walkin', delivery_type: 'in_spa', status, payment_status: 'unpaid',
      amount_paid: 0, metadata: { price_paid: status === 'confirmed' ? 1000 : 800 },
      order_id: 'order-a', customers: { full_name: 'Order Customer', phone: null },
      services: { name: 'Massage', duration_minutes: 60 },
    });
    mockTables({
      financial_accounts: [], financial_expense_categories: [], staff: [], cash_sessions: [],
      financial_transactions: [],
      bookings: [booking('first', first), booking('second', second)],
      v_booking_order_financial_summaries: [{
        order_id: 'order-a', total_payable: 0, net_allocated: 0,
        remaining_balance: 0, payment_state: 'paid',
      }],
      booking_orders: [{ id: 'order-a', metadata: { total_amount: 1800 } }],
      order_payable_items: [],
    });

    const data = await getCashFlowData('branch-a', 'Main Spa', '2026-09-29');
    expect(data.payableOrders).toHaveLength(1);
    expect(data.payableOrders[0]).toMatchObject({
      id: 'order-a', paymentEligible: true, totalAmount: 1000,
      remainingBalance: 1000, bookingStatus: 'Mixed services',
    });
  });

  it.each(['cancelled', 'no_show', 'expired'])(
    'does not offer an all-%s order for payment', async (status) => {
      mockTables({
        financial_accounts: [], financial_expense_categories: [], staff: [], cash_sessions: [],
        financial_transactions: [],
        bookings: [{
          id: 'closed-line', branch_id: 'branch-a', booking_date: '2026-09-29',
          start_time: '10:00:00', type: 'walkin', delivery_type: 'in_spa', status,
          payment_status: 'unpaid', amount_paid: 0, metadata: { price_paid: 800 },
          order_id: 'order-a', customers: { full_name: 'Order Customer', phone: null },
          services: { name: 'Massage', duration_minutes: 60 },
        }],
        v_booking_order_financial_summaries: [{
          order_id: 'order-a', total_payable: 0, net_allocated: 0,
          remaining_balance: 0, payment_state: 'paid',
        }],
        booking_orders: [{ id: 'order-a', metadata: { total_amount: 800 } }],
        order_payable_items: [],
      });

      const data = await getCashFlowData('branch-a', 'Main Spa', '2026-09-29');
      expect(data.payableOrders).toEqual([]);
    }
  );

  it('lists payable legacy bookings individually and groups order siblings once', async () => {
    const booking = (id: string, status: string, paymentStatus: string, price: unknown, paid: number, orderId: string | null = null) => ({
      id, branch_id: 'branch-a', booking_date: '2026-09-29', start_time: '10:00:00',
      type: 'walkin', delivery_type: 'in_spa', status, payment_status: paymentStatus,
      payment_method: 'cash', amount_paid: paid, metadata: { price_paid: price }, order_id: orderId,
      customers: { full_name: `Customer ${id}`, phone: '0917 123 4567' },
      services: { name: 'Massage', duration_minutes: 60 },
    });
    mockTables({
      financial_accounts: [], financial_expense_categories: [], staff: [], cash_sessions: [],
      financial_transactions: [],
      bookings: [
        booking('legacy-unpaid', 'pending_payment', 'unpaid', 800, 0),
        booking('legacy-pending', 'pending_payment', 'pending', '900.00', 100),
        booking('legacy-paid', 'confirmed', 'paid', 550, 550),
        booking('legacy-cancelled', 'cancelled', 'unpaid', 400, 0),
        booking('legacy-no-show', 'no_show', 'pending', 400, 0),
        booking('legacy-invalid', 'pending_payment', 'unpaid', 'not-a-price', 0),
        booking('order-line-a', 'confirmed', 'pending', 500, 0, 'order-a'),
        booking('order-line-b', 'confirmed', 'pending', 500, 0, 'order-a'),
      ],
      v_booking_order_financial_summaries: [{
        order_id: 'order-a', total_payable: 1000, net_allocated: 200,
        remaining_balance: 800, payment_state: 'partial',
      }],
      booking_orders: [{ id: 'order-a', metadata: { total_amount: 1000 } }],
      order_payable_items: [],
    });

    const data = await getCashFlowData('branch-a', 'Main Spa', '2026-09-29');
    expect(data.payableOrders.map((option) => [option.id, option.sourceKind])).toEqual([
      ['legacy-unpaid', 'legacy_booking'],
      ['legacy-pending', 'legacy_booking'],
      ['order-a', 'booking_order'],
    ]);
    expect(data.payableOrders[0]).toMatchObject({ totalAmount: 800, amountPaid: 0, remainingBalance: 800 });
    expect(data.payableOrders[1]).toMatchObject({ totalAmount: 900, amountPaid: 100, remainingBalance: 800 });
    expect(data.payableOrders[2]).toMatchObject({ totalAmount: 1000, amountPaid: 200, remainingBalance: 800 });
    expect(data.today.totalInflow).toBe(0);
  });

  it.each([
    'financial_accounts',
    'financial_transactions',
    'financial_account_movements',
    'order_payable_items',
    'v_booking_order_financial_summaries',
    'daily_cash_reconciliations',
  ])('surfaces a required %s query failure instead of a zero-activity view', async (table) => {
    mockTables({}, table);
    await expect(getCashFlowData('branch-a', 'Main Spa', '2026-09-29'))
      .rejects.toThrow(/Cash Flow database contract unavailable/);
  });

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
    { status: 'draft', actualCash: 400, balanced: false },
    { status: 'submitted', actualCash: 400, balanced: true },
    { status: 'approved', actualCash: 390, balanced: false },
  ])('uses saved $status reconciliation and posted movements for Day Close', async ({
    status, actualCash, balanced,
  }) => {
    const movement = (id: string, amount: number) => ({
      id, financial_account_id: 'drawer-a', amount, payment_method: 'cash',
      external_reference: null, created_at: '2026-09-29T02:00:00Z',
    });
    const transaction = (id: string, type: string, movementAmount: number) => ({
      id, branch_id: 'branch-a', transaction_type: type, business_date: '2026-09-29',
      occurred_at: '2026-09-29T02:00:00Z', recorded_at: '2026-09-29T02:00:00Z',
      status: 'posted', source_type: null, source_id: null, external_reference: null,
      notes: null, financial_account_movements: [movement(`${id}-movement`, movementAmount)],
    });
    mockTables({
      financial_accounts: [], financial_expense_categories: [], staff: [], cash_sessions: [],
      financial_transactions: [
        transaction('payment-a', 'customer_payment', 500),
        transaction('expense-a', 'operational_expense', -100),
      ],
      bookings: [],
      daily_cash_reconciliations: [{
        branch_id: 'branch-a', reconciliation_date: '2026-09-29', status,
        expected_cash: 400, actual_cash: actualCash,
        expected_gcash: 0, actual_gcash: 0,
        expected_maya: 0, actual_maya: 0,
        expected_card: 0, actual_card: 0,
        expected_other: 0, actual_other: 0,
        updated_at: '2026-09-29T12:00:00Z',
      }],
    });

    const data = await getCashFlowData('branch-a', 'Main Spa', '2026-09-29');
    expect(data.dayClose).toMatchObject({
      reconciliationStatus: status, expectedCash: 400, actualCash,
      cashVariance: actualCash - 400, isBalanced: balanced,
      recordedInflow: 500, recordedOutflow: 100, netPosition: 400,
    });
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
    expect(data.payableOrders).toHaveLength(remaining > 0 ? 1 : 0);
    if (remaining > 0) {
      expect(data.payableOrders[0]).toMatchObject({
        id: 'order-a', sourceKind: 'booking_order', amountPaid: paid,
        remainingBalance: remaining, paymentStatus: display,
      });
      expect(data.payableOrders[0]?.payableItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'item-fee', itemType: 'home_service_fee', amount: 50 }),
        expect.objectContaining({ id: 'item-discount', itemType: 'discount', amount: -50 }),
      ]));
    }
    expect(data.today.kpis.outstandingBalance).toBe(remaining);
    expect(data.today.totalInflow).toBe(paid);
  });
});
