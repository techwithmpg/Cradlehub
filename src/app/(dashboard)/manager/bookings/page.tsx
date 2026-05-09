import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getTodaysSchedule, getDailyPaymentSummary } from "@/lib/queries/bookings";
import { BookingsWorkspace } from "@/components/features/bookings/bookings-workspace";
import type { WorkspaceBookingRow } from "@/components/features/bookings/bookings-workspace";

async function getManagerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const allowedRoles = ["owner", "manager", "assistant_manager", "store_manager"];

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return { branchId: mock.branch_id, branchName: mock.branches.name, systemRole: mock.system_role };
  }

  if (!me?.branch_id || !allowedRoles.includes(me.system_role)) redirect("/login");

  return {
    branchId:   me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
    systemRole: me.system_role,
  };
}

export default async function ManagerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; type?: string; search?: string }>;
}) {
  const { branchId, branchName, systemRole } = await getManagerContext();
  const params = await searchParams;
  const today  = new Date().toISOString().split("T")[0]!;
  const date   = params.date ?? today;

  const [rawBookings, cashSummary] = await Promise.all([
    getTodaysSchedule(branchId, date),
    getDailyPaymentSummary(branchId, date),
  ]);

  let bookings = rawBookings as WorkspaceBookingRow[];
  if (params.status) bookings = bookings.filter((b) => b.status === params.status);
  if (params.type)   bookings = bookings.filter((b) => b.type   === params.type);

  return (
    <BookingsWorkspace
      workspaceContext="manager"
      viewerRole={systemRole}
      branchName={branchName}
      date={date}
      statusFilter={params.status}
      typeFilter={params.type}
      search={params.search}
      bookings={bookings}
      cashSummary={cashSummary}
    />
  );
}
