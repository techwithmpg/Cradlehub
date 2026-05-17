import { getTodaysSchedule } from "@/lib/queries/bookings";
import { getStaffByBranch, getStaffByBranchWithBranches, getPendingStaffByBranch } from "@/lib/queries/staff";
import { getBranchById } from "@/lib/queries/branches";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getDailySchedule } from "@/lib/queries/schedule";
import { computeStaffAvailability, type TodayBooking } from "@/components/features/manager-today/manager-today-utils";
import { ManagerTodayWorkspace } from "@/components/features/manager-today/manager-today-workspace";
import { ManagerMobileWorkspace } from "@/components/features/manager/mobile/manager-mobile-workspace";
import { WorkspaceAttentionStrip } from "@/components/features/notifications/workspace-attention-strip";
import { getOpenWorkflowTasksAction } from "@/lib/notifications/workflow-queries";
import { ScheduleHealthPanel } from "@/components/features/scheduling/schedule-health-panel";
import { SuggestionsReviewPanel } from "@/components/features/scheduling/suggestions-review-panel";
import { createClient } from "@/lib/supabase/server";
import { getStaffAdminName } from "@/lib/staff/display-name";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type { ScheduleHealthCheck, ScheduleSuggestion } from "@/lib/scheduling/types";

async function getManagerStaffId(branchId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("branch_id", branchId)
    .maybeSingle();
  return data?.id ?? null;
}

async function getTodayHealthAndSuggestions(branchId: string, date: string) {
  const supabase = await createClient();
  const [{ data: health }, { data: rawSuggestions }] = await Promise.all([
    supabase
      .from("schedule_health_checks")
      .select("*")
      .eq("branch_id", branchId)
      .eq("check_date", date)
      .maybeSingle(),
    supabase
      .from("schedule_suggestions")
      .select("*")
      .eq("branch_id", branchId)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("target_date", { ascending: true })
      .limit(20),
  ]);

  // Hydrate staff names in a second pass to avoid FK ambiguity
  const staffIds = [...new Set((rawSuggestions ?? []).map((s) => s.staff_id).filter(Boolean))] as string[];
  const staffMap: Map<string, { full_name: string; nickname: string | null; system_role: string }> = new Map();
  if (staffIds.length > 0) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, full_name, nickname, system_role")
      .in("id", staffIds);
    for (const sr of staffRows ?? []) {
      staffMap.set(sr.id, {
        full_name: getStaffAdminName(sr),
        nickname: sr.nickname,
        system_role: sr.system_role,
      });
    }
  }

  const suggestions = (rawSuggestions ?? []).map((s) => ({
    ...s,
    staff: s.staff_id ? (staffMap.get(s.staff_id) ?? null) : null,
  }));

  return { health, suggestions };
}

export default async function ManagerTodayPage() {
  const branchId = await getManagerBranchId();
  const today = new Date().toISOString().split("T")[0]!;

  const [branch, bookingsRaw, staffRaw, scheduleRows, allStaff, pendingStaff, workflowTasks, schedulingData, managerStaffId] = await Promise.all([
    getBranchById(branchId),
    getTodaysSchedule(branchId, today),
    getStaffByBranch(branchId),
    getDailySchedule({ branchId, date: today }),
    getStaffByBranchWithBranches(branchId),
    getPendingStaffByBranch(branchId),
    getOpenWorkflowTasksAction(5),
    getTodayHealthAndSuggestions(branchId, today),
    getManagerStaffId(branchId),
  ]);

  const bookings = bookingsRaw as TodayBooking[];
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const staffAvailability = computeStaffAvailability(
    staffRaw.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      nickname: s.nickname,
      tier: s.tier ?? null,
      staff_type: s.staff_type ?? null,
    })),
    bookings,
    nowMins
  );

  const branchName = branch?.name ?? "Your Branch";
  const todayLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <WorkspaceAttentionStrip title="Today needs attention" tasks={workflowTasks} />
        <ManagerTodayWorkspace
          branchName={branchName}
          todayLabel={todayLabel}
          bookings={bookings}
          staff={staffAvailability}
          userRole="manager"
        />

        {/* Schedule health + suggestions below the main workspace */}
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 "1.5rem",
            alignItems:          "start",
            marginTop:           "1.5rem",
          }}
        >
          <ScheduleHealthPanel
            health={schedulingData.health as ScheduleHealthCheck | null}
            date={today}
          />
          <SuggestionsReviewPanel
            suggestions={schedulingData.suggestions as unknown as (ScheduleSuggestion & { staff?: { full_name: string; nickname?: string | null; system_role: string } | null })[]}
            managerStaffId={managerStaffId ?? ""}
          />
        </div>
      </div>

      {/* Mobile */}
      <div className="block md:hidden">
        <WorkspaceAttentionStrip title="Today needs attention" tasks={workflowTasks} />
        <ManagerMobileWorkspace
          branchName={branchName}
          todayLabel={todayLabel}
          bookings={bookings}
          staff={staffAvailability}
          scheduleRows={scheduleRows}
          allStaff={allStaff as StaffMember[]}
          pendingStaff={pendingStaff as StaffMember[]}
          userRole="manager"
        />
      </div>
    </>
  );
}
