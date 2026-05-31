"use client";

import { useCallback, useMemo, useState } from "react";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type {
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import type { Database } from "@/types/supabase";
import { CrmSegmentTabs } from "@/components/features/crm/premium/crm-segment-tabs";
import type { CrmSegmentTab } from "@/components/features/crm/premium/crm-segment-tabs";
import { CrmStaffApplicationsTab } from "./crm-staff-applications-tab";
import { CrmStaffManagementTab } from "./crm-staff-management-tab";
import { CrmStaffAssignmentsTab } from "./crm-staff-assignments-tab";
import { CrmStaffStatusTab } from "./crm-staff-status-tab";

type OnboardingRequest = Database["public"]["Tables"]["staff_onboarding_requests"]["Row"];
type Branch = { id: string; name: string };
type StaffTab = "applications" | "management" | "assignments" | "status";

const STAFF_TAB_KEYS: StaffTab[] = [
  "applications",
  "management",
  "assignments",
  "status",
];

const TAB_URL_PARAM: Record<StaffTab, string> = {
  applications: "applications",
  management: "management",
  assignments: "assignments",
  status: "status",
};

function isStaffTab(tab: string): tab is StaffTab {
  return STAFF_TAB_KEYS.includes(tab as StaffTab);
}

type CrmStaffWorkspaceProps = {
  initialTab: StaffTab;
  branchId: string;
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
  const [activeTab, setActiveTab] = useState<StaffTab>(props.initialTab);

  const tabs = useMemo<CrmSegmentTab[]>(
    () => [
      {
        key: "applications",
        label: "Applications",
        count: props.canReviewOnboarding ? props.onboardingRequests.length : undefined,
      },
      { key: "management", label: "Staff Management", count: props.allStaff.length },
      {
        key: "assignments",
        label: "Service Assignments",
        count: props.providerAssignments.length,
      },
      { key: "status", label: "Status", count: props.pendingStaff.length },
    ],
    [
      props.allStaff.length,
      props.canReviewOnboarding,
      props.onboardingRequests.length,
      props.pendingStaff.length,
      props.providerAssignments.length,
    ]
  );

  const handleTabChange = useCallback((nextTab: string) => {
    if (!isStaffTab(nextTab)) return;

    setActiveTab(nextTab);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", TAB_URL_PARAM[nextTab]);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  return (
    <div className="space-y-6">
      <CrmSegmentTabs
        tabs={tabs}
        activeKey={activeTab}
        onSelect={handleTabChange}
        variant="underline"
      />

      <div hidden={activeTab !== "applications"}>
        <CrmStaffApplicationsTab
          requests={props.onboardingRequests}
          branches={props.branches}
          reviewerSystemRole={props.reviewerSystemRole}
          reviewerBranchId={props.reviewerBranchId}
          canReviewOnboarding={props.canReviewOnboarding}
        />
      </div>

      <div hidden={activeTab !== "management"}>
        <CrmStaffManagementTab
          allStaff={props.allStaff}
          pendingStaff={props.pendingStaff}
          branches={props.branches}
          activeServices={props.activeServices}
          providerAssignments={props.providerAssignments}
          reviewerSystemRole={props.reviewerSystemRole}
        />
      </div>

      <div hidden={activeTab !== "assignments"}>
        <CrmStaffAssignmentsTab
          branchId={props.branchId}
          activeServices={props.activeServices}
          providerStaff={props.providerStaff}
          providerAssignments={props.providerAssignments}
        />
      </div>

      <div hidden={activeTab !== "status"}>
        <CrmStaffStatusTab
          allStaff={props.allStaff}
          pendingStaff={props.pendingStaff}
        />
      </div>
    </div>
  );
}
