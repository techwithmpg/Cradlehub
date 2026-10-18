import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllBranches } from "@/lib/queries/branches";
import {
  getStaffByBranchWithBranches,
  getPendingStaffByBranch,
} from "@/lib/queries/staff";
import {
  getBranchStaffAndServiceAssignments,
  type ServiceAssignmentRow,
  type StaffForServicePanel,
} from "@/lib/queries/crm-services";
import { getBranchAssignableServices } from "@/lib/services/service-catalog";
import {
  getCrmStaffNestedService,
  getCrmStaffServiceId,
} from "@/components/features/crm/staff/service-row-adapter";
import { canReviewStaffOnboarding } from "@/lib/permissions";
import { getBranchAssignmentIssuesForActor } from "@/lib/staff/branch-assignment-resolver";
import {
  isDevAuthBypassEnabled,
  getDevBypassLayoutStaff,
} from "@/lib/dev-bypass";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type {
  CrmStaffOnboardingRequest,
  CrmStaffWorkspaceData,
} from "@/components/features/crm/staff/crm-staff-workspace-data";

export type CrmStaffWorkspaceLoadResult =
  | { status: "unauthorized" }
  | { status: "missing_branch"; branchName: string }
  | { status: "ready"; data: CrmStaffWorkspaceData };

async function getCrmStaffPageContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthorized" as const };

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, system_role, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[crm/staff] staff lookup failed", {
      message: error.message,
      code: error.code,
    });
    return { status: "unauthorized" as const };
  }

  const resolvedMe =
    (me as {
      id: string;
      system_role: string;
      branch_id: string | null;
      branches: { name: string } | null;
    } | null) ??
    (isDevAuthBypassEnabled()
      ? {
          id: "dev-bypass-id",
          system_role: getDevBypassLayoutStaff().system_role,
          branch_id: getDevBypassLayoutStaff().branch_id,
          branches: { name: "Dev Branch" },
        }
      : null);

  const canonicalRole = resolvedMe
    ? canonicalizeSystemRole(resolvedMe.system_role)
    : null;

  if (
    !resolvedMe ||
    !canonicalRole ||
    !canAccessCrmWorkspace(canonicalRole)
  ) {
    return { status: "unauthorized" as const };
  }

  if (!resolvedMe.branch_id) {
    return {
      status: "missing_branch" as const,
      branchName: resolvedMe.branches?.name ?? "your assigned branch",
    };
  }

  const frontDesk = await getFrontDeskContext();

  return {
    status: "ready" as const,
    me: resolvedMe,
    branchId: frontDesk.branchId,
    branchName: frontDesk.branchName,
    canReviewOnboarding: canReviewStaffOnboarding(canonicalRole),
  };
}

async function fetchOnboardingRequests(
  systemRole: string,
  branchId: string | null
): Promise<CrmStaffOnboardingRequest[]> {
  const admin = createAdminClient();
  let query = admin
    .from("staff_onboarding_requests")
    .select("*")
    .eq("status", "submitted");

  if (systemRole !== "owner" && branchId) {
    query = query.eq("requested_branch_id", branchId);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  if (error) {
    console.error("[crm/staff] onboarding fetch failed", error.message);
    return [];
  }
  return (data ?? []) as CrmStaffOnboardingRequest[];
}

export async function loadCrmStaffWorkspaceData(): Promise<CrmStaffWorkspaceLoadResult> {
  const ctx = await getCrmStaffPageContext();

  if (ctx.status !== "ready") return ctx;

  const branchId = ctx.branchId;

  const [
    allStaffResult,
    pendingStaffResult,
    branchesResult,
    servicesResult,
  ] = await Promise.allSettled([
    getStaffByBranchWithBranches(branchId),
    getPendingStaffByBranch(branchId),
    getAllBranches(),
    getBranchAssignableServices(branchId),
  ]);

  const allStaff =
    allStaffResult.status === "fulfilled"
      ? (allStaffResult.value as StaffMember[])
      : [];
  const pendingStaff =
    pendingStaffResult.status === "fulfilled"
      ? (pendingStaffResult.value as StaffMember[])
      : [];
  const branches =
    branchesResult.status === "fulfilled" ? branchesResult.value : [];

  let activeServices: ServiceLite[] = [];
  let providerStaff: StaffForServicePanel[] = [];
  let providerAssignments: ServiceAssignmentRow[] = [];
  let providerAssignmentsError: string | null = null;

  if (servicesResult.status === "fulfilled") {
    const services = servicesResult.value as ServiceLite[];
    const eligible = services.filter(
      (service) =>
        service.is_active &&
        getCrmStaffNestedService(service) !== null &&
        getCrmStaffServiceId(service) !== null
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
        const assignmentData =
          await getBranchStaffAndServiceAssignments(
            branchId,
            activeServiceIds
          );
        providerStaff = assignmentData.staff;
        providerAssignments = assignmentData.assignments;
      } catch (error) {
        console.error("[crm/staff] provider assignment fetch failed", {
          branchId,
          error:
            error instanceof Error ? error.message : String(error),
        });
        providerAssignmentsError =
          "Service assignments could not be loaded. Please refresh and try again.";
      }
    }
  } else {
    console.error("[crm/staff] branch services query failed", {
      branchId,
      error:
        servicesResult.reason instanceof Error
          ? servicesResult.reason.message
          : String(servicesResult.reason),
    });
    providerAssignmentsError =
      "Service assignments could not be loaded. Please refresh and try again.";
  }

  let onboardingRequests: CrmStaffOnboardingRequest[] = [];
  if (ctx.canReviewOnboarding) {
    onboardingRequests = await fetchOnboardingRequests(
      canonicalizeSystemRole(ctx.me.system_role),
      branchId
    );
  }

  const branchCorrectionRequests =
    await getBranchAssignmentIssuesForActor({
      systemRole: ctx.me.system_role,
      branchId,
    });

  return {
    status: "ready",
    data: {
      branchId,
      branchName: ctx.branchName,
      reviewerSystemRole: ctx.me.system_role,
      reviewerBranchId: branchId,
      canReviewOnboarding: ctx.canReviewOnboarding,
      allStaff,
      pendingStaff,
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
      })),
      activeServices,
      providerStaff,
      providerAssignments,
      providerAssignmentsError,
      onboardingRequests,
      branchCorrectionRequests,
    },
  };
}
