import { PageHeader } from "@/components/features/dashboard/page-header";
import { ScheduleSetupWorkspace } from "@/components/features/staff-schedule/schedule-setup-workspace";
import { BranchSwitcher } from "@/components/features/staff-schedule/branch-switcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getManagerBranchId } from "@/lib/queries/manager-context";
import { getAllBranches } from "@/lib/queries/branches";
import { getStaffWithAvailability } from "@/lib/queries/staff";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth/super-admin";
import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";

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
  error: string | null;
}> {
  try {
    const items = await getStaffWithAvailability(branchId);
    return {
      items: items as unknown as StaffScheduleItem[],
      error: null,
    };
  } catch (err) {
    console.error("[manager/staff-availability] load failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      items: [],
      error: "Failed to load schedule setup data. Please refresh.",
    };
  }
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

  const { items, error } = await getPageData(branchId);

  return (
    <section className="space-y-5">
      <PageHeader
        title="Schedule Setup"
        description="Configure each staff member's recurring weekly schedule, one-time schedule changes, and blocked time."
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
          branchId={branchId}
        />
      )}
    </section>
  );
}
