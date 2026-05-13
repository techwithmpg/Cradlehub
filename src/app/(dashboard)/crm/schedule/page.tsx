import { redirect } from "next/navigation";
import { ScheduleWorkspace } from "@/components/features/schedule/schedule-workspace";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";

async function getCRMContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      branchId: mock.branch_id,
      branchName: mock.branches.name,
    };
  }

  if (!me?.branch_id) redirect("/login");
  return {
    branchId: me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
  };
}

export default async function CRMSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { branchId, branchName } = await getCRMContext();
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
