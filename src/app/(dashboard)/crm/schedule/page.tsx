import { ScheduleWorkspace } from "@/components/features/schedule/schedule-workspace";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { getManagerContext } from "@/lib/queries/manager-context";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";

export default async function CRMSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { branchId, branchName } = await getManagerContext();
  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0]!;
  const selectedDate = params.date ?? today;
  const supabase = await createClient();

  const [scheduleRows, stats, resourcesResult] = await Promise.all([
    getDailySchedule({ branchId, date: selectedDate }),
    getManagerDashboardStats(branchId, selectedDate),
    supabase
      .from("branch_resources")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <ScheduleWorkspace
      workspaceContext="crm"
      viewerRole="crm"
      branchId={branchId}
      branchName={branchName}
      date={selectedDate}
      branches={[{ id: branchId, name: branchName }]}
      staffRows={scheduleRows}
      branchResources={resourcesResult.data ?? []}
      stats={stats}
      viewBookingsHref="/crm/bookings"
      paymentAction={updateBookingPaymentAction}
    />
  );
}
