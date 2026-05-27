import { PageHeader } from "@/components/features/dashboard/page-header";
import { ScheduleSetupWorkspace } from "@/components/features/staff-schedule/schedule-setup-workspace";
import { BranchSwitcher } from "@/components/features/staff-schedule/branch-switcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getAllBranches } from "@/lib/queries/branches";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import { getScheduleSetupOverview } from "@/lib/queries/staff-schedule-groups";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/super-admin";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";

// ── Helpers ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canSwitchBranches(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  if (isSuperAdmin(user.id)) return true;

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  return me?.system_role === "owner";
}

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
    return {
      items: [],
      groups: [],
      rulesByGroup: {},
      error: "Failed to load schedule setup data. Please refresh.",
    };
  }
}

// ── Action buttons ─────────────────────────────────────────────────────────

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

export default async function ManagerStaffAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const [params, defaultBranchId, ownerAccess] = await Promise.all([
    searchParams,
    getManagerBranchId(),
    canSwitchBranches(),
  ]);

  let branchId = defaultBranchId;
  let branches: { id: string; name: string }[] = [];

  if (ownerAccess) {
    branches = await getAllBranches();
    const requested = params.branch;
    if (
      requested &&
      UUID_RE.test(requested) &&
      branches.some((b) => b.id === requested)
    ) {
      branchId = requested;
    }
  }

  const { items, groups, rulesByGroup, error } = await getPageData(branchId);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Schedule Setup"
        description="Configure universal schedules by staff group, then customize individual schedules only when needed."
        action={<PageActions />}
      />

      {ownerAccess && branches.length > 1 && (
        <BranchSwitcher branches={branches} currentBranchId={branchId} />
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load staff data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <ScheduleSetupWorkspace
          items={items}
          groups={groups}
          rulesByGroup={rulesByGroup}
          branchId={branchId}
        />
      )}
    </section>
  );
}
