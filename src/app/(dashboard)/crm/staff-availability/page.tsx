import { PageHeader } from "@/components/features/dashboard/page-header";
import { ScheduleSetupWorkspace } from "@/components/features/staff-schedule/schedule-setup-workspace";
import { ScheduleSetupHealthSummary } from "@/components/features/staff-schedule/schedule-setup-health-summary";
import { ManualScheduleImport } from "@/components/features/staff-schedule/manual-schedule-import";
import { BranchSwitcher } from "@/components/features/staff-schedule/branch-switcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getAllBranches } from "@/lib/queries/branches";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import { getScheduleSetupOverview } from "@/lib/queries/staff-schedule-groups";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/super-admin";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import { CrmTabNav, SCHEDULE_TABS } from "@/components/features/crm/crm-tab-nav";

// ── Helpers ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns true for owners and super-admins — the only roles that can
 * view and configure staff from branches other than their own.
 */
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
    console.error("[crm/staff-availability] load failed", {
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

// ── Page ───────────────────────────────────────────────────────────────────

export default async function CrmStaffAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const [params, defaultBranchId, ownerAccess] = await Promise.all([
    searchParams,
    getManagerBranchId(),
    canSwitchBranches(),
  ]);

  // Owners may switch to any active branch via ?branch=<uuid>
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

      <CrmTabNav tabs={SCHEDULE_TABS} activeHref="/crm/staff-availability" />

      {/* Branch selector — only shown to owners when there are multiple branches */}
      {ownerAccess && branches.length > 1 && (
        <BranchSwitcher branches={branches} currentBranchId={branchId} />
      )}

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
          Online booking follows saved schedules, blocked time, service assignments,
          existing bookings, and booking rules. Daily staff check-in/check-out is
          paused for MVP.
        </div>
      )}

      {/* Quick-glance health stats */}
      {!error && <ScheduleSetupHealthSummary items={items} groups={groups} />}

      {/* 2026 manual paper schedule import */}
      {!error && (
        <ManualScheduleImport branchId={branchId} staff={staffForImport} />
      )}

      {/* Main workspace */}
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
