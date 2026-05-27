import { PageHeader } from "@/components/features/dashboard/page-header";
import { ScheduleSetupWorkspace } from "@/components/features/staff-schedule/schedule-setup-workspace";
import { ScheduleSetupHealthSummary } from "@/components/features/staff-schedule/schedule-setup-health-summary";
import { ManualScheduleImport } from "@/components/features/staff-schedule/manual-schedule-import";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import { getScheduleSetupOverview } from "@/lib/queries/staff-schedule-groups";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";

async function getPageData(branchId: string): Promise<{
  items: StaffScheduleItem[];
  groups: Awaited<ReturnType<typeof getScheduleSetupOverview>>["groups"];
  rulesByGroup: Awaited<ReturnType<typeof getScheduleSetupOverview>>["rulesByGroup"];
  error: string | null;
}> {
  try {
    const [items, overview] = await Promise.all([
      getStaffWithAvailability(branchId),
      getScheduleSetupOverview(branchId),
    ]);
    return {
      items: items as unknown as StaffScheduleItem[],
      groups: overview.groups,
      rulesByGroup: overview.rulesByGroup,
      error: null,
    };
  } catch (err) {
    console.error("[crm/staff-availability] load failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { items: [], groups: [], rulesByGroup: {}, error: "Failed to load schedule setup data. Please refresh." };
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function CrmStaffAvailabilityPage() {
  const branchId = await getManagerBranchId();
  const { items, groups, rulesByGroup, error } = await getPageData(branchId);

  // Shape staff list for the manual import component (name matching only needs id/name/nickname/active)
  const staffForImport = items.map((i) => ({
    id: i.staff.id,
    full_name: i.staff.full_name,
    nickname: i.staff.nickname ?? null,
    is_active: i.staff.is_active,
  }));

  return (
    <section className="space-y-5">
      <PageHeader
        title="Schedule Setup Center"
        description="Set staff schedules, day-offs, and blocked time used by online booking, walk-ins, and home-service planning."
      />

      {/* Compact MVP info bar */}
      {!error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--cs-r-sm,8px)",
            background: "rgba(41,128,185,0.05)",
            border: "1px solid rgba(41,128,185,0.2)",
            fontSize: "0.8125rem",
            color: "var(--cs-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "var(--cs-info,#2980b9)" }}>MVP Note:</strong>{" "}
          Online booking follows saved schedules, blocked time, service assignments, existing bookings, and booking rules.
          Daily staff check-in/check-out is paused for MVP.
        </div>
      )}

      {/* Quick-glance health stats */}
      {!error && (
        <ScheduleSetupHealthSummary items={items} groups={groups} />
      )}

      {/* 2026 manual paper schedule import — collapsible, match names then apply */}
      {!error && (
        <ManualScheduleImport branchId={branchId} staff={staffForImport} />
      )}

      {/* Main workspace — 4-tab editor */}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load staff data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <ScheduleSetupWorkspace items={items} groups={groups} rulesByGroup={rulesByGroup} />
      )}
    </section>
  );
}
