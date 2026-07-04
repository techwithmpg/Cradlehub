import { redirect } from "next/navigation";
import { ScheduleWorkspace } from "@/components/features/schedule/schedule-workspace";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getManagerDashboardStats } from "@/lib/queries/bookings";
import { getAllBranches } from "@/lib/queries/branches";
import { createClient } from "@/lib/supabase/server";
import {
  ownerUpdateBookingStatusAction,
  ownerUpdateBookingPaymentAction,
} from "@/app/(dashboard)/owner/bookings/actions";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

async function getOwnerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || me.system_role !== "owner") redirect("/login");
}

export default async function OwnerSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; date?: string }>;
}) {
  await getOwnerContext();

  const params = await searchParams;
  const today = getBranchBusinessDate();
  const [branches] = await Promise.all([getAllBranches()]);

  const selectedBranchId =
    params.branchId && branches.some((b) => b.id === params.branchId)
      ? params.branchId
      : branches[0]?.id ?? "";

  const selectedDate = params.date ?? today;
  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const supabase = await createClient();

  const [scheduleRows, stats, resourcesResult] = await Promise.all([
    selectedBranchId
      ? getDailySchedule({ branchId: selectedBranchId, date: selectedDate })
      : Promise.resolve([]),
    selectedBranchId
      ? getManagerDashboardStats(selectedBranchId, selectedDate)
      : Promise.resolve({ total: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, no_show: 0 }),
    selectedBranchId
      ? supabase
          .from("branch_resources")
          .select("*")
          .eq("branch_id", selectedBranchId)
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
  ]);

  if (branches.length === 0) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "3rem 1.5rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>🏢</div>
        <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
          No branches configured
        </div>
        <div>Create a branch first to view schedules.</div>
      </div>
    );
  }

  return (
    <ScheduleWorkspace
      workspaceContext="owner"
      viewerRole="owner"
      branchId={selectedBranchId}
      branchName={selectedBranch?.name ?? ""}
      date={selectedDate}
      branches={branches}
      staffRows={scheduleRows}
      branchResources={resourcesResult.data ?? []}
      stats={stats}
      viewBookingsHref="/owner/bookings"
      statusAction={ownerUpdateBookingStatusAction}
      paymentAction={ownerUpdateBookingPaymentAction}
    />
  );
}
