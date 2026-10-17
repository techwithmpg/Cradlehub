"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Settings2, ShieldCheck, UsersRound } from "lucide-react";
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
  "management",
  "assignments",
  "applications",
  "branch-corrections",
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
  const [inlineTool, setInlineTool] = useState<Exclude<StaffTab, "management"> | null>(null);
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
      { key: "management", label: "Staff Management", count: workspaceAllStaff.length },
      {
        key: "assignments",
        label: "Service Assignments",
        count: providerAssignments.length,
      },
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 shadow-[var(--cs-shadow-xs)]">
        <div className="flex min-w-0 items-center gap-2">
          {activeTab !== "management" && (
            <button
              type="button"
              onClick={() => handleTabChange("management")}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--cs-border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Staff Management
            </button>
          )}
          {activeTab === "management" && (
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--cs-text)]">
              <UsersRound className="size-4 text-[var(--cs-success-text)]" aria-hidden="true" />
              Team workspace
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--cs-text-muted)]">
          <span>Other tools</span>
          <select
            aria-label="Open staff management tool"
            value={activeTab}
            onChange={(event) => handleTabChange(event.target.value)}
            className="h-9 max-w-[220px] rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2 text-xs font-medium text-[var(--cs-text)]"
          >
            {tabs.map((tab) => (
              <option key={tab.key} value={tab.key}>
                {tab.label}{tab.count === undefined ? "" : " (" + tab.count + ")"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <span id="staff-selected-section" className="sr-only">{tabs.find((tab) => tab.key === activeTab)?.label ?? "Staff Management"}</span>

      <AttendanceTabPanel
        id="staff-panel-applications"
        labelledBy="staff-selected-section"
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
        labelledBy="staff-selected-section"
        active={activeTab === "branch-corrections"}
      >
        <CrmStaffBranchCorrectionsTab
          requests={workspaceBranchCorrectionRequests}
          onResolved={handleBranchIssueResolved}
        />
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="staff-panel-management"
        labelledBy="staff-selected-section"
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
          pendingApplicationsCount={props.canReviewOnboarding ? props.onboardingRequests.length : 0}
          onReviewApplications={props.canReviewOnboarding ? () => setInlineTool("applications") : undefined}
        />

        <section className="mt-4 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3 shadow-[var(--cs-shadow-xs)]" aria-label="Staff management tools">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="m-0 text-sm font-semibold text-[var(--cs-text)]">Team operations</h2>
              <p className="m-0 mt-1 text-xs text-[var(--cs-text-muted)]">Manage related work without leaving Staff Management.</p>
            </div>
            {inlineTool && (
              <button type="button" onClick={() => setInlineTool(null)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]">
                Collapse
              </button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { key: "assignments", label: "All service assignments", count: providerAssignments.length, Icon: Settings2 },
              { key: "applications", label: "Review applications", count: props.canReviewOnboarding ? props.onboardingRequests.length : undefined, Icon: ClipboardCheck },
              { key: "branch-corrections", label: "Branch corrections", count: pendingBranchCorrectionCount, Icon: ShieldCheck },
              { key: "status", label: "Team status", count: workspacePendingStaff.length, Icon: UsersRound },
            ] as const).map(({ key, label, count, Icon }) => (
              <button
                key={key}
                type="button"
                aria-expanded={inlineTool === key}
                aria-controls="staff-inline-operations"
                onClick={() => setInlineTool((current) => current === key ? null : key)}
                className={[
                  "flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors",
                  inlineTool === key
                    ? "border-[var(--cs-sand)] bg-[var(--cs-sand-tint)] text-[var(--cs-text)]"
                    : "border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-[var(--cs-text-secondary)] hover:border-[var(--cs-border)]",
                ].join(" ")}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" aria-hidden="true" /> {label}
                </span>
                {count !== undefined && <span className="rounded-full bg-[var(--cs-surface)] px-2 py-0.5 text-[10px]">{count}</span>}
              </button>
            ))}
          </div>
          <div id="staff-inline-operations" className={inlineTool ? "mt-4" : ""}>
            {inlineTool === "assignments" && (
              <CrmStaffAssignmentsTab
                branchId={props.branchId}
                activeServices={props.activeServices}
                providerStaff={props.providerStaff}
                providerAssignments={providerAssignments}
                providerAssignmentsError={props.providerAssignmentsError}
                onStaffServicesSaved={handleStaffServicesSaved}
              />
            )}
            {inlineTool === "applications" && (
              <CrmStaffApplicationsTab
                requests={props.onboardingRequests}
                branches={props.branches}
                reviewerSystemRole={props.reviewerSystemRole}
                reviewerBranchId={props.reviewerBranchId}
                canReviewOnboarding={props.canReviewOnboarding}
              />
            )}
            {inlineTool === "branch-corrections" && (
              <CrmStaffBranchCorrectionsTab
                requests={workspaceBranchCorrectionRequests}
                onResolved={handleBranchIssueResolved}
              />
            )}
            {inlineTool === "status" && (
              <CrmStaffStatusTab
                allStaff={workspaceAllStaff}
                pendingStaff={workspacePendingStaff}
              />
            )}
          </div>
        </section>
      </AttendanceTabPanel>

      <AttendanceTabPanel
        id="staff-panel-assignments"
        labelledBy="staff-selected-section"
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
        labelledBy="staff-selected-section"
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
