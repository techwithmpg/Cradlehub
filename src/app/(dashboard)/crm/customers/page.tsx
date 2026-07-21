import { getCrmContext } from "@/lib/queries/crm-context";
import {
  getCustomersPage,
  getRepeatCustomers,
  getLapsedCustomers,
  getCrmStats,
} from "@/lib/queries/customers";
import { getWaitlistAction } from "@/app/(dashboard)/crm/waitlist/actions";
import { CustomersWorkspace } from "@/components/features/crm/customers/customers-workspace";
import type { CustomerTab } from "@/components/features/crm/customers/customer-segment-tabs";
import type { CustomerListItem } from "@/components/features/crm/customers/lib/customer-segments";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";
import type { KpiData } from "@/components/features/crm/customers/customer-kpi-row";
import { isThisMonth, isToday, isThisWeek, daysSinceDate } from "@/components/features/crm/customers/lib/customer-segments";
import { RetainedWorkspaceModule } from "@/components/features/dashboard/retained-workspace-provider";

const VALID_TABS: CustomerTab[] = ["all", "repeat", "lapsed", "followup"];

function parseTab(raw: string | undefined): CustomerTab {
  if (raw && VALID_TABS.includes(raw as CustomerTab)) return raw as CustomerTab;
  return "all";
}

export default async function CrmCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const { branchId } = await getCrmContext();
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const search = sp.q?.trim() || undefined;

  const pageParam = Number(sp.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  let allCustomers: CustomerListItem[] = [];
  let repeatCustomers: CustomerListItem[] = [];
  let lapsedCustomers: CustomerListItem[] = [];
  let waitlistRows: WaitlistRow[] = [];
  let totalPages = 1;

  // Fetch tab-specific data
  if (tab === "all") {
    const result = await getCustomersPage({ branchId, search, page, pageSize: 25 });
    allCustomers = result.data as CustomerListItem[];
    totalPages = result.pageCount;
  } else if (tab === "repeat") {
    const result = await getRepeatCustomers(2, page, 25, branchId);
    repeatCustomers = (result.customers as unknown as CustomerListItem[]) ?? [];
    totalPages = Math.max(1, Math.ceil(result.total / 25));
  } else if (tab === "lapsed") {
    const result = await getLapsedCustomers(30, 50, branchId);
    lapsedCustomers = (result as unknown as CustomerListItem[]) ?? [];
    totalPages = 1;
  } else if (tab === "followup") {
    const result = await getWaitlistAction(branchId ?? "");
    if (result.ok) {
      waitlistRows = (result.data as WaitlistRow[]) ?? [];
    }
  }

  // Base stats
  const stats = await getCrmStats(branchId);

  // Compute KPI data
  const kpiData: KpiData = {
    totalCustomers: stats.total,
    repeatClients: stats.repeat,
    lapsedClients: stats.lapsed,
    newThisMonth: stats.newThisMonth,
    totalVisits: stats.totalVisits,
  };

  if (tab === "repeat") {
    const totalVisitsRepeat = repeatCustomers.reduce((s, c) => s + (c.total_bookings ?? 0), 0);
    kpiData.repeatClients = repeatCustomers.length;
    kpiData.avgVisits = repeatCustomers.length > 0 ? Math.round((totalVisitsRepeat / repeatCustomers.length) * 10) / 10 : 0;
    kpiData.mostBookedService = null; // Would need bookings data per customer
    kpiData.returningThisMonth = repeatCustomers.filter((c) => c.last_booking_date && isThisMonth(c.last_booking_date)).length;
    kpiData.avgSpend = null;
  }

  if (tab === "lapsed") {
    kpiData.lapsedClients = lapsedCustomers.length;
    kpiData.inactive30Plus = lapsedCustomers.filter((c) => c.last_booking_date && daysSinceDate(c.last_booking_date) >= 30).length;
    kpiData.inactive60Plus = lapsedCustomers.filter((c) => c.last_booking_date && daysSinceDate(c.last_booking_date) >= 60).length;
    kpiData.followUpsNeeded = lapsedCustomers.length;
    kpiData.recoveryBookings = null;
  }

  if (tab === "followup") {
    kpiData.onWaitlist = waitlistRows.filter((r) => r.status === "waiting").length;
    kpiData.followUpToday = waitlistRows.filter((r) => r.preferred_date && isToday(r.preferred_date)).length;
    kpiData.thisWeek = waitlistRows.filter((r) => r.preferred_date && isThisWeek(r.preferred_date)).length;
    kpiData.convertedThisMonth = waitlistRows.filter((r) => r.status === "converted" && isThisMonth(r.created_at)).length;
    kpiData.highPriority = waitlistRows.filter((r) => r.status === "waiting" && daysSinceDate(r.created_at) > 3).length;
  }

  return (
    <RetainedWorkspaceModule moduleId="crm-customers">
      <CustomersWorkspace
        tab={tab}
        allCustomers={allCustomers}
        repeatCustomers={repeatCustomers}
        lapsedCustomers={lapsedCustomers}
        waitlistRows={waitlistRows}
        kpiData={kpiData}
        page={page}
        totalPages={totalPages}
        search={search}
      />
    </RetainedWorkspaceModule>
  );
}
