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
} from './cash-flow-types';
import type { FinancialPaymentMethod } from './financial-contract';

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

export async function getCashFlowData(
  branchId: string,
  branchName: string,
  businessDate: string,
  filters: CashFlowQueryFilters = {}
): Promise<CashFlowWorkspaceData> {
  const supabase = await createClient();

  // 1. Fetch active financial accounts for this branch
  const { data: accountsData } = await supabase
    .from('financial_accounts')
    .select('id, name, account_type, identifier_mask, branch_id, is_active')
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
    .eq('is_active', true)
    .order('name');

  const accounts: MaskedAccountOption[] = (accountsData || []).map((acc) => ({
    id: acc.id,
    name: acc.name,
    accountType: acc.account_type as MaskedAccountOption['accountType'],
    identifierMask: acc.identifier_mask,
    branchId: acc.branch_id,
  }));

  // 2. Fetch financial transactions for this branch
  const { data: txData } = await supabase
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

  const allTransactions: RawTransaction[] = (txData as unknown as RawTransaction[]) || [];

  // Filter transactions for today's business date
  const todayTransactions = allTransactions.filter(
    (tx) => tx.business_date === businessDate && tx.status === 'posted'
  );

  // Collect today's movements
  const todayMovements: RawMovement[] = [];
  for (const tx of todayTransactions) {
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
      total_amount,
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
    total_amount: number | null;
    order_id: string | null;
    customers: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null;
    services: { name: string; duration_minutes: number | null } | { name: string; duration_minutes: number | null }[] | null;
  };

  const todayBookings: RawBooking[] = (bookingsData as unknown as RawBooking[]) || [];

  // Calculate booking payment statistics
  let totalBookingsPaid = 0;
  let totalBookingsNeedsPayment = 0;
  let totalOutstandingAmount = 0;
  let bookingInflowTotal = 0;
  let homeServiceInflowTotal = 0;
  let inSpaPaidCount = 0;
  let homeServicePaidCount = 0;

  for (const b of todayBookings) {
    const isPaid = b.payment_status === 'paid';
    const isPartial = b.payment_status === 'partial';
    const isHomeService = b.type === 'home_service' || b.delivery_type === 'home_service';

    const total = Number(b.total_amount) || 0;
    const paid = Number(b.amount_paid) || 0;
    const remaining = Math.max(0, total - paid);

    if (isPaid) {
      totalBookingsPaid++;
      if (isHomeService) {
        homeServicePaidCount++;
        homeServiceInflowTotal += paid;
      } else {
        inSpaPaidCount++;
        bookingInflowTotal += paid;
      }
    } else {
      totalBookingsNeedsPayment++;
      totalOutstandingAmount += remaining;
      if (isPartial) {
        if (isHomeService) homeServiceInflowTotal += paid;
        else bookingInflowTotal += paid;
      }
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

  // If canonical movements are empty but bookings have recorded payments, fall back gracefully
  // while strictly NEVER counting 'pay_on_site' as received money.
  if (totalInflowFromMovements === 0 && (bookingInflowTotal > 0 || homeServiceInflowTotal > 0)) {
    for (const b of todayBookings) {
      const paid = Number(b.amount_paid) || 0;
      const method = b.payment_method?.toLowerCase() || '';
      // Exclude 'pay_on_site' or pending intents from received cash
      if (paid > 0 && method !== 'pay_on_site' && method !== 'pending') {
        let canonicalMethod: FinancialPaymentMethod | 'other' = 'other';
        if (method === 'cash') canonicalMethod = 'cash';
        else if (method.includes('gcash')) canonicalMethod = 'gcash';
        else if (method.includes('maya')) canonicalMethod = 'maya';
        else if (method.includes('card')) canonicalMethod = 'card';
        else if (method.includes('bank')) canonicalMethod = 'bank_transfer';

        totalInflowFromMovements += paid;
        const existing = mixMap.get(canonicalMethod) || { amount: 0, count: 0 };
        existing.amount += paid;
        existing.count += 1;
        mixMap.set(canonicalMethod, existing);
      }
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
      countLabel: `${todayMovements.length || totalBookingsPaid} transactions`,
      isAvailable: true,
      iconType: 'credit_card',
    },
    {
      id: 'expenses',
      label: 'Expenses',
      amount: 0,
      countLabel: 'Not yet configured',
      isAvailable: false,
      statusText: 'Not yet configured',
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
  for (const tx of todayTransactions) {
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

  // If no canonical transactions yet, populate from bookings with real payment info
  if (recentPayments.length === 0) {
    for (const b of todayBookings) {
      const paid = Number(b.amount_paid) || 0;
      if (paid > 0) {
        const cust = Array.isArray(b.customers) ? b.customers[0] : b.customers;
        const svc = Array.isArray(b.services) ? b.services[0] : b.services;
        const timeStr = b.start_time ? formatTimeFromHHMM(b.start_time) : '10:00 AM';

        recentPayments.push({
          id: b.id,
          time: timeStr,
          type: b.type === 'home_service' || b.delivery_type === 'home_service' ? 'Home Service' : 'Booking',
          customerName: cust?.full_name || 'Guest',
          reference: `#BK-${b.id.slice(0, 8)}`,
          serviceDescription: svc?.name || 'Spa Treatment',
          durationMinutes: svc?.duration_minutes ?? null,
          paymentMethodDisplay: formatMethodLabel(b.payment_method || 'Cash'),
          amount: paid,
          status: b.payment_status === 'paid' ? 'paid' : 'partial',
          orderId: b.order_id,
        });
      }
    }
  }

  // 7. Build Ledger records
  let allLedgerRecords: LedgerRecordItem[] = [];

  for (const tx of allTransactions) {
    const movements = tx.financial_account_movements || [];
    for (const m of movements) {
      const amt = Number(m.amount) || 0;
      const isInflow = amt > 0;
      allLedgerRecords.push({
        id: m.id,
        dateTime: formatDateTimeString(m.created_at || tx.occurred_at),
        reference: m.external_reference || tx.external_reference || `TX-${tx.id.slice(0, 8)}`,
        customerSource: tx.notes || (tx.source_type ? tx.source_type.replace(/_/g, ' ') : 'Customer'),
        category: tx.transaction_type === 'customer_deposit' ? 'Deposit' : 'Booking Payment',
        method: formatMethodLabel(m.payment_method),
        inflow: isInflow ? amt : null,
        outflow: !isInflow ? Math.abs(amt) : null,
        netEffect: amt,
        status: tx.status === 'posted' ? 'Paid' : tx.status,
      });
    }
  }

  // If no transactions in ledger yet, populate from bookings that have payments
  if (allLedgerRecords.length === 0) {
    for (const b of todayBookings) {
      const paid = Number(b.amount_paid) || 0;
      if (paid > 0) {
        const cust = Array.isArray(b.customers) ? b.customers[0] : b.customers;
        allLedgerRecords.push({
          id: b.id,
          dateTime: `${b.booking_date} ${formatTimeFromHHMM(b.start_time || '10:00')}`,
          reference: `BK-${b.id.slice(0, 8)}`,
          customerSource: cust?.full_name || 'Guest',
          category: b.type === 'home_service' || b.delivery_type === 'home_service' ? 'Home Service' : 'Booking',
          method: formatMethodLabel(b.payment_method || 'Cash'),
          inflow: paid,
          outflow: null,
          netEffect: paid,
          status: b.payment_status === 'paid' ? 'Paid' : 'Pending',
        });
      }
    }
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

  for (const b of todayBookings) {
    const total = Number(b.total_amount) || 0;
    const paid = Number(b.amount_paid) || 0;
    const remaining = Math.max(0, total - paid);
    const isPaid = b.payment_status === 'paid' || (total > 0 && remaining <= 0);
    const isPartial = !isPaid && paid > 0;
    const isHomeService = b.type === 'home_service' || b.delivery_type === 'home_service';

    const cust = Array.isArray(b.customers) ? b.customers[0] : b.customers;
    const svc = Array.isArray(b.services) ? b.services[0] : b.services;

    const payableItems: PayableOrderItemDetail[] = [];
    if (svc?.name) {
      payableItems.push({
        id: `item-svc-${b.id}`,
        description: svc.name,
        amount: total,
        itemType: 'service',
        subDescription: svc.duration_minutes ? `${svc.duration_minutes} mins` : undefined,
      });
    } else {
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
        method: formatMethodLabel(b.payment_method || 'Payment'),
      });
    }

    payableOrders.push({
      id: b.order_id || b.id,
      orderNumber: `BK-${b.id.slice(0, 8)}`,
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

  // 9. Day Close and History Construction
  const dayCloseSummary = {
    businessDate,
    isBalanced: totalOutstandingAmount === 0,
    readyForReview: true,
    lastUpdatedText: 'today at 10:28 PM',
    recordedInflow: totalInflowFromMovements,
    recordedOutflow: 0,
    netPosition: totalInflowFromMovements,
    openIssuesCount: totalBookingsNeedsPayment,
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
        unreconciledText: 'Reconciliation not configured',
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
