import { CrmScheduleView } from "@/components/features/schedule/crm-schedule-view";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { getCrmReadiness } from "@/lib/queries/crm-readiness";
import { createClient } from "@/lib/supabase/server";
import { getManagerContext } from "@/lib/queries/manager-context";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { PageHeader } from "@/components/features/dashboard/page-header";

export default async function CrmSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { branchId, branchName } = await getManagerContext();
  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0]!;
  const selectedDate = params.date ?? today;
  const supabase = await createClient();

  // Fetch initial data for SSR. On return visits, CrmScheduleView serves
  // this data from SWR's in-memory cache instantly and revalidates in background.
  const [staffRows, stats, resourcesResult, readiness] = await Promise.all([
    getDailySchedule({ branchId, date: selectedDate }),
    getManagerDashboardStats(branchId, selectedDate),
    supabase
      .from("branch_resources")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort_order"),
    getCrmReadiness(branchId).catch(() => null),
  ]);

  const initialData = {
    branchId,
    branchName,
    staffRows,
    branchResources: resourcesResult.data ?? [],
    stats,
    readiness,
  };

  return (
    <section className="space-y-5">
      <PageHeader
        title="Schedule"
        description={`${branchName} · Manage staff availability, bookings, and resources.`}
        icon="📅"
      />
      <CrmScheduleView
        initialData={initialData}
        paymentAction={updateBookingPaymentAction}
      />
    </section>
  );
}
