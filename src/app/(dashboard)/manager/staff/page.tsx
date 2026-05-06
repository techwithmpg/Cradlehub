import { PageHeader } from "@/components/features/dashboard/page-header";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { StaffSchedulePageClient } from "@/components/features/staff-schedule/staff-schedule-page-client";
import { getStaffByBranch, getStaffSchedule, getStaffOverrides, getBlockedTimes } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/types/supabase";

type BranchStaff = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  "id" | "full_name" | "tier" | "is_active" | "staff_type" | "is_head"
>;

type ScheduleRow = Database["public"]["Tables"]["staff_schedules"]["Row"];
type OverrideRow = Database["public"]["Tables"]["schedule_overrides"]["Row"];
type BlockedTimeRow = Database["public"]["Tables"]["blocked_times"]["Row"];

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
    .eq("is_active", true)
    .maybeSingle();

  if (!me?.branch_id) redirect("/login");
  return me.branch_id as string;
}

export default async function ManagerStaffPage() {
  const branchId = await getManagerBranchId();
  const staff = (await getStaffByBranch(branchId)) as BranchStaff[];

  const fromDate = new Date().toISOString().split("T")[0]!;
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const toDate = future.toISOString().split("T")[0]!;

  const schedulesArr = await Promise.all(
    staff.map(async (member) => ({
      staff: {
        id: member.id,
        full_name: member.full_name,
        tier: member.tier,
        staff_type: member.staff_type,
        is_head: member.is_head,
        is_active: member.is_active,
      },
      schedules: (await getStaffSchedule(member.id)) as ScheduleRow[],
      overrides: (await getStaffOverrides(member.id, fromDate)) as OverrideRow[],
      blockedTimes: (await getBlockedTimes(member.id, fromDate, toDate)) as BlockedTimeRow[],
    }))
  );

  return (
    <div>
      <PageHeader
        title="Staff Schedule"
        description="Set weekly hours, overrides, and blocked times"
      />

      {staff.length === 0 ? (
        <EmptyState
          title="No staff yet"
          description="Ask the owner to add staff to this branch first."
        />
      ) : (
        <StaffSchedulePageClient items={schedulesArr} />
      )}
    </div>
  );
}
