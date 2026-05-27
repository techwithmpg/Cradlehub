import { PageHeader } from "@/components/features/dashboard/page-header";
import { ScheduleSetupWorkspace } from "@/components/features/staff-schedule/schedule-setup-workspace";
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
    console.error("[manager/staff-availability] load failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { items: [], groups: [], rulesByGroup: {}, error: "Failed to load schedule setup data. Please refresh." };
  }
}

// ── Action buttons (disabled placeholders) ─────────────────────────────────

function PageActions() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <button
        type="button"
        disabled
        title="Coverage overview will be available in a future release"
        className="cs-btn cs-btn-secondary cs-btn-sm"
        style={{ opacity: 0.55, cursor: "not-allowed" }}
      >
        📊 Coverage Overview
      </button>
      <button
        type="button"
        disabled
        title="Publish schedules will be available in a future release"
        className="cs-btn cs-btn-primary cs-btn-sm"
        style={{ opacity: 0.55, cursor: "not-allowed" }}
      >
        🚀 Publish Schedules
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function ManagerStaffAvailabilityPage() {
  const branchId = await getManagerBranchId();
  const { items, groups, rulesByGroup, error } = await getPageData(branchId);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Schedule Setup"
        description="Configure universal schedules by staff group, then customize individual schedules only when needed."
        action={<PageActions />}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load staff data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <ScheduleSetupWorkspace items={items} groups={groups} rulesByGroup={rulesByGroup} branchId={branchId} />
      )}
    </section>
  );
}
