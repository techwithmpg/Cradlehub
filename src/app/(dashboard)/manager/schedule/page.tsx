import { PageHeader } from "@/components/features/dashboard/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import {
  ScheduleTimeline,
  type TimelineBooking,
  type TimelineStaffMember,
} from "@/components/features/dashboard/schedule-timeline";
import { getTodaysSchedule, getManagerDashboardStats } from "@/lib/queries/bookings";
import { getStaffByBranch } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function getManagerBranchId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!me?.branch_id) redirect("/login");
  return me.branch_id as string;
}

export default async function ManagerSchedulePage() {
  const branchId = await getManagerBranchId();
  const today = new Date().toISOString().split("T")[0]!;

  const [bookings, stats, staff] = await Promise.all([
    getTodaysSchedule(branchId, today),
    getManagerDashboardStats(branchId, today),
    getStaffByBranch(branchId),
  ]);

  return (
    <div>
      <PageHeader
        title="Today's Schedule"
        description={new Date().toLocaleDateString("en-PH", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        icon="🗓️"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.625rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatCard label="Total" value={stats.total} accent />
        <StatCard label="Confirmed" value={stats.confirmed} />
        <StatCard label="In Progress" value={stats.in_progress} />
        <StatCard label="Completed" value={stats.completed} accent />
        <StatCard label="No Shows" value={stats.no_show} />
      </div>

      {staff.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
          }}
        >
          No active staff at this branch yet. Add staff from the owner workspace.
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <ScheduleTimeline
            bookings={bookings as TimelineBooking[]}
            staff={staff as TimelineStaffMember[]}
            date={today}
          />
        </div>
      )}
    </div>
  );
}
