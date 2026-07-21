"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AttendanceTabPanel } from "@/components/features/attendance/attendance-ui";
import type { StaffMember } from "@/components/features/staff/staff-management-utils";
import type {
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import type { Database } from "@/types/supabase";
import type {
  BranchAssignmentIssue,
  BranchAssignmentResolutionResult,
} from "@/lib/staff/branch-correction-types";
import { replaceStaffServiceAssignmentRows } from "@/lib/staff/service-assignment-state";
import { CrmStaffApplicationsTab } from "./crm-staff-applications-tab";
import { CrmStaffManagementTab } from "./crm-staff-management-tab";
import { CrmStaffAssignmentsTab } from "./crm-staff-assignments-tab";
import { CrmStaffStatusTab } from "./crm-staff-status-tab";
import { CrmStaffBranchCorrectionsTab } from "./crm-staff-branch-corrections-tab";

type OnboardingRequest = Database["public"]["Tables"]["staff_onboarding_requests"]["Row"];
type Branch = { id: string; name: string };
type StaffTab = "applications" | "branch-corrections" | "management" | "assignments" | "status";

const STAFF_TAB_KEYS: StaffTab[] = [
  "applications",
  "branch-corrections",
  "management",
  "assignments",
  "status",
];

const TAB_URL_PARAM: Record<StaffTab, string> = {
  applications: "applications",
  "branch-corrections": "branch-corrections",
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
  providerAssignmentsError: string | null;
  onboardingRequests: OnboardingRequest[];
  branchCorrectionRequests: BranchAssignmentIssue[];
  reviewerSystemRole: string;
  reviewerBranchId: string | null;
  canReviewOnboarding: boolean;
};

export function CrmStaffWorkspace(props: CrmStaffWorkspaceProps) {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab = rawTab && isStaffTab(rawTab) ? rawTab : props.initialTab;
  const [assignmentOverrides, setAssignmentOverrides] = useState<
    Record<string, string[]>
  >({});
  const [workspaceAllStaff, setWorkspaceAllStaff] = useState(props.allStaff);
  const [workspacePendingStaff, setWorkspacePendingStaff] = useState(props.pendingStaff);
  const [workspaceBranchCorrectionRequests, setWorkspaceBranchCorrectionRequests] = useState(
    props.branchCorrectionRequests
  );

  const handleStaffChanged = useCallback((patch: Partial<StaffMember> & { id: string }) => {
    const applyPatch = (staff: StaffMember[]) => staff.map(
      (member) => member.id === patch.id ? { ...member, ...patch } : member
    );
    setWorkspaceAllStaff(applyPatch);
    setWorkspacePendingStaff(applyPatch);
  }, []);

  const handleBranchIssueResolved = useCallback((result: Extract<BranchAssignmentResolutionResult, { ok: true }>) => {
    setWorkspaceBranchCorrectionRequests((current) => current.map((issue) =>
      issue.id === result.issueId
        ? {
            ...issue,
            status: result.issueStatus,
            resolutionType: result.resolutionType,
            nextAction: result.nextAction,
            decidedAt: new Date().toISOString(),
          }
        : issue
    ));
  }, []);

  const providerAssignments = useMemo(
    () =>
      Object.entries(assignmentOverrides).reduce(
        (rows, [staffId, serviceIds]) =>
          replaceStaffServiceAssignmentRows(rows, staffId, serviceIds),
        props.providerAssignments
      ),
    [assignmentOverrides, props.providerAssignments]
  );

  const handleStaffServicesSaved = useCallback(
    (staffId: string, serviceIds: string[]) => {
      setAssignmentOverrides((current) => ({
        ...current,
        [staffId]: serviceIds,
      }));
    },
    []
  );

  const pendingBranchCorrectionCount = workspaceBranchCorrectionRequests.filter(
    (request) => request.status === "open" || request.status === "requires_review"
  ).length;

  const tabs = useMemo<{ key: StaffTab; label: string; count?: number }[]>(
    () => [
      {
        key: "applications",
        label: "Applications",
        count: props.canReviewOnboarding ? props.onboardingRequests.length : undefined,
      },
      {
        key: "branch-corrections",
        label: "Branch Corrections",
        count: pendingBranchCorrectionCount,
      },
      { key: "management", label: "Staff Management", count: workspaceAllStaff.length },
      {
        key: "assignments",
        label: "Service Assignments",
        count: providerAssignments.length,
      },
      { key: "status", label: "Status", count: workspacePendingStaff.length },
    ],
    [
      workspaceAllStaff.length,
      props.canReviewOnboarding,
      pendingBranchCorrectionCount,
      props.onboardingRequests.length,
      workspacePendingStaff.length,
      providerAssignments.length,
    ]
  );

  const handleTabChange = useCallback((nextTab: string) => {
    if (!isStaffTab(nextTab)) return;

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", TAB_URL_PARAM[nextTab]);
      window.history.pushState(null, "", url.toString());
    }
  }, []);

  const activeTabIndex = tabs.findIndex((tab) => tab.key === activeTab);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const lastIndex = tabs.length - 1;
      let nextIndex = activeTabIndex;

      if (event.key === "ArrowRight") nextIndex = activeTabIndex === lastIndex ? 0 : activeTabIndex + 1;
      else if (event.key === "ArrowLeft") nextIndex = activeTabIndex === 0 ? lastIndex : activeTabIndex - 1;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = lastIndex;
      else return;

      event.preventDefault();
      const nextTab = tabs[nextIndex];
      if (nextTab) handleTabChange(nextTab.key);
    },
    [activeTabIndex, handleTabChange, tabs]
  );

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Staff sections"
        onKeyDown={handleTabKeyDown}
        className="flex gap-0 overflow-x-auto border-b border-[var(--cs-border-soft)]"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`staff-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`staff-panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => handleTabChange(tab.key)}
              className={`relative inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-sand)] ${
                active
                  ? "text-[var(--cs-text)] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-[var(--cs-sand)]"
                  : "text-[var(--cs-text-muted)] hover:text-[var(--cs-text-secondary)]"
              }`}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                    active
                      ? "bg-[var(--cs-sand-mist)] text-[var(--cs-sand)]"
                      : "bg-[var(--cs-border)] text-[var(--cs-text-muted)]"
                  }`}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <AttendanceTabPanel
        id="staff-panel-applications"
        labelledBy="staff-tab-applications"
        active={activeTab === "applications"}
      >
        <CrmStaffApplicationsTab
          requests={props.onboardingRequests}
          branches={props.branches}
          reviewerSystemRole={props.reviewerSystemRole}
          reviewerBranchId={props.reviewerBranchId}
          canReviewOnboarding={props.canReviewOnboarding}
        />
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="staff-panel-branch-corrections"
        labelledBy="staff-tab-branch-corrections"
        active={activeTab === "branch-corrections"}
      >
        <CrmStaffBranchCorrectionsTab
          requests={workspaceBranchCorrectionRequests}
          onResolved={handleBranchIssueResolved}
        />
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="staff-panel-management"
        labelledBy="staff-tab-management"
        active={activeTab === "management"}
      >
        <CrmStaffManagementTab
          allStaff={workspaceAllStaff}
          pendingStaff={workspacePendingStaff}
          branches={props.branches}
          activeServices={props.activeServices}
          providerAssignments={providerAssignments}
          providerAssignmentsError={props.providerAssignmentsError}
          reviewerSystemRole={props.reviewerSystemRole}
          onStaffServicesSaved={handleStaffServicesSaved}
          onStaffChanged={handleStaffChanged}
        />
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="staff-panel-assignments"
        labelledBy="staff-tab-assignments"
        active={activeTab === "assignments"}
      >
        <CrmStaffAssignmentsTab
          branchId={props.branchId}
          activeServices={props.activeServices}
          providerStaff={props.providerStaff}
          providerAssignments={providerAssignments}
          providerAssignmentsError={props.providerAssignmentsError}
          onStaffServicesSaved={handleStaffServicesSaved}
        />
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="staff-panel-status"
        labelledBy="staff-tab-status"
        active={activeTab === "status"}
      >
        <CrmStaffStatusTab
          allStaff={workspaceAllStaff}
          pendingStaff={workspacePendingStaff}
        />
      </AttendanceTabPanel>
    </div>
  );
}
