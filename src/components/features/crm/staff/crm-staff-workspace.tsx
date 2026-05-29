"use client";

import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type {
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import type { Database } from "@/types/supabase";
import { CrmStaffApplicationsTab } from "./crm-staff-applications-tab";
import { CrmStaffManagementTab } from "./crm-staff-management-tab";
import { CrmStaffAssignmentsTab } from "./crm-staff-assignments-tab";
import { CrmStaffStatusTab } from "./crm-staff-status-tab";

type OnboardingRequest = Database["public"]["Tables"]["staff_onboarding_requests"]["Row"];
type Branch = { id: string; name: string };

type CrmStaffWorkspaceProps = {
  activeTab: "applications" | "management" | "assignments" | "status";
  branchId: string;
  branchName: string;
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
  branches: Branch[];
  activeServices: ServiceLite[];
  providerStaff: StaffForServicePanel[];
  providerAssignments: ServiceAssignmentRow[];
  onboardingRequests: OnboardingRequest[];
  reviewerSystemRole: string;
  reviewerBranchId: string | null;
  canReviewOnboarding: boolean;
};

export function CrmStaffWorkspace(props: CrmStaffWorkspaceProps) {
  switch (props.activeTab) {
    case "applications":
      return (
        <CrmStaffApplicationsTab
          requests={props.onboardingRequests}
          branches={props.branches}
          reviewerSystemRole={props.reviewerSystemRole}
          reviewerBranchId={props.reviewerBranchId}
          canReviewOnboarding={props.canReviewOnboarding}
        />
      );
    case "management":
      return (
        <CrmStaffManagementTab
          allStaff={props.allStaff}
          pendingStaff={props.pendingStaff}
          branches={props.branches}
          activeServices={props.activeServices}
          providerAssignments={props.providerAssignments}
          reviewerSystemRole={props.reviewerSystemRole}
        />
      );
    case "assignments":
      return (
        <CrmStaffAssignmentsTab
          branchId={props.branchId}
          activeServices={props.activeServices}
          providerStaff={props.providerStaff}
          providerAssignments={props.providerAssignments}
        />
      );
    case "status":
      return (
        <CrmStaffStatusTab
          allStaff={props.allStaff}
          pendingStaff={props.pendingStaff}
        />
      );
    default:
      return null;
  }
}
