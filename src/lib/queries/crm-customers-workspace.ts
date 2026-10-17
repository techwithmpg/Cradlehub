import "server-only";

import {
  getCustomersPage,
  getRepeatCustomers,
  getLapsedCustomers,
  getCrmStats,
} from "@/lib/queries/customers";
import { getWaitlistAction } from "@/app/(dashboard)/crm/waitlist/actions";
import {
  isThisMonth,
  isToday,
  isThisWeek,
  daysSinceDate,
} from "@/components/features/crm/customers/lib/customer-segments";
import type { CustomerListItem } from "@/components/features/crm/customers/lib/customer-segments";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import type { KpiData } from "@/components/features/crm/customers/customer-kpi-row";
import type {
  CrmCustomersWorkspaceData,
  CrmCustomersWorkspaceRequest,
} from "@/components/features/crm/customers/customer-workspace-data";

function emptyKpis(): KpiData {
  return {
    totalCustomers: 0,
    repeatClients: 0,
    lapsedClients: 0,
    newThisMonth: 0,
    totalVisits: 0,
  };
}

export async function loadCrmCustomersWorkspaceData(params: {
  branchId?: string | null;
  request: CrmCustomersWorkspaceRequest;
}): Promise<CrmCustomersWorkspaceData> {
  const { branchId, request } = params;
  const { tab, page, search } = request;

  let allCustomers: CustomerListItem[] = [];
  let repeatCustomers: CustomerListItem[] = [];
  let lapsedCustomers: CustomerListItem[] = [];
  let waitlistRows: WaitlistRow[] = [];
  let totalPages = 1;
  const kpiData = emptyKpis();

  if (tab === "all") {
    const [result, stats] = await Promise.all([
      getCustomersPage({ branchId, search, page, pageSize: 25 }),
      getCrmStats(branchId),
    ]);

    allCustomers = result.data as CustomerListItem[];
    totalPages = result.pageCount;
    kpiData.totalCustomers = stats.total;
    kpiData.repeatClients = stats.repeat;
    kpiData.lapsedClients = stats.lapsed;
    kpiData.newThisMonth = stats.newThisMonth;
    kpiData.totalVisits = stats.totalVisits;
  } else if (tab === "repeat") {
    const result = await getRepeatCustomers(2, page, 25, branchId);
    repeatCustomers = (result.customers as unknown as CustomerListItem[]) ?? [];
    totalPages = Math.max(1, Math.ceil(result.total / 25));

    const totalVisitsRepeat = repeatCustomers.reduce(
      (sum, customer) => sum + (customer.total_bookings ?? 0),
      0
    );
    kpiData.repeatClients = repeatCustomers.length;
    kpiData.avgVisits =
      repeatCustomers.length > 0
        ? Math.round((totalVisitsRepeat / repeatCustomers.length) * 10) / 10
        : 0;
    kpiData.mostBookedService = null;
    kpiData.returningThisMonth = repeatCustomers.filter(
      (customer) =>
        customer.last_booking_date && isThisMonth(customer.last_booking_date)
    ).length;
    kpiData.avgSpend = null;
  } else if (tab === "lapsed") {
    const result = await getLapsedCustomers(30, 50, branchId);
    lapsedCustomers = (result as unknown as CustomerListItem[]) ?? [];

    kpiData.lapsedClients = lapsedCustomers.length;
    kpiData.inactive30Plus = lapsedCustomers.filter(
      (customer) =>
        customer.last_booking_date &&
        daysSinceDate(customer.last_booking_date) >= 30
    ).length;
    kpiData.inactive60Plus = lapsedCustomers.filter(
      (customer) =>
        customer.last_booking_date &&
        daysSinceDate(customer.last_booking_date) >= 60
    ).length;
    kpiData.followUpsNeeded = lapsedCustomers.length;
    kpiData.recoveryBookings = null;
  } else {
    const result = await getWaitlistAction(branchId ?? "");
    if (result.ok) {
      waitlistRows = (result.data as WaitlistRow[]) ?? [];
    }

    kpiData.onWaitlist = waitlistRows.filter((row) => row.status === "waiting").length;
    kpiData.followUpToday = waitlistRows.filter(
      (row) => row.preferred_date && isToday(row.preferred_date)
    ).length;
    kpiData.thisWeek = waitlistRows.filter(
      (row) => row.preferred_date && isThisWeek(row.preferred_date)
    ).length;
    kpiData.convertedThisMonth = waitlistRows.filter(
      (row) => row.status === "converted" && isThisMonth(row.created_at)
    ).length;
    kpiData.highPriority = waitlistRows.filter(
      (row) => row.status === "waiting" && daysSinceDate(row.created_at) > 3
    ).length;
  }

  return {
    tab,
    page,
    search,
    allCustomers,
    repeatCustomers,
    lapsedCustomers,
    waitlistRows,
    kpiData,
    totalPages,
  };
}
