import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { isCashFlowReceiptTransactionType } from "@/lib/cash-flow/payment-evidence";
import {
  getDateRangeFromPreset,
  formatReportDateRange,
  type OwnerReportsRequest,
  type OwnerReportsData,
  type RevenueByBranchItem,
  type TrendDataPoint,
  type ServiceReportItem,
  type ServiceCategoryMixItem,
  type StaffProductivityReportItem,
  type DailyFinancialItem,
  type TopPaymentDayItem,
} from "@/lib/owner/reports";

function readPricePaid(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const value = (metadata as Record<string, unknown>)["price_paid"];
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Generate full list of ISO date strings between two dates inclusive
 */
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const last = new Date(`${endDate}T00:00:00.000Z`);

  while (current <= last) {
    dates.push(current.toISOString().split("T")[0]!);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Unified server-side query and aggregation engine for Owner Reports
 */
export async function fetchOwnerReportsData(
  request: OwnerReportsRequest
): Promise<OwnerReportsData> {
  const supabase = await createClient();

  // 1. Resolve date range
  const preset =
    request.preset && ["today", "last7", "last30", "thisMonth", "custom"].includes(request.preset)
      ? request.preset
      : "last7";

  let from: string;
  let to: string;

  if (preset === "custom") {
    if (
      !request.from ||
      !request.to ||
      !ISO_DATE.test(request.from) ||
      !ISO_DATE.test(request.to) ||
      new Date(`${request.from}T00:00:00.000Z`).toISOString().slice(0, 10) !== request.from ||
      new Date(`${request.to}T00:00:00.000Z`).toISOString().slice(0, 10) !== request.to
    ) {
      throw new Error("Invalid report date range");
    }
    if (request.from <= request.to) {
      from = request.from;
      to = request.to;
    } else {
      from = request.to;
      to = request.from;
    }
  } else {
    const range = getDateRangeFromPreset(preset);
    from = range.from;
    to = range.to;
  }

  // 2. Fetch active branches
  const { data: branchRows, error: branchErr } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  if (branchErr) throw new Error(branchErr.message);

  const branches = (branchRows ?? []).map((b) => ({ id: b.id, name: b.name }));

  // 3. Resolve reporting branch scope
  const requestedBranchId =
    request.branchId && request.branchId !== "all" ? request.branchId : "all";
  const matchedBranch = branches.find((b) => b.id === requestedBranchId);
  if (requestedBranchId !== "all" && !matchedBranch) throw new Error("Invalid report branch");
  const activeBranchId = matchedBranch ? matchedBranch.id : "all";
  const activeBranchName = matchedBranch ? matchedBranch.name : "All Branches";

  // 4. Query bookings in range with branch scope
  const bookingQuery = () =>
    supabase
      .from("bookings")
      .select(
        `id, branch_id, service_id, staff_id, customer_id, booking_date, start_time, end_time, status, metadata,
       payment_method, payment_status, amount_paid,
       branches ( id, name ),
       services ( id, name, category_id, service_categories ( id, name ) ),
       staff!staff_id ( id, full_name, nickname, tier, branch_id ),
       customers ( id, full_name )`
      )
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("id");
  type BookingRow = NonNullable<Awaited<ReturnType<typeof bookingQuery>>["data"]>[number];
  const bookings: BookingRow[] = [];
  for (let offset = 0; ; offset += 500) {
    let bookingsQuery = bookingQuery().range(offset, offset + 499);
    if (activeBranchId !== "all") bookingsQuery = bookingsQuery.eq("branch_id", activeBranchId);
    const { data, error } = await bookingsQuery;
    if (error) throw new Error(error.message);
    bookings.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }

  // Signed posted movements own receipt amounts. Booking payment fields are snapshots.
  type FinanceRow = {
    id: string;
    branch_id: string;
    business_date: string;
    transaction_type: string;
    financial_account_movements: Array<{ amount: number | string; payment_method: string | null }>;
  };
  const financeRows: FinanceRow[] = [];
  for (let offset = 0; ; offset += 500) {
    let financeQuery = supabase
      .from("financial_transactions")
      .select(
        "id, branch_id, business_date, transaction_type, financial_account_movements(amount, payment_method)"
      )
      .eq("status", "posted")
      .gte("business_date", from)
      .lte("business_date", to)
      .order("id")
      .range(offset, offset + 499);
    if (activeBranchId !== "all") financeQuery = financeQuery.eq("branch_id", activeBranchId);
    const { data, error } = await financeQuery;
    if (error) throw new Error(error.message);
    const page = (data ?? []) as FinanceRow[];
    financeRows.push(...page);
    if (page.length < 500) break;
  }
  const receiptRows = financeRows.filter((row) =>
    isCashFlowReceiptTransactionType(row.transaction_type)
  );
  const positiveMovementAmount = (raw: number | string): number => {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error("Invalid posted financial movement amount");
    return Math.max(0, value);
  };
  const receiptAmount = (row: FinanceRow) =>
    row.financial_account_movements.reduce(
      (sum, movement) => sum + positiveMovementAmount(movement.amount),
      0
    );

  // Filter partitions
  const activeBookings = bookings.filter((r) => !["cancelled", "no_show"].includes(r.status));
  const completedBookings = bookings.filter((r) => r.status === "completed");

  // 5. Calculate Top KPIs
  const bookingValue = completedBookings.reduce((sum, r) => sum + readPricePaid(r.metadata), 0);
  const canonicalRevenue = receiptRows.reduce((sum, row) => sum + receiptAmount(row), 0);
  const completedServices = completedBookings.length;
  const totalBookings = activeBookings.length;
  const averageBookingValue = completedServices > 0 ? bookingValue / completedServices : 0;
  const customerReceipts = receiptRows.filter(
    (row) =>
      row.transaction_type === "customer_payment" || row.transaction_type === "customer_deposit"
  );
  const collectedPayments = customerReceipts.reduce((sum, row) => sum + receiptAmount(row), 0);
  const averageTransaction = receiptRows.length > 0 ? canonicalRevenue / receiptRows.length : 0;

  const uniqueCustomerIds = new Set(
    bookings.map((r) => r.customer_id).filter((id): id is string => Boolean(id))
  );
  const uniqueCustomers = uniqueCustomerIds.size;

  const activeStaffIds = new Set(
    completedBookings.map((r) => r.staff_id).filter((id): id is string => Boolean(id))
  );
  const activeStaffCount = activeStaffIds.size;
  const averageServicesPerStaff = activeStaffCount > 0 ? completedServices / activeStaffCount : 0;

  // 6. Branch Breakdown (for all active branches)
  const branchMetricsMap = new Map<
    string,
    {
      branchId: string;
      name: string;
      revenue: number;
      bookingValue: number;
      count: number;
      completedCount: number;
    }
  >();

  for (const b of branches) {
    branchMetricsMap.set(b.id, {
      branchId: b.id,
      name: b.name,
      revenue: 0,
      bookingValue: 0,
      count: 0,
      completedCount: 0,
    });
  }

  for (const r of bookings) {
    const bid = r.branch_id;
    if (!bid) continue;
    let entry = branchMetricsMap.get(bid);
    if (!entry) {
      const bname = Array.isArray(r.branches)
        ? r.branches[0]?.name
        : ((r.branches as { name?: string } | null)?.name ?? bid);
      entry = {
        branchId: bid,
        name: bname,
        revenue: 0,
        bookingValue: 0,
        count: 0,
        completedCount: 0,
      };
      branchMetricsMap.set(bid, entry);
    }
    if (!["cancelled", "no_show"].includes(r.status)) {
      entry.count++;
    }
    if (r.status === "completed") {
      entry.completedCount++;
      entry.bookingValue += readPricePaid(r.metadata);
    }
  }
  for (const row of receiptRows) {
    const entry = branchMetricsMap.get(row.branch_id);
    if (entry) entry.revenue += receiptAmount(row);
  }

  const revenueData: RevenueByBranchItem[] = Array.from(branchMetricsMap.values())
    .map((item) => {
      const share = canonicalRevenue > 0 ? Math.round((item.revenue / canonicalRevenue) * 100) : 0;
      const avgBookingValue = item.completedCount > 0 ? item.bookingValue / item.completedCount : 0;
      return {
        branchId: item.branchId,
        name: item.name,
        revenue: item.revenue,
        count: item.count,
        completedCount: item.completedCount,
        avgBookingValue,
        share,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // 7. Time-series trend data
  const dateRangeList = getDatesInRange(from, to);
  const trendDataMap = new Map<
    string,
    {
      date: string;
      count: number;
      completedCount: number;
      revenue: number;
      collected: number;
      branchSeries: Record<string, number>;
    }
  >();

  for (const d of dateRangeList) {
    trendDataMap.set(d, {
      date: d,
      count: 0,
      completedCount: 0,
      revenue: 0,
      collected: 0,
      branchSeries: {},
    });
  }

  for (const r of bookings) {
    const d = r.booking_date;
    const entry = trendDataMap.get(d);
    if (!entry) continue;

    if (!["cancelled", "no_show"].includes(r.status)) {
      entry.count++;
    }
    if (r.status === "completed") {
      entry.completedCount++;
    }
  }
  for (const row of receiptRows) {
    const entry = trendDataMap.get(row.business_date);
    if (!entry) continue;
    const amount = receiptAmount(row);
    entry.revenue += amount;
    entry.branchSeries[row.branch_id] = (entry.branchSeries[row.branch_id] ?? 0) + amount;
    if (
      row.transaction_type === "customer_payment" ||
      row.transaction_type === "customer_deposit"
    ) {
      entry.collected += amount;
    }
  }

  const trendData: TrendDataPoint[] = Array.from(trendDataMap.values()).map((t) => ({
    date: t.date,
    count: t.count,
    completedCount: t.completedCount,
    revenue: t.revenue,
    collected: t.collected,
    branchSeries: t.branchSeries,
  }));

  // 8. Payment Method Breakdown
  type PaymentMethodKey =
    | "cash"
    | "gcash"
    | "maya"
    | "card"
    | "bank_transfer"
    | "pay_on_site"
    | "other";
  const methodMap: Record<PaymentMethodKey, { label: string; amount: number; count: number }> = {
    cash: { label: "Cash", amount: 0, count: 0 },
    gcash: { label: "GCash", amount: 0, count: 0 },
    maya: { label: "Maya", amount: 0, count: 0 },
    card: { label: "Card / Terminal", amount: 0, count: 0 },
    bank_transfer: { label: "Bank Transfer / QR", amount: 0, count: 0 },
    pay_on_site: { label: "Pay on Site", amount: 0, count: 0 },
    other: { label: "Other", amount: 0, count: 0 },
  };

  for (const row of receiptRows) {
    for (const movement of row.financial_account_movements) {
      const amount = positiveMovementAmount(movement.amount);
      if (!amount) continue;
      const rawMethod = (movement.payment_method ?? "other").toLowerCase();
      const key = (rawMethod in methodMap ? rawMethod : "other") as PaymentMethodKey;
      const target = methodMap[key];
      if (target) {
        target.amount += amount;
        target.count += 1;
      }
    }
  }

  const totalCollectedPayment = Object.values(methodMap).reduce((s, m) => s + m.amount, 0);
  const totalTransactionsCount = receiptRows.length;

  const paymentBreakdownMethods = Object.entries(methodMap).map(([method, data]) => ({
    method,
    label: data.label,
    amount: data.amount,
    count: data.count,
    percentage:
      totalCollectedPayment > 0 ? Math.round((data.amount / totalCollectedPayment) * 100) : 0,
  }));

  // 9. Service Performance & Category Mix
  interface ServiceStatEntry {
    serviceId: string;
    name: string;
    category: string;
    completedCount: number;
    revenue: number;
    branchBreakdown: Record<string, number>;
  }

  const serviceStatsMap = new Map<string, ServiceStatEntry>();
  const categoryMixMap = new Map<string, { count: number; revenue: number }>();

  for (const r of completedBookings) {
    const sid = r.service_id ?? "unknown";
    const svc = Array.isArray(r.services) ? r.services[0] : r.services;
    const name = (svc as { name?: string } | null)?.name ?? "Unknown Service";
    const catRel = (
      svc as { service_categories?: { name?: string } | Array<{ name?: string }> } | null
    )?.service_categories;
    const catName: string = (Array.isArray(catRel) ? catRel[0]?.name : catRel?.name) ?? "General";

    let entry = serviceStatsMap.get(sid);
    if (!entry) {
      entry = {
        serviceId: sid,
        name,
        category: catName,
        completedCount: 0,
        revenue: 0,
        branchBreakdown: {},
      };
      serviceStatsMap.set(sid, entry);
    }
    entry.completedCount++;
    const bid = r.branch_id ?? "unknown";
    entry.branchBreakdown[bid] = (entry.branchBreakdown[bid] ?? 0) + 1;

    let catEntry = categoryMixMap.get(catName);
    if (!catEntry) {
      catEntry = { count: 0, revenue: 0 };
      categoryMixMap.set(catName, catEntry);
    }
    catEntry.count++;
  }

  const serviceData: ServiceReportItem[] = Array.from(serviceStatsMap.values())
    .map((item) => ({
      ...item,
      avgValue: item.completedCount > 0 ? item.revenue / item.completedCount : 0,
      share:
        completedServices > 0 ? Math.round((item.completedCount / completedServices) * 100) : 0,
    }))
    .sort((a, b) => b.completedCount - a.completedCount);

  const categoryMix: ServiceCategoryMixItem[] = Array.from(categoryMixMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      revenue: data.revenue,
      share: completedServices > 0 ? Math.round((data.count / completedServices) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 10. Staff Productivity & Performance
  const staffStatsMap = new Map<
    string,
    {
      staffId: string;
      name: string;
      tier: string;
      branchId?: string;
      total: number;
      completed: number;
      revenue: number;
      serviceCounts: Record<string, number>;
    }
  >();

  for (const r of bookings) {
    const sid = r.staff_id;
    if (!sid) continue;

    const staffRel = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    const staff = staffRel as {
      full_name?: string | null;
      nickname?: string | null;
      tier?: string | null;
      branch_id?: string | null;
    } | null;

    const staffBranchId = r.branch_id ?? "unknown";
    const staffKey = `${sid}:${staffBranchId}`;
    let entry = staffStatsMap.get(staffKey);
    if (!entry) {
      entry = {
        staffId: staffKey,
        name: staff ? getStaffAdminName(staff) : sid,
        tier: staff?.tier ?? "-",
        branchId: r.branch_id ?? undefined,
        total: 0,
        completed: 0,
        revenue: 0,
        serviceCounts: {},
      };
      staffStatsMap.set(staffKey, entry);
    }

    if (!["cancelled", "no_show"].includes(r.status)) {
      entry.total++;
    }
    if (r.status === "completed") {
      entry.completed++;

      const svcRel = Array.isArray(r.services) ? r.services[0] : r.services;
      const svcName = (svcRel as { name?: string } | null)?.name ?? "Service";
      entry.serviceCounts[svcName] = (entry.serviceCounts[svcName] ?? 0) + 1;
    }
  }

  const staffData: StaffProductivityReportItem[] = Array.from(staffStatsMap.values())
    .map((item) => {
      const branchObj = branches.find((b) => b.id === item.branchId);
      const branchName = branchObj ? branchObj.name : undefined;
      const completionRate = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
      const avgPerService = item.completed > 0 ? item.revenue / item.completed : 0;

      // Find top service
      let topService: string | undefined;
      let maxSvcCount = 0;
      for (const [svcName, count] of Object.entries(item.serviceCounts)) {
        if (count > maxSvcCount) {
          maxSvcCount = count;
          topService = svcName;
        }
      }

      return {
        staffId: item.staffId,
        name: item.name,
        tier: item.tier,
        branchId: item.branchId,
        branchName,
        total: item.total,
        completed: item.completed,
        completionRate,
        revenue: item.revenue,
        avgPerService,
        topService,
      };
    })
    .sort((a, b) => b.completed - a.completed);

  // 11. Daily Financials & Top Payment Days
  const dailyFinancials: DailyFinancialItem[] = trendData
    .map((t) => ({
      date: t.date,
      recordedRevenue: t.revenue,
      collectedPayments: t.collected,
      transactions: receiptRows.filter((row) => row.business_date === t.date).length,
      completedBookings: t.completedCount,
    }))
    .reverse(); // Most recent first for table

  const topPaymentDays: TopPaymentDayItem[] = [...trendData]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((t) => ({
      date: t.date,
      revenue: t.revenue,
      collected: t.collected,
      transactions: receiptRows.filter((row) => row.business_date === t.date).length,
    }));

  return {
    preset,
    from,
    to,
    branchId: activeBranchId,
    branchName: activeBranchName,
    dateRangeLabel: formatReportDateRange(from, to),
    generatedAt: new Date().toISOString(),
    branches,
    kpis: {
      canonicalRevenue,
      completedServices,
      totalBookings,
      averageBookingValue,
      collectedPayments,
      averageTransaction,
      uniqueCustomers,
      activeStaffCount,
      averageServicesPerStaff,
    },
    revenueData,
    trendData,
    paymentBreakdown: {
      methods: paymentBreakdownMethods,
      totalCollected: totalCollectedPayment,
      totalTransactions: totalTransactionsCount,
    },
    serviceData,
    categoryMix,
    staffData,
    dailyFinancials,
    topPaymentDays,
  };
}
