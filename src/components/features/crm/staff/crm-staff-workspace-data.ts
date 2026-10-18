import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import type { BranchAssignmentIssue } from "@/lib/staff/branch-correction-types";
import type { Database } from "@/types/supabase";

export type CrmStaffTab =
  | "applications"
  | "branch-corrections"
  | "management"
  | "assignments"
  | "status";

export type CrmStaffOnboardingRequest =
  Database["public"]["Tables"]["staff_onboarding_requests"]["Row"];

export type CrmStaffBranch = { id: string; name: string };

export type CrmStaffWorkspaceData = {
  branchId: string;
  branchName: string;
  reviewerSystemRole: string;
  reviewerBranchId: string | null;
  canReviewOnboarding: boolean;
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
  branches: CrmStaffBranch[];
  activeServices: ServiceLite[];
  providerStaff: StaffForServicePanel[];
  providerAssignments: ServiceAssignmentRow[];
  providerAssignmentsError: string | null;
  onboardingRequests: CrmStaffOnboardingRequest[];
  branchCorrectionRequests: BranchAssignmentIssue[];
};

const STAFF_TABS: readonly CrmStaffTab[] = [
  "applications",
  "branch-corrections",
  "management",
  "assignments",
  "status",
];

export function normalizeCrmStaffTab(
  value: string | null | undefined
): CrmStaffTab {
  return value && STAFF_TABS.includes(value as CrmStaffTab)
    ? (value as CrmStaffTab)
    : "applications";
}
