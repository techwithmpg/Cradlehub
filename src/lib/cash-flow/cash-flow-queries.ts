import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type {
  CashFlowWorkspaceData,
  MaskedAccountOption,
  PaymentMixItem,
  CashFlowCoverageCategory,
  RecentPaymentItem,
  LedgerRecordItem,
  PayableOrderOption,
  PayableOrderItemDetail,
  PayableOrderPreviousPayment,
  CashSessionSummary,
} from './cash-flow-types';
import type { FinancialPaymentMethod } from './financial-contract';
import { findUnmatchedBookingPayments, isCashFlowReceiptTransactionType } from './payment-evidence';
import { CashFlowRequiredDataError } from './cash-flow-errors';
import { validatedLegacyBookingPrice } from './legacy-booking-price';

export interface CashFlowQueryFilters {
  tab?: string;
  search?: string;
  dateRange?: string;
  source?: string;
  category?: string;
  method?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

interface RawMovement {
  id: string;
  amount: number | string;
  payment_method: string;
  external_reference: string | null;
  created_at: string;
  financial_account_id: string;
}

interface RawTransaction {
  id: string;
  branch_id: string;
  transaction_type: string;
  business_date: string;
  occurred_at: string;
  recorded_at: string;
  status: string;
  idempotency_key: string;
  source_type: string | null;
  source_id: string | null;
  external_reference: string | null;
  notes: string | null;
  financial_account_movements?: RawMovement[];
}

function bookingPriceSnapshot(metadata: Record<string, unknown> | null): number {
  const raw = metadata?.price_paid;
  const amount = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export async function getCashFlowData(
  branchId: string,
  branchName: string,
  businessDate: string,
  filters: CashFlowQueryFilters = {}
): Promise<CashFlowWorkspaceData> {
  const supabase = await createClient();

  // 1. Fetch active financial accounts for this branch
  const { data: accountsData, error: accountsError } = await supabase
    .from('financial_accounts')
    .select('id, name, account_type, identifier_mask, branch_id, is_active')
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
    .eq('is_active', true)
    .order('name');
  if (accountsError) {
    throw new CashFlowRequiredDataError('financial_accounts');
  }

  const accounts: MaskedAccountOption[] = (accountsData || []).map((acc) => ({
    id: acc.id,
    name: acc.name,
    accountType: acc.account_type as MaskedAccountOption['accountType'],
    identifierMask: acc.identifier_mask,
    branchId: acc.branch_id,
  }));

  // 1b. Fetch active expense categories
  interface DynamicCategoryQuery {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          order: (col: string) => Promise<{
            data: Array<{ id: string; code: string; name: string; description: string | null }> | null;
            error: unknown;
          }>;
        };
      };
    };
  }

  const { data: categoriesData } = await (supabase as unknown as DynamicCategoryQuery)
    .from('financial_expense_categories')
    .select('id, code, name, description')
    .eq('is_active', true)
    .order('display_order');

  const expenseCategories = ((categoriesData as Array<{ id: string; code: string; name: string; description: string | null }>) || []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
  }));

  // 1c. Fetch active staff members for this branch
  const { data: staffData } = await supabase
    .from('staff')
    .select('id, full_name, system_role')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('full_name');

  const staffOptions = (staffData || []).map((s) => ({
    id: s.id,
    name: s.full_name,
    role: s.system_role,
  }));

  // 2. Fetch financial transactions for this branch
  const { data: txData, error: transactionsError } = await supabase
    .from('financial_transactions')
    .select(`
      id,
      branch_id,
      transaction_type,
      business_date,
      occurred_at,
      recorded_at,
      status,
      idempotency_key,
      source_type,
      source_id,
      external_reference,
      notes,
      financial_account_movements (
        id,
        amount,
        payment_method,
        external_reference,
        created_at,
        financial_account_id
      )
    `)
    .eq('branch_id', branchId)
    .order('occurred_at', { ascending: false });
  if (transactionsError) {
    throw new CashFlowRequiredDataError('financial_transactions or financial_account_movements');
  }

  // These are required CF tables even on days with no transactions or orders.
  // A missing migration must not render as a plausible zero-activity day.
  const [movementsProbe, payablesProbe, summariesProbe] = await Promise.all([
    supabase.from('financial_account_movements').select('id').limit(0),
    supabase.from('order_payable_items').select('id').limit(0),
    supabase.from('v_booking_order_financial_summaries').select('order_id').limit(0),
  ]);
  if (movementsProbe.error) {
    throw new CashFlowRequiredDataError('financial_account_movements');
  }
  if (payablesProbe.error) {
    throw new CashFlowRequiredDataError('order_payable_items');
  }
  if (summariesProbe.error) {
    throw new CashFlowRequiredDataError('v_booking_order_financial_summaries');
  }

  const allTransactions: RawTransaction[] = (txData as unknown as RawTransaction[]) || [];

  // 2b. Available physical cash drawer accounts for this branch
  const availableDrawers = accounts.filter((acc) => acc.accountType === 'cash_drawer');

  // 2c. Fetch active cash sessions for this branch
  let rawSessions: Array<{
    id: string;
    branch_id: string;
    cash_drawer_account_id: string;
    business_date: string;
    status: 'open' | 'closed';
    opening_float: number | string;
    opening_note: string | null;
    opened_by: string;
    opened_at: string;
    closed_by: string | null;
    closed_at: string | null;
  }> = [];

  try {
    const { data: sessionRows, error: sessionErr } = await (supabase as unknown as {
      from: (tbl: string) => {
        select: (cols: string) => {
          eq: (c1: string, v1: unknown) => {
            eq: (c2: string, v2: unknown) => {
              order: (c3: string, o?: { ascending?: boolean }) => Promise<{
                data: typeof rawSessions | null;
                error: unknown;
              }>;
            };
          };
        };
      };
    })
      .from('cash_sessions')
      .select('id, branch_id, cash_drawer_account_id, business_date, status, opening_float, opening_note, opened_by, opened_at, closed_by, closed_at')
      .eq('branch_id', branchId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });

    if (sessionErr) {
      throw sessionErr;
    }

    rawSessions = sessionRows ?? [];
  } catch {
    throw new CashFlowRequiredDataError('cash_sessions');
  }

  // Derive active cash session summaries with strictly derived expectedCash
  // Expected physical drawer cash = opening_float + SUM(signed movements on SAME drawer from POSTED transactions occurring at/after session.opened_at)
  const activeSessions: CashSessionSummary[] = rawSessions.map((s) => {
    const openingFloat = Number(s.opening_float) || 0;
    const drawerAcc = accounts.find((a) => a.id === s.cash_drawer_account_id);
    const openerStaff = staffOptions.find((st) => st.id === s.opened_by);
    const sessionOpenedAtMs = new Date(s.opened_at).getTime();

    let drawerMovementsTotal = 0;
    for (const tx of allTransactions) {
      if (tx.status !== 'posted') continue;

      if (tx.financial_account_movements && Array.isArray(tx.financial_account_movements)) {
        for (const m of tx.financial_account_movements) {
          if (m.financial_account_id !== s.cash_drawer_account_id) continue;

          const mCreatedAtMs = new Date(m.created_at).getTime();
          if (mCreatedAtMs >= sessionOpenedAtMs) {
            drawerMovementsTotal += Number(m.amount) || 0;
          }
        }
      }
    }

    const expectedCash = openingFloat + drawerMovementsTotal;

    return {
      id: s.id,
      branchId: s.branch_id,
      businessDate: s.business_date,
      cashDrawerAccountId: s.cash_drawer_account_id,
      cashDrawerName: drawerAcc?.name || 'Cash Drawer',
      status: s.status,
      openingFloat,
      openingNote: s.opening_note || null,
      openedBy: s.opened_by,
      openedByName: openerStaff?.name || 'Staff',
      openedAt: s.opened_at,
      closedBy: s.closed_by || null,
      closedAt: s.closed_at || null,
      expectedCash,
    };
  });

  // Filter transactions for today's business date
  const todayTransactions = allTransactions.filter(
    (tx) => tx.business_date === businessDate && tx.status === 'posted'
  );
  const postedDayAmounts = todayTransactions.flatMap((tx) =>
    (tx.financial_account_movements ?? []).map((movement) => Number(movement.amount) || 0)
  );
  const postedDayInflow = postedDayAmounts.reduce((sum, amount) => sum + Math.max(0, amount), 0);
  const postedDayOutflow = postedDayAmounts.reduce((sum, amount) => sum + Math.max(0, -amount), 0);
  const receiptTransactions = todayTransactions.filter((tx) =>
    isCashFlowReceiptTransactionType(tx.transaction_type)
  );

  // Collect today's movements
  const todayMovements: RawMovement[] = [];
  for (const tx of receiptTransactions) {
    if (tx.financial_account_movements && Array.isArray(tx.financial_account_movements)) {
      todayMovements.push(...tx.financial_account_movements);
    }
  }

  // 3. Fetch today's bookings for operational context
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_date,
      start_time,
      type,
      delivery_type,
      status,
      payment_status,
      payment_method,
      amount_paid,
      metadata,
      order_id,
      customers:customer_id ( full_name, phone ),
      services:service_id ( name, duration_minutes )
    `)
    .eq('branch_id', branchId)
    .eq('booking_date', businessDate);

  type RawBooking = {
    id: string;
    booking_date: string;
    start_time: string;
    type: string | null;
    delivery_type: string | null;
    status: string | null;
    payment_status: string | null;
    payment_method: string | null;
    amount_paid: number | null;
    metadata: Record<string, unknown> | null;
    order_id: string | null;
    customers: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null;
    services: { name: string; duration_minutes: number | null } | { name: string; duration_minutes: number | null }[] | null;
  };

  const todayBookings: RawBooking[] = (bookingsData as unknown as RawBooking[]) || [];
  const orderIds = [...new Set(todayBookings.flatMap((b) => b.order_id ? [b.order_id] : []))];
  type OrderSummary = {
    order_id: string;
    total_payable: number | string;
    net_allocated: number | string;
    remaining_balance: number | string;
    payment_state: string;
  };
  const orderSummaryById = new Map<string, OrderSummary>();
  const orderQuoteById = new Map<string, number>();
  const orderItemsById = new Map<string, PayableOrderItemDetail[]>();
  if (orderIds.length > 0) {
    const [
      { data: summaries, error: summaryError },
      { data: orders, error: ordersError },
      { data: orderItems, error: itemsError },
    ] =
      await Promise.all([
        supabase.from('v_booking_order_financial_summaries')
          .select('order_id, total_payable, net_allocated, remaining_balance, payment_state')
          .in('order_id', orderIds),
        supabase.from('booking_orders').select('id, metadata').in('id', orderIds),
        supabase.from('order_payable_items')
          .select('id, order_id, description, amount, charge_type, sequence')
          .in('order_id', orderIds).order('sequence'),
      ]);
    if (summaryError || ordersError || itemsError) {
      throw new Error('Could not load authoritative order payment summaries.');
    }
    for (const row of (summaries ?? []) as OrderSummary[]) {
      orderSummaryById.set(row.order_id, row);
    }
    for (const row of orders ?? []) {
      const raw = (row.metadata as Record<string, unknown> | null)?.total_amount;
      const quote = Number(raw);
      if (Number.isFinite(quote) && quote > 0) orderQuoteById.set(row.id, quote);
    }
    for (const row of orderItems ?? []) {
      const list = orderItemsById.get(row.order_id) ?? [];
      list.push({
        id: row.id,
        description: row.description,
        amount: Number(row.amount) || 0,
        itemType: row.charge_type === 'other_charge'
          ? 'other'
          : row.charge_type as PayableOrderItemDetail['itemType'],
      });
      orderItemsById.set(row.order_id, list);
    }
  }
  const orderPayment = (orderId: string) => {
    const summary = orderSummaryById.get(orderId);
    if (!summary) return null;
    const canonicalTotal = Number(summary.total_payable) || 0;
    const total = canonicalTotal > 0 ? canonicalTotal : (orderQuoteById.get(orderId) ?? 0);
    const paid = Number(summary.net_allocated) || 0;
    return {
      total,
      paid,
      remaining: Math.max(0, total - paid),
      status: canonicalTotal > 0 || total === 0
        ? summary.payment_state : 'unpaid',
    };
  };

  // Calculate booking payment statistics
  let totalBookingsPaid = 0;
  let totalBookingsNeedsPayment = 0;
  let totalOutstandingAmount = 0;
  let inSpaPaidCount = 0;
  let homeServicePaidCount = 0;
  const outstandingOrdersCounted = new Set<string>();

  for (const b of todayBookings) {
    const orderState = b.order_id ? orderPayment(b.order_id) : null;
    if (b.order_id && !orderState) continue;
    const isPaid = b.order_id
      ? orderState?.status === 'paid'
      : b.payment_status === 'paid';
    const isHomeService = b.type === 'home_service' || b.delivery_type === 'home_service';

    const total = orderState?.total ?? bookingPriceSnapshot(b.metadata);
    const paid = orderState?.paid ?? (Number(b.amount_paid) || 0);
    const remaining = orderState?.remaining ?? Math.max(0, total - paid);

    if (isPaid) {
      totalBookingsPaid++;
      if (isHomeService) {
        homeServicePaidCount++;
      } else {
        inSpaPaidCount++;
      }
    } else {
      totalBookingsNeedsPayment++;
      if (!b.order_id || !outstandingOrdersCounted.has(b.order_id)) {
        totalOutstandingAmount += remaining;
        if (b.order_id) outstandingOrdersCounted.add(b.order_id);
      }
    }
  }

  const unmatchedPayments = findUnmatchedBookingPayments(branchId, todayBookings, allTransactions);
  let bookingInflowTotal = 0;
  let homeServiceInflowTotal = 0;
  for (const tx of todayTransactions) {
    if (tx.transaction_type !== 'customer_payment' && tx.transaction_type !== 'customer_deposit') continue;
    const linkedBookings = tx.source_type === 'legacy_booking'
      ? todayBookings.filter((booking) => booking.id === tx.source_id)
      : tx.source_type === 'booking_order'
        ? todayBookings.filter((booking) => booking.order_id === tx.source_id)
        : [];
    if (linkedBookings.length === 0) continue;
    const amount = (tx.financial_account_movements || []).reduce(
      (sum, movement) => sum + Math.max(0, Number(movement.amount) || 0), 0
    );
    if (linkedBookings.every((booking) => booking.type === 'home_service' || booking.delivery_type === 'home_service')) {
      homeServiceInflowTotal += amount;
    } else if (linkedBookings.every((booking) => booking.type !== 'home_service' && booking.delivery_type !== 'home_service')) {
      bookingInflowTotal += amount;
    }
  }

  // 4. Calculate Payment Mix from canonical financial account movements
  let totalInflowFromMovements = 0;
  const mixMap = new Map<FinancialPaymentMethod | 'other', { amount: number; count: number }>();

  for (const m of todayMovements) {
    const amt = Number(m.amount) || 0;
    if (amt > 0) {
      totalInflowFromMovements += amt;
      const method = (m.payment_method as FinancialPaymentMethod) || 'other';
      const existing = mixMap.get(method) || { amount: 0, count: 0 };
      existing.amount += amt;
      existing.count += 1;
      mixMap.set(method, existing);
    }
  }

  const standardMethods: Array<{ method: FinancialPaymentMethod; label: string }> = [
    { method: 'cash', label: 'Cash' },
    { method: 'gcash', label: 'GCash' },
    { method: 'maya', label: 'Maya' },
    { method: 'card', label: 'Card' },
    { method: 'bank_transfer', label: 'Bank Transfer' },
  ];

  const paymentMix: PaymentMixItem[] = standardMethods.map(({ method, label }) => {
    const item = mixMap.get(method) || { amount: 0, count: 0 };
    const percentage =
      totalInflowFromMovements > 0
        ? Math.round((item.amount / totalInflowFromMovements) * 100)
        : 0;
    return {
      method,
      label,
      amount: item.amount,
      percentage,
      transactionCount: item.count,
    };
  });

  const otherItem = mixMap.get('other');
  if (otherItem && otherItem.amount > 0) {
    const percentage =
      totalInflowFromMovements > 0
        ? Math.round((otherItem.amount / totalInflowFromMovements) * 100)
        : 0;
    paymentMix.push({
      method: 'other',
      label: 'Other',
      amount: otherItem.amount,
      percentage,
      transactionCount: otherItem.count,
    });
  }

  // Operational expenses calculation from canonical transactions/movements (CF7)
  const expenseTransactions = todayTransactions.filter(
    (tx) => tx.transaction_type === 'operational_expense'
  );
  let totalExpenseOutflow = 0;
  for (const tx of expenseTransactions) {
    const movements = tx.financial_account_movements || [];
    for (const m of movements) {
      const amt = Number(m.amount) || 0;
      if (amt < 0) {
        totalExpenseOutflow += Math.abs(amt);
      }
    }
  }
  const expenseCount = expenseTransactions.length;

  // 5. Build Cash Flow Coverage categories (13 tiles matching visual reference)
  const coverage: CashFlowCoverageCategory[] = [
    {
      id: 'bookings',
      label: 'Bookings',
      amount: bookingInflowTotal,
      countLabel: `${inSpaPaidCount} paid`,
      isAvailable: true,
      iconType: 'calendar',
    },
    {
      id: 'home_service',
      label: 'Home Service',
      amount: homeServiceInflowTotal,
      countLabel: `${homeServicePaidCount} paid`,
      isAvailable: true,
      iconType: 'home',
    },
    {
      id: 'payments',
      label: 'Payments',
      amount: totalInflowFromMovements,
      countLabel: `${todayMovements.length} transactions`,
      isAvailable: true,
      iconType: 'credit_card',
    },
    {
      id: 'expenses',
      label: 'Expenses',
      amount: totalExpenseOutflow,
      countLabel: expenseCount > 0 ? `${expenseCount} logged` : '0 logged',
      isAvailable: true,
      statusText: expenseCount > 0 ? `${expenseCount} logged` : '0 logged',
      iconType: 'shopping_cart',
    },
    {
      id: 'tips',
      label: 'Tips',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'gift',
    },
    {
      id: 'staff_advances',
      label: 'Staff Advances',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'user',
    },
    {
      id: 'payroll',
      label: 'Payroll',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'users',
    },
    {
      id: 'commissions',
      label: 'Commission Payouts',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'percent',
    },
    {
      id: 'petty_cash',
      label: 'Petty Cash',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'wallet',
    },
    {
      id: 'transfers',
      label: 'Transfers',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'arrows',
    },
    {
      id: 'refunds',
      label: 'Refunds',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'reply',
    },
    {
      id: 'adjustments',
      label: 'Adjustments',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'sliders',
    },
    {
      id: 'misc_income',
      label: 'Misc Income',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
      iconType: 'plus',
    },
  ];

  // 6. Build Recent Payment Activity
  const recentPayments: RecentPaymentItem[] = [];

  // Add payments from canonical transactions
  for (const tx of receiptTransactions) {
    const movements = tx.financial_account_movements || [];
    const totalAmount = movements.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    if (totalAmount <= 0) continue;

    // Multi-method presentation (e.g., "Cash + GCash")
    const methods = Array.from(
      new Set(movements.map((m) => formatMethodLabel(m.payment_method)))
    );
    const paymentMethodDisplay = methods.join(' + ') || 'Payment';

    const timeStr = formatTimeString(tx.occurred_at || tx.recorded_at);

    recentPayments.push({
      id: tx.id,
      time: timeStr,
      type: tx.transaction_type === 'customer_deposit' ? 'Deposit' : 'Payment',
      customerName: tx.notes || 'Walk-in Customer',
      reference: tx.external_reference || `#TX-${tx.id.slice(0, 8)}`,
      serviceDescription: tx.source_type ? `${tx.source_type.replace(/_/g, ' ')}` : 'Spa Service',
      durationMinutes: null,
      paymentMethodDisplay,
      amount: totalAmount,
      status: tx.status === 'posted' ? 'paid' : 'pending',
      orderId: tx.source_id,
    });
  }

  // 7. Build Ledger records
  let allLedgerRecords: LedgerRecordItem[] = [];

  for (const tx of allTransactions) {
    const movements = tx.financial_account_movements || [];
    const movementAmounts = movements.map((movement) => Number(movement.amount) || 0);
    const isCanonicalTransfer =
      tx.transaction_type === 'cash_adjustment' &&
      movements.length === 2 &&
      movementAmounts.some((amount) => amount > 0) &&
      movementAmounts.some((amount) => amount < 0) &&
      Math.round(
        movementAmounts.reduce((sum, amount) => sum + amount, 0) * 100
      ) === 0;

    for (const m of movements) {
      const amt = Number(m.amount) || 0;
      const isInflow = amt > 0;
      allLedgerRecords.push({
        id: m.id,
        dateTime: formatDateTimeString(m.created_at || tx.occurred_at),
        reference: m.external_reference || tx.external_reference || `TX-${tx.id.slice(0, 8)}`,
        customerSource: tx.notes || (tx.source_type ? tx.source_type.replace(/_/g, ' ') : 'Customer'),
        category:
          tx.transaction_type === 'customer_deposit'
            ? 'Deposit'
            : tx.transaction_type === 'operational_expense'
            ? 'Expense'
            : tx.transaction_type === 'tip_collection'
            ? 'Staff Tip'
            : tx.transaction_type === 'other_income'
            ? 'Misc Income'
            : tx.transaction_type === 'cash_adjustment'
            ? isCanonicalTransfer
              ? 'Transfer'
              : movements.length === 1
                ? isInflow
                  ? 'Cash Addition'
                  : 'Cash Removal'
                : 'Adjustment'
            : 'Booking Payment',
        method: formatMethodLabel(m.payment_method),
        inflow: isInflow ? amt : null,
        outflow: !isInflow ? Math.abs(amt) : null,
        netEffect: amt,
        status: tx.status === 'posted' ? 'Paid' : tx.status,
      });
    }
  }

  // Show unmatched booking snapshots as review rows, never as financial movements.
  for (const gap of unmatchedPayments) {
    allLedgerRecords.unshift({
      id: `unmatched-${gap.sourceType}-${gap.sourceId}`,
      dateTime: businessDate,
      reference: gap.sourceType === 'legacy_booking' ? `BK-${gap.sourceId.slice(0, 8)}` : `ORDER-${gap.sourceId.slice(0, 8)}`,
      customerSource: gap.reason === 'ambiguous_order'
        ? `Order-level payment cannot be assigned to booking snapshots; review ${gap.snapshotAmount.toFixed(2)}`
        : `Booking snapshot ${gap.snapshotAmount.toFixed(2)}; ${gap.unmatchedAmount.toFixed(2)} lacks financial evidence`,
      category: 'Booking payment snapshot',
      method: 'Unverified',
      inflow: null,
      outflow: null,
      netEffect: 0,
      status: 'Needs reconciliation',
      isReconciliationOnly: true,
    });
  }

  // Filter ledger records if filter applied
  if (filters.search) {
    const q = filters.search.toLowerCase();
    allLedgerRecords = allLedgerRecords.filter(
      (r) =>
        r.reference.toLowerCase().includes(q) ||
        r.customerSource.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );
  }

  if (filters.method && filters.method !== 'all') {
    allLedgerRecords = allLedgerRecords.filter(
      (r) => r.method.toLowerCase() === filters.method?.toLowerCase()
    );
  }

  // Pagination
  const pageSize = filters.pageSize || 12;
  const page = filters.page || 1;
  const totalRecords = allLedgerRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedRecords = allLedgerRecords.slice((page - 1) * pageSize, page * pageSize);

  // Compute total inflow, outflow, net for ledger
  let ledgerInflow = 0;
  let ledgerOutflow = 0;
  for (const r of allLedgerRecords) {
    if (r.inflow) ledgerInflow += r.inflow;
    if (r.outflow) ledgerOutflow += r.outflow;
  }

  // 8. Fetch payable orders for the Record Payment modal
  // Looks for orders or bookings with unpaid/partial balances
  const payableOrders: PayableOrderOption[] = [];

  const listedOrders = new Set<string>();
  for (const b of todayBookings) {
    if (b.order_id && listedOrders.has(b.order_id)) continue;
    if (b.order_id) listedOrders.add(b.order_id);
    const orderState = b.order_id ? orderPayment(b.order_id) : null;
    if (b.order_id && !orderState) continue;
    if (!b.order_id && ['cancelled', 'no_show'].includes(b.status ?? '')) continue;
    const legacyTotal = b.order_id ? null : validatedLegacyBookingPrice(b.metadata);
    if (!b.order_id && legacyTotal === null) continue;
    const legacyPaid = Number(b.amount_paid ?? 0);
    if (!b.order_id && (!Number.isFinite(legacyPaid) || legacyPaid < 0)) continue;
    const total = orderState?.total ?? legacyTotal!;
    const paid = orderState?.paid ?? legacyPaid;
    const remaining = orderState?.remaining ?? Math.max(0, total - paid);
    const isPaid = b.order_id
      ? orderState?.status === 'paid'
      : b.payment_status === 'paid';
    if (isPaid || remaining <= 0) continue;
    const isPartial = !isPaid && paid > 0;
    const isHomeService = b.type === 'home_service' || b.delivery_type === 'home_service';

    const cust = Array.isArray(b.customers) ? b.customers[0] : b.customers;
    const svc = Array.isArray(b.services) ? b.services[0] : b.services;

    const payableItems: PayableOrderItemDetail[] =
      b.order_id ? [...(orderItemsById.get(b.order_id) ?? [])] : [];
    if (payableItems.length === 0 && svc?.name) {
      payableItems.push({
        id: `item-svc-${b.id}`,
        description: svc.name,
        amount: total,
        itemType: 'service',
        subDescription: svc.duration_minutes ? `${svc.duration_minutes} mins` : undefined,
      });
    } else if (payableItems.length === 0) {
      payableItems.push({
        id: `item-svc-${b.id}`,
        description: 'Spa Service',
        amount: total,
        itemType: 'service',
      });
    }

    const previousPayments: PayableOrderPreviousPayment[] = [];
    if (paid > 0) {
      previousPayments.push({
        date: b.booking_date,
        amount: paid,
        method: b.order_id ? 'Order payment' : 'Booking snapshot (unverified)',
      });
    }

    payableOrders.push({
      id: b.order_id || b.id,
      sourceKind: b.order_id ? 'booking_order' : 'legacy_booking',
      orderNumber: b.order_id ? `ORDER-${b.order_id.slice(0, 8)}` : `BK-${b.id.slice(0, 8)}`,
      customerName: cust?.full_name || 'Guest',
      customerPhone: cust?.phone ?? null,
      serviceDescription: svc?.name || 'Spa Service',
      totalAmount: total,
      amountPaid: paid,
      remainingBalance: remaining,
      bookingDate: b.booking_date,
      serviceTime: b.start_time ? formatTimeFromHHMM(b.start_time) : null,
      branchName: branchName,
      visitType: isHomeService ? 'home_service' : 'in_spa',
      bookingStatus: b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : 'Confirmed',
      paymentStatus: isPaid ? 'paid' : isPartial ? 'partially_paid' : 'unpaid',
      payableItems,
      previousPayments,
    });
  }

  // 9. Consume the persisted reconciliation authority for this branch/date.
  const { data: reconciliationRows, error: reconciliationError } = await supabase
    .from('daily_cash_reconciliations')
    .select('status, expected_cash, expected_gcash, expected_maya, expected_card, expected_other, actual_cash, actual_gcash, actual_maya, actual_card, actual_other, updated_at')
    .eq('branch_id', branchId)
    .eq('reconciliation_date', businessDate)
    .limit(1);
  if (reconciliationError) {
    throw new CashFlowRequiredDataError('daily_cash_reconciliations');
  }
  const reconciliation = reconciliationRows?.[0] ?? null;
  const reconciliationStatus: CashFlowWorkspaceData['dayClose']['reconciliationStatus'] = reconciliation?.status === 'draft' ||
    reconciliation?.status === 'submitted' || reconciliation?.status === 'approved'
    ? reconciliation.status : 'not_started';
  const expectedCash = reconciliation ? Number(reconciliation.expected_cash) : null;
  const actualCash = reconciliation ? Number(reconciliation.actual_cash) : null;
  const cashVariance = expectedCash !== null && actualCash !== null
    ? actualCash - expectedCash : null;
  const channelVariance = reconciliation ? [
    'cash', 'gcash', 'maya', 'card', 'other',
  ].reduce((sum, channel) =>
    sum + Math.abs(Number(reconciliation[`actual_${channel}` as keyof typeof reconciliation]) -
      Number(reconciliation[`expected_${channel}` as keyof typeof reconciliation])), 0) : null;

  // 10. Day Close and History Construction
  const dayCloseSummary = {
    businessDate,
    isBalanced: (reconciliationStatus === 'submitted' || reconciliationStatus === 'approved') && channelVariance === 0,
    readyForReview: reconciliationStatus === 'submitted',
    lastUpdatedText: reconciliation?.updated_at
      ? formatDateTimeString(reconciliation.updated_at) : 'not recorded',
    reconciliationStatus,
    expectedCash,
    actualCash,
    cashVariance,
    channelVariance,
    recordedInflow: postedDayInflow,
    recordedOutflow: postedDayOutflow,
    netPosition: postedDayInflow - postedDayOutflow,
    openIssuesCount: totalBookingsNeedsPayment + unmatchedPayments.length,
    paymentBreakdown: paymentMix,
    coverageCategories: coverage,
    timeline: recentPayments.map((p) => ({
      id: p.id,
      time: p.time,
      title: `${p.type} payment received`,
      amount: p.amount,
      paymentMethod: p.paymentMethodDisplay,
    })),
    isFinalizationSupported: false,
  };

  const historySummary = {
    closedDaysThisMonth: 0,
    totalInflowThisMonth: totalInflowFromMovements,
    totalOutflowThisMonth: 0,
    reviewExceptions: 0,
    records: [],
    selectedClose: null,
    auditTrail: [],
  };

  return {
    branchId,
    branchName,
    businessDate,
    accounts,
    today: {
      kpis: {
        recordedPayments: totalInflowFromMovements,
        outstandingBalance: totalOutstandingAmount,
        paidBookingsCount: totalBookingsPaid,
        needsPaymentCount: totalBookingsNeedsPayment,
        unreconciledBookingCount: unmatchedPayments.length,
        recordedPaymentsTrend: totalInflowFromMovements > 0 ? null : null,
      },
      paymentMix,
      totalInflow: totalInflowFromMovements,
      coverage,
      recentPayments,
    },
    ledger: {
      kpis: {
        inflow: ledgerInflow,
        outflow: ledgerOutflow,
        netFlow: ledgerInflow - ledgerOutflow,
        unreconciledText: unmatchedPayments.length > 0
          ? `${unmatchedPayments.length} booking payment snapshot${unmatchedPayments.length === 1 ? '' : 's'} need review`
          : 'Reconciliation not configured',
        unreconciledCount: unmatchedPayments.length,
      },
      records: pagedRecords,
      totalRecords,
      page,
      pageSize,
      totalPages,
    },
    dayClose: dayCloseSummary,
    history: historySummary,
    payableOrders,
    expenseCategories,
    staffOptions,
    cashSessions: {
      activeSessions,
      availableDrawers,
    },
  };
}

function formatMethodLabel(method: string): string {
  if (!method) return 'Cash';
  switch (method.toLowerCase()) {
    case 'cash':
      return 'Cash';
    case 'gcash':
      return 'GCash';
    case 'maya':
      return 'Maya';
    case 'card':
    case 'card_terminal':
      return 'Card';
    case 'bank_transfer':
      return 'Bank Transfer';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

function formatTimeString(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function formatTimeFromHHMM(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const parts = timeStr.split(':');
    const hour = parseInt(parts[0] || '0', 10);
    const min = parts[1] || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${formattedHour}:${min} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function formatDateTimeString(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const datePart = d.toISOString().slice(0, 10);
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} ${timePart}`;
  } catch {
    return isoString;
  }
}
