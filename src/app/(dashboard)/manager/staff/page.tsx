import { PageHeader } from "@/components/features/dashboard/page-header";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getStaffByBranch, getStaffSchedule, getStaffOverrides, getBlockedTimes } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScheduleManager } from "@/components/features/dashboard/schedule-manager";
import type { Database } from "@/types/supabase";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type BranchStaff = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  "id" | "full_name" | "tier" | "is_active"
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
    .single();

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
      staffId: member.id,
      schedules: (await getStaffSchedule(member.id)) as ScheduleRow[],
      overrides: (await getStaffOverrides(member.id, fromDate)) as OverrideRow[],
      blockedTimes: (await getBlockedTimes(member.id, fromDate, toDate)) as BlockedTimeRow[],
    }))
  );

  const byStaffId = new Map(schedulesArr.map((item) => [item.staffId, item]));

  return (
    <div>
      <PageHeader
        title="Staff Schedule"
        description="Set weekly hours, overrides, and blocked times"
      />

      {staff.length === 0 ? (
        <EmptyState title="No staff yet" description="Ask the owner to add staff to this branch first." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {staff.map((member) => {
            const details = byStaffId.get(member.id);
            const schedules = details?.schedules ?? [];
            const overrides = details?.overrides ?? [];
            const blockedTimes = details?.blockedTimes ?? [];

            return (
              <div
                key={member.id}
                style={{
                  backgroundColor: "var(--ch-surface)",
                  border: "1px solid var(--ch-border)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "0.875rem 1rem",
                    borderBottom: "1px solid var(--ch-border)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    backgroundColor: "var(--ch-page-bg)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: "var(--ch-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--ch-text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {member.full_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--ch-text)" }}>
                      {member.full_name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>{member.tier}</div>
                  </div>

                  <div style={{ marginLeft: "auto", display: "flex", gap: "0.375rem" }}>
                    {DAY_NAMES.map((day, idx) => {
                      const hasSchedule = schedules.some((schedule) => schedule.day_of_week === idx && schedule.is_active);
                      return (
                        <div
                          key={idx}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            backgroundColor: hasSchedule ? "var(--ch-accent-light)" : "var(--ch-border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.625rem",
                            fontWeight: 600,
                            color: hasSchedule ? "var(--ch-accent)" : "var(--ch-text-subtle)",
                          }}
                        >
                          {day.charAt(0)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <ScheduleManager
                  staffId={member.id}
                  staffName={member.full_name}
                  existingSchedules={schedules}
                  existingOverrides={overrides}
                  existingBlockedTimes={blockedTimes}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
