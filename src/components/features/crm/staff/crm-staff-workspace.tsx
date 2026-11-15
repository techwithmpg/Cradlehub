"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CrmModuleTabs } from "@/components/features/crm/shared/crm-module-tabs";
import { CrmTabPanel } from "@/components/features/crm/shared/crm-workspace-primitives";
import {
  getStaffStatus,
  type StaffMember,
} from "@/components/features/staff/staff-management-utils";
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
import {
  normalizeCrmStaffTab,
  type CrmStaffTab,
  type CrmStaffWorkspaceData,
} from "./crm-staff-workspace-data";
import { useLiveCrmStaffData } from "./use-live-crm-staff-data";

const STAFF_TAB_KEYS: CrmStaffTab[] = [
  "applications",
  "branch-corrections",
  "management",
  "assignments",
  "status",
];

const TAB_URL_PARAM: Record<CrmStaffTab, string> = {
  applications: "applications",
  "branch-corrections": "branch-corrections",
  management: "management",
  assignments: "assignments",
  status: "status",
};

function isStaffTab(tab: string): tab is CrmStaffTab {
  return STAFF_TAB_KEYS.includes(tab as CrmStaffTab);
}

type CrmStaffWorkspaceProps = {
  initialTab: CrmStaffTab;
  initialData: CrmStaffWorkspaceData;
};

export function CrmStaffWorkspace({
  initialTab,
  initialData,
}: CrmStaffWorkspaceProps) {
  const searchParams = useSearchParams();
  const activeTab = normalizeCrmStaffTab(
    searchParams.get("tab") ?? initialTab
  );
  const live = useLiveCrmStaffData(initialData);
  const canonicalData = live.data ?? initialData;

  type LocalOverlay = {
    base: CrmStaffWorkspaceData;
    assignmentOverrides: Record<string, string[]>;
    staffPatches: Record<string, Partial<StaffMember>>;
    branchIssuePatches: Record<string, Partial<BranchAssignmentIssue>>;
    resolvedOnboardingIds: string[];
  };

  const [overlay, setOverlay] = useState<LocalOverlay>(() => ({
    base: canonicalData,
    assignmentOverrides: {},
    staffPatches: {},
    branchIssuePatches: {},
    resolvedOnboardingIds: [],
  }));

  const currentOverlay =
    overlay.base === canonicalData
      ? overlay
      : {
          base: canonicalData,
          assignmentOverrides: {},
          staffPatches: {},
          branchIssuePatches: {},
          resolvedOnboardingIds: [],
        };

  const rebaseOverlay = useCallback(
    (current: LocalOverlay): LocalOverlay =>
      current.base === canonicalData
        ? current
        : {
            base: canonicalData,
            assignmentOverrides: {},
            staffPatches: {},
            branchIssuePatches: {},
            resolvedOnboardingIds: [],
          },
    [canonicalData]
  );

  const workspaceAllStaff = useMemo(
    () =>
      canonicalData.allStaff.map((member) => ({
        ...member,
        ...(currentOverlay.staffPatches[member.id] ?? {}),
      })),
    [canonicalData.allStaff, currentOverlay.staffPatches]
  );

  const workspacePendingStaff = useMemo(
    () =>
      canonicalData.pendingStaff.map((member) => ({
        ...member,
        ...(currentOverlay.staffPatches[member.id] ?? {}),
      })),
    [canonicalData.pendingStaff, currentOverlay.staffPatches]
  );

  const workspaceBranchCorrectionRequests = useMemo(
    () =>
      canonicalData.branchCorrectionRequests.map((issue) => ({
        ...issue,
        ...(currentOverlay.branchIssuePatches[issue.id] ?? {}),
      })),
    [
      canonicalData.branchCorrectionRequests,
      currentOverlay.branchIssuePatches,
    ]
  );

  const workspaceOnboardingRequests = useMemo(
    () => {
      const resolved = new Set(currentOverlay.resolvedOnboardingIds);
      return canonicalData.onboardingRequests.filter(
        (request) => !resolved.has(request.id)
      );
    },
    [
      canonicalData.onboardingRequests,
      currentOverlay.resolvedOnboardingIds,
    ]
  );

  const invalidateCanonicalStaff = useCallback(() => {
    live.generation.store?.invalidate("crm-staff");
  }, [live.generation.store]);

  const handleStaffChanged = useCallback(
    (patch: Partial<StaffMember> & { id: string }) => {
      setOverlay((current) => {
        const rebased = rebaseOverlay(current);
        return {
          ...rebased,
          staffPatches: {
            ...rebased.staffPatches,
            [patch.id]: {
              ...(rebased.staffPatches[patch.id] ?? {}),
              ...patch,
            },
          },
        };
      });
    },
    [rebaseOverlay]
  );

  const handleBranchIssueResolved = useCallback(
    (
      result: Extract<
        BranchAssignmentResolutionResult,
        { ok: true }
      >
    ) => {
      setOverlay((current) => {
        const rebased = rebaseOverlay(current);
        return {
          ...rebased,
          branchIssuePatches: {
            ...rebased.branchIssuePatches,
            [result.issueId]: {
              status: result.issueStatus,
              resolutionType: result.resolutionType,
              nextAction: result.nextAction,
              decidedAt: new Date().toISOString(),
            },
          },
        };
      });
      invalidateCanonicalStaff();
    },
    [invalidateCanonicalStaff, rebaseOverlay]
  );

  const handleOnboardingResolved = useCallback(
    (requestId: string) => {
      setOverlay((current) => {
        const rebased = rebaseOverlay(current);
        return {
          ...rebased,
          resolvedOnboardingIds: Array.from(
            new Set([...rebased.resolvedOnboardingIds, requestId])
          ),
        };
      });
      invalidateCanonicalStaff();
    },
    [invalidateCanonicalStaff, rebaseOverlay]
  );

  const providerAssignments = useMemo(
    () =>
      Object.entries(currentOverlay.assignmentOverrides).reduce(
        (rows, [staffId, serviceIds]) =>
          replaceStaffServiceAssignmentRows(
            rows,
            staffId,
            serviceIds
          ),
        canonicalData.providerAssignments
      ),
    [
      canonicalData.providerAssignments,
      currentOverlay.assignmentOverrides,
    ]
  );

  const handleStaffServicesSaved = useCallback(
    (staffId: string, serviceIds: string[]) => {
      setOverlay((current) => {
        const rebased = rebaseOverlay(current);
        return {
          ...rebased,
          assignmentOverrides: {
            ...rebased.assignmentOverrides,
            [staffId]: serviceIds,
          },
        };
      });
      invalidateCanonicalStaff();
    },
    [invalidateCanonicalStaff, rebaseOverlay]
  );

  const pendingBranchCorrectionCount =
    workspaceBranchCorrectionRequests.filter(
      (request) =>
        request.status === "open" ||
        request.status === "requires_review"
    ).length;

  const pendingStatusCount = useMemo(
    () =>
      workspacePendingStaff.filter((member) => {
        const s = getStaffStatus(member);
        return s === "awaiting" || s === "invited";
      }).length,
    [workspacePendingStaff]
  );

  const tabs = useMemo<
    { key: CrmStaffTab; label: string; count?: number }[]
  >(
    () => [
      {
        key: "management",
        label: "Staff Management",
        count: workspaceAllStaff.length,
      },
      {
        key: "applications",
        label: "Applications",
        count: canonicalData.canReviewOnboarding
          ? workspaceOnboardingRequests.length
          : undefined,
      },
      {
        key: "branch-corrections",
        label: "Branch Corrections",
        count: pendingBranchCorrectionCount,
      },
      {
        key: "assignments",
        label: "Service Assignments",
        count: providerAssignments.length,
      },
      {
        key: "status",
        label: "Status",
        count: pendingStatusCount,
      }
    ],
    [
      canonicalData.canReviewOnboarding,
      pendingBranchCorrectionCount,
      pendingStatusCount,
      providerAssignments.length,
      workspaceAllStaff.length,
      workspaceOnboardingRequests.length,
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

  const moduleTabs = useMemo(
    () =>
      tabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        count: tab.count,
        id: `staff-tab-${tab.key}`,
        controls: `staff-panel-${tab.key}`,
      })),
    [tabs]
  );

  return (
    <div className="space-y-6">
      {live.error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>
            Staff data could not refresh. The last validated view is
            preserved.
          </span>
          <button
            type="button"
            className="cs-btn cs-btn-secondary cs-btn-sm"
            onClick={() => void live.revalidate()}
          >
            Retry
          </button>
        </div>
      ) : null}

      <CrmModuleTabs
        tabs={moduleTabs}
        activeKey={activeTab}
        onChange={handleTabChange}
        ariaLabel="Staff sections"
      />

      <CrmTabPanel
        id="staff-panel-applications"
        labelledBy="staff-tab-applications"
        active={activeTab === "applications"}
      >
        <CrmStaffApplicationsTab
          requests={workspaceOnboardingRequests}
          branches={canonicalData.branches}
          reviewerSystemRole={canonicalData.reviewerSystemRole}
          reviewerBranchId={canonicalData.reviewerBranchId}
          canReviewOnboarding={canonicalData.canReviewOnboarding}
          onRequestResolved={handleOnboardingResolved}
        />
      </CrmTabPanel>

      <CrmTabPanel
        id="staff-panel-branch-corrections"
        labelledBy="staff-tab-branch-corrections"
        active={activeTab === "branch-corrections"}
      >
        <CrmStaffBranchCorrectionsTab
          requests={workspaceBranchCorrectionRequests}
          onResolved={handleBranchIssueResolved}
        />
      </CrmTabPanel>

      <CrmTabPanel
        id="staff-panel-management"
        labelledBy="staff-tab-management"
        active={activeTab === "management"}
      >
        <CrmStaffManagementTab
          allStaff={workspaceAllStaff}
          pendingStaff={workspacePendingStaff}
          branches={canonicalData.branches}
          activeServices={canonicalData.activeServices}
          providerAssignments={providerAssignments}
          providerAssignmentsError={
            canonicalData.providerAssignmentsError
          }
          reviewerSystemRole={canonicalData.reviewerSystemRole}
          onStaffServicesSaved={handleStaffServicesSaved}
          onStaffChanged={handleStaffChanged}
          onStaffMutationCommitted={invalidateCanonicalStaff}
        />
      </CrmTabPanel>

      <CrmTabPanel
        id="staff-panel-assignments"
        labelledBy="staff-tab-assignments"
        active={activeTab === "assignments"}
      >
        <CrmStaffAssignmentsTab
          branchId={canonicalData.branchId}
          activeServices={canonicalData.activeServices}
          providerStaff={canonicalData.providerStaff}
          providerAssignments={providerAssignments}
          providerAssignmentsError={
            canonicalData.providerAssignmentsError
          }
          onStaffServicesSaved={handleStaffServicesSaved}
        />
      </CrmTabPanel>

      <CrmTabPanel
        id="staff-panel-status"
        labelledBy="staff-tab-status"
        active={activeTab === "status"}
      >
        <CrmStaffStatusTab
          allStaff={workspaceAllStaff}
          pendingStaff={workspacePendingStaff}
        />
      </CrmTabPanel>
    </div>
  );
}
