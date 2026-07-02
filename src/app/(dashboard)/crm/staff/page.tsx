import { redirect } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllBranches } from "@/lib/queries/branches";
import { getStaffByBranchWithBranches, getPendingStaffByBranch } from "@/lib/queries/staff";
import { getBranchServicesForManagement } from "@/lib/queries/branches";
import { getBranchStaffAndServiceAssignments } from "@/lib/queries/crm-services";
import { CrmStaffWorkspace } from "@/components/features/crm/staff/crm-staff-workspace";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type {
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import {
  getCrmStaffNestedService,
  getCrmStaffServiceId,
} from "@/components/features/crm/staff/service-row-adapter";
import { canReviewStaffOnboarding } from "@/lib/permissions";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";

export const metadata = { title: "Staff | Front Desk" };

async function getCrmStaffPageContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "unauthorized" as const };

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, system_role, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[crm/staff] staff lookup failed", { message: error.message, code: error.code });
    return { status: "unauthorized" as const };
  }

  const resolvedMe =
    (me as { id: string; system_role: string; branch_id: string | null; branches: { name: string } | null } | null) ??
    (isDevAuthBypassEnabled()
      ? {
          id: "dev-bypass-id",
          system_role: getDevBypassLayoutStaff().system_role,
          branch_id: getDevBypassLayoutStaff().branch_id,
          branches: { name: "Dev Branch" },
        }
      : null);

  const canonicalRole = resolvedMe ? canonicalizeSystemRole(resolvedMe.system_role) : null;
  if (!resolvedMe || !canonicalRole || !canAccessCrmWorkspace(canonicalRole)) {
    return { status: "unauthorized" as const };
  }

  if (!resolvedMe.branch_id) {
    return {
      status: "missing_branch" as const,
      branchName: resolvedMe.branches?.name ?? "your assigned branch",
    };
  }

  return {
    status: "ready" as const,
    me: resolvedMe,
    branchId: resolvedMe.branch_id,
    branchName: resolvedMe.branches?.name ?? "Your Branch",
    canReviewOnboarding: canReviewStaffOnboarding(canonicalRole),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CrmStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const [ctx, params] = await Promise.all([
    getCrmStaffPageContext(),
    searchParams,
  ]);

  if (ctx.status === "unauthorized") redirect("/crm");

  const initialTab = ((): "applications" | "management" | "assignments" | "status" => {
    if (params.tab === "applications") return "applications";
    if (params.tab === "management") return "management";
    if (params.tab === "assignments") return "assignments";
    if (params.tab === "status") return "status";
    return "applications";
  })();

  if (ctx.status === "missing_branch") {
    return (
      <section className="space-y-5">
        <PageHeader
          title="Staff"
          description="Manage applications, review team roster, check service assignments, and monitor staff status."
          icon="👥"
        />
        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-sm text-[var(--cs-text-muted)]">
          Your profile is not linked to an active branch. Contact your manager or owner to assign you to a branch.
        </div>
      </section>
    );
  }

  const branchId = ctx.branchId;

  // Fetch data for all tabs in parallel (some may be unused)
  const [
    allStaffResult,
    pendingStaffResult,
    branchesResult,
    servicesResult,
  ] = await Promise.allSettled([
    getStaffByBranchWithBranches(branchId),
    getPendingStaffByBranch(branchId),
    getAllBranches(),
    getBranchServicesForManagement(branchId),
  ]);

  const allStaff = allStaffResult.status === "fulfilled" ? (allStaffResult.value as StaffMember[]) : [];
  const pendingStaff = pendingStaffResult.status === "fulfilled" ? (pendingStaffResult.value as StaffMember[]) : [];
  const branches = branchesResult.status === "fulfilled" ? branchesResult.value : [];

  let activeServices: ServiceLite[] = [];
  let providerStaff: StaffForServicePanel[] = [];
  let providerAssignments: ServiceAssignmentRow[] = [];
  let providerAssignmentsError: string | null = null;

  if (servicesResult.status === "fulfilled") {
    const services = servicesResult.value as ServiceLite[];
    const eligible = services.filter(
      (s) =>
        s.is_active &&
        getCrmStaffNestedService(s) !== null &&
        getCrmStaffServiceId(s) !== null
    );
    activeServices = eligible;
    const activeServiceIds = Array.from(
      new Set(
        eligible
          .map(getCrmStaffServiceId)
          .filter((id): id is string => id !== null)
      )
    );

    if (activeServiceIds.length > 0) {
      try {
        const pa = await getBranchStaffAndServiceAssignments(branchId, activeServiceIds);
        providerStaff = pa.staff;
        providerAssignments = pa.assignments;
      } catch (err) {
        console.error("[crm/staff] provider assignment fetch failed", {
          branchId,
          error: err instanceof Error ? err.message : String(err),
        });
        providerAssignmentsError =
          "Service assignments could not be loaded. Please refresh and try again.";
      }
    }
  } else {
    console.error("[crm/staff] branch services query failed", {
      branchId,
      error: servicesResult.reason instanceof Error
        ? servicesResult.reason.message
        : String(servicesResult.reason),
    });
    providerAssignmentsError =
      "Service assignments could not be loaded. Please refresh and try again.";
  }

  // Onboarding requests stay permission-gated, but are preloaded so the
  // Applications panel can switch internally without a route fetch.
  let onboardingRequests: Awaited<ReturnType<typeof fetchOnboardingRequests>> = [];
  if (ctx.canReviewOnboarding) {
    onboardingRequests = await fetchOnboardingRequests(
      canonicalizeSystemRole(ctx.me.system_role),
      ctx.me.branch_id
    );
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title="Staff"
        description="Manage applications, review team roster, check service assignments, and monitor staff status."
        icon="👥"
      />

      <CrmStaffWorkspace
        initialTab={initialTab}
        branchId={branchId}
        allStaff={allStaff}
        pendingStaff={pendingStaff}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        activeServices={activeServices}
        providerStaff={providerStaff}
        providerAssignments={providerAssignments}
        providerAssignmentsError={providerAssignmentsError}
        onboardingRequests={onboardingRequests}
        reviewerSystemRole={ctx.me.system_role}
        reviewerBranchId={ctx.me.branch_id}
        canReviewOnboarding={ctx.canReviewOnboarding}
      />
    </section>
  );
}

// ── Onboarding requests ───────────────────────────────────────────────────────

async function fetchOnboardingRequests(
  systemRole: string,
  branchId: string | null
) {
  const admin = createAdminClient();
  let query = admin
    .from("staff_onboarding_requests")
    .select("*")
    .eq("status", "submitted");

  if (systemRole !== "owner" && branchId) {
    query = query.eq("requested_branch_id", branchId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("[crm/staff] onboarding fetch failed", error.message);
    return [];
  }
  return data ?? [];
}
