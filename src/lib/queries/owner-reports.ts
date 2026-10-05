import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { loadMasterSheetReview } from "@/lib/integrations/google-sheets/sheet-review-service";
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
  type MasterSheetEvidenceSummary,
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
  const current = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);

  while (current <= last) {
    dates.push(current.toISOString().split("T")[0]!);
    current.setDate(current.getDate() + 1);
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

  if (
    preset === "custom" &&
    request.from &&
    request.to &&
    ISO_DATE.test(request.from) &&
    ISO_DATE.test(request.to)
  ) {
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
  const activeBranchId = matchedBranch ? matchedBranch.id : "all";
  const activeBranchName = matchedBranch ? matchedBranch.name : "All Branches";

  // 4. Query bookings in range with branch scope
  let bookingsQuery = supabase
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
    .lte("booking_date", to);

  if (activeBranchId !== "all") {
    bookingsQuery = bookingsQuery.eq("branch_id", activeBranchId);
  }

  const { data: bookingRows, error: bookingsErr } = await bookingsQuery;
  if (bookingsErr) throw new Error(bookingsErr.message);

  const bookings = bookingRows ?? [];

  // Filter partitions
  const activeBookings = bookings.filter((r) => !["cancelled", "no_show"].includes(r.status));
  const completedBookings = bookings.filter((r) => r.status === "completed");
  const paidBookings = bookings.filter((r) => r.payment_status === "paid");

  // 5. Calculate Top KPIs
  const canonicalRevenue = completedBookings.reduce((sum, r) => sum + readPricePaid(r.metadata), 0);
  const completedServices = completedBookings.length;
  const totalBookings = activeBookings.length;
  const averageBookingValue = completedServices > 0 ? canonicalRevenue / completedServices : 0;
  const collectedPayments = paidBookings.reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0);
  const averageTransaction = paidBookings.length > 0 ? collectedPayments / paidBookings.length : 0;

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
    { branchId: string; name: string; revenue: number; count: number; completedCount: number }
  >();

  for (const b of branches) {
    branchMetricsMap.set(b.id, {
      branchId: b.id,
      name: b.name,
      revenue: 0,
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
      entry = { branchId: bid, name: bname, revenue: 0, count: 0, completedCount: 0 };
      branchMetricsMap.set(bid, entry);
    }
    if (!["cancelled", "no_show"].includes(r.status)) {
      entry.count++;
    }
    if (r.status === "completed") {
      entry.completedCount++;
      entry.revenue += readPricePaid(r.metadata);
    }
  }

  const revenueData: RevenueByBranchItem[] = Array.from(branchMetricsMap.values())
    .map((item) => {
      const share = canonicalRevenue > 0 ? Math.round((item.revenue / canonicalRevenue) * 100) : 0;
      const avgBookingValue = item.completedCount > 0 ? item.revenue / item.completedCount : 0;
      return {
        ...item,
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
      const rev = readPricePaid(r.metadata);
      entry.completedCount++;
      entry.revenue += rev;

      const bid = r.branch_id ?? "unknown";
      entry.branchSeries[bid] = (entry.branchSeries[bid] ?? 0) + rev;
    }
    if (r.payment_status === "paid") {
      entry.collected += Number(r.amount_paid ?? 0);
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

  for (const r of paidBookings) {
    const rawMethod = (r.payment_method ?? "other").toLowerCase();
    const key = (rawMethod in methodMap ? rawMethod : "other") as PaymentMethodKey;
    const amount = Number(r.amount_paid ?? 0);
    const target = methodMap[key];
    if (target) {
      target.amount += amount;
      target.count += 1;
    }
  }

  const totalCollectedPayment = Object.values(methodMap).reduce((s, m) => s + m.amount, 0);
  const totalTransactionsCount = Object.values(methodMap).reduce((s, m) => s + m.count, 0);

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
    const rev = readPricePaid(r.metadata);

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
    entry.revenue += rev;
    const bid = r.branch_id ?? "unknown";
    entry.branchBreakdown[bid] = (entry.branchBreakdown[bid] ?? 0) + 1;

    let catEntry = categoryMixMap.get(catName);
    if (!catEntry) {
      catEntry = { count: 0, revenue: 0 };
      categoryMixMap.set(catName, catEntry);
    }
    catEntry.count++;
    catEntry.revenue += rev;
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

    let entry = staffStatsMap.get(sid);
    if (!entry) {
      entry = {
        staffId: sid,
        name: staff ? getStaffAdminName(staff) : sid,
        tier: staff?.tier ?? "-",
        branchId: staff?.branch_id ?? r.branch_id ?? undefined,
        total: 0,
        completed: 0,
        revenue: 0,
        serviceCounts: {},
      };
      staffStatsMap.set(sid, entry);
    }

    if (!["cancelled", "no_show"].includes(r.status)) {
      entry.total++;
    }
    if (r.status === "completed") {
      entry.completed++;
      entry.revenue += readPricePaid(r.metadata);

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
      transactions: t.count,
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
      transactions: t.count,
    }));

  // 12. Master Sheet Operational Evidence (External, read-only)
  let sheetEvidence: MasterSheetEvidenceSummary = {
    status: "unavailable",
    observedAt: new Date().toISOString(),
    totalRecords: 0,
    visitCount: 0,
    dutyCount: 0,
    needsReviewCount: 0,
    evidenceAmount: 0,
    effectOnCanonicalTotals: 0,
  };

  try {
    const sheetReviewResult = await loadMasterSheetReview();
    if (sheetReviewResult.status === "available") {
      const cur = sheetReviewResult.current;
      const prev = sheetReviewResult.previous;
      const allVisits = [...(cur?.visits ?? []), ...(prev?.visits ?? [])];
      const allDuties = [...(cur?.duties ?? []), ...(prev?.duties ?? [])];
      const allReviews = [...(cur?.review ?? []), ...(prev?.review ?? [])];

      let evidenceAmount = 0;
      for (const v of allVisits) {
        for (const fe of v.financialEvidence) {
          if (fe.amount && Number.isFinite(fe.amount)) {
            evidenceAmount += fe.amount;
          }
        }
      }

      const recentVisits = allVisits.slice(0, 15).map((v, idx) => ({
        id: `visit-${idx}-${v.source.sourceKey}`,
        date: v.businessDate,
        time: v.time,
        customer: v.customerDisplay,
        attendant: v.staffDisplay,
        services: v.services.map((s) => s.name).join(", ") || "Unspecified",
        channel: v.financialEvidence.map((f) => f.channel).join(", ") || "Unrecorded",
        amount: v.financialEvidence.reduce((sum, f) => sum + (f.amount ?? 0), 0) || null,
        reasons: v.reviewReasons,
        source: `${v.source.sheetName} (r${v.source.startRow}-${v.source.endRow})`,
      }));

      const recentReviews = allReviews.slice(0, 15).map((r, idx) => ({
        id: `review-${idx}-${r.source.sourceKey}`,
        date: r.businessDate,
        classification: r.classification,
        reasons: r.reviewReasons,
        source: `${r.source.sheetName} (r${r.source.startRow}-${r.source.endRow})`,
      }));

      sheetEvidence = {
        status: "available",
        observedAt: sheetReviewResult.observedAt,
        totalRecords: allVisits.length + allDuties.length + allReviews.length,
        visitCount: allVisits.length,
        dutyCount: allDuties.length,
        needsReviewCount: allReviews.length,
        evidenceAmount,
        effectOnCanonicalTotals: 0,
        recentVisits,
        recentReviews,
      };
    } else if (sheetReviewResult.status === "forbidden") {
      sheetEvidence = {
        status: "forbidden",
        observedAt: new Date().toISOString(),
        totalRecords: 0,
        visitCount: 0,
        dutyCount: 0,
        needsReviewCount: 0,
        evidenceAmount: 0,
        effectOnCanonicalTotals: 0,
      };
    }
  } catch {
    // Fail closed: preserve canonical reports
    sheetEvidence = {
      status: "unavailable",
      observedAt: new Date().toISOString(),
      totalRecords: 0,
      visitCount: 0,
      dutyCount: 0,
      needsReviewCount: 0,
      evidenceAmount: 0,
      effectOnCanonicalTotals: 0,
    };
  }

  // 13. Backwards-compatible legacy cashSummary
  const legacyCashSummary = {
    fromDate: from,
    toDate: to,
    total_expected: canonicalRevenue,
    total_collected: collectedPayments,
    total_unpaid: Math.max(0, canonicalRevenue - collectedPayments),
    paid_count: paidBookings.length,
    unpaid_count: Math.max(0, totalBookings - paidBookings.length),
    total_count: totalBookings,
    by_method: {
      cash: methodMap.cash?.amount ?? 0,
      gcash: methodMap.gcash?.amount ?? 0,
      maya: methodMap.maya?.amount ?? 0,
      card: methodMap.card?.amount ?? 0,
      pay_on_site: methodMap.pay_on_site?.amount ?? 0,
      other: methodMap.other?.amount ?? 0,
    },
  };

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
    sheetEvidence,
    cashSummary: legacyCashSummary,
  };
}
