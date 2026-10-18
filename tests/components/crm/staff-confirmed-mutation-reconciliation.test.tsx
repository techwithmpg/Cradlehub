/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmStaffWorkspaceData } from "@/components/features/crm/staff/crm-staff-workspace-data";

const invalidate = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tab=applications"),
}));

vi.mock("@/components/features/crm/staff/use-live-crm-staff-data", () => ({
  useLiveCrmStaffData: (data: CrmStaffWorkspaceData) => ({
    data,
    error: undefined,
    revalidate: vi.fn(),
    generation: {
      store: { invalidate },
    },
  }),
}));

vi.mock("@/components/features/attendance/attendance-ui", () => ({
  AttendanceTabPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/features/crm/staff/crm-staff-applications-tab", () => ({
  CrmStaffApplicationsTab: ({
    onRequestResolved,
  }: {
    onRequestResolved?: (requestId: string) => void;
  }) => (
    <button onClick={() => onRequestResolved?.("request-1")}>
      Resolve onboarding
    </button>
  ),
}));

vi.mock("@/components/features/crm/staff/crm-staff-branch-corrections-tab", () => ({
  CrmStaffBranchCorrectionsTab: ({
    onResolved,
  }: {
    onResolved?: (result: {
      ok: true;
      issueId: string;
      issueStatus: "resolved";
      resolutionType: "confirm_wrong_qr_scan";
      nextAction: string;
    }) => void;
  }) => (
    <button
      onClick={() =>
        onResolved?.({
          ok: true,
          issueId: "issue-1",
          issueStatus: "resolved",
          resolutionType: "confirm_wrong_qr_scan",
          nextAction: "rescan_required",
        })
      }
    >
      Resolve branch issue
    </button>
  ),
}));

vi.mock("@/components/features/crm/staff/crm-staff-management-tab", () => ({
  CrmStaffManagementTab: ({
    onStaffMutationCommitted,
    onStaffServicesSaved,
  }: {
    onStaffMutationCommitted: () => void;
    onStaffServicesSaved: (staffId: string, serviceIds: string[]) => void;
  }) => (
    <div>
      <button onClick={onStaffMutationCommitted}>Commit staff mutation</button>
      <button onClick={() => onStaffServicesSaved("staff-1", ["service-1"])}>
        Save services
      </button>
    </div>
  ),
}));

vi.mock("@/components/features/crm/staff/crm-staff-assignments-tab", () => ({
  CrmStaffAssignmentsTab: () => <div>Assignments</div>,
}));
vi.mock("@/components/features/crm/staff/crm-staff-status-tab", () => ({
  CrmStaffStatusTab: () => <div>Status</div>,
}));

import { CrmStaffWorkspace } from "@/components/features/crm/staff/crm-staff-workspace";

const initialData: CrmStaffWorkspaceData = {
  branchId: "branch-a",
  branchName: "Main",
  reviewerSystemRole: "crm",
  reviewerBranchId: "branch-a",
  canReviewOnboarding: true,
  allStaff: [],
  pendingStaff: [],
  branches: [],
  activeServices: [],
  providerStaff: [],
  providerAssignments: [],
  providerAssignmentsError: null,
  onboardingRequests: [],
  branchCorrectionRequests: [
    {
      id: "issue-1",
      staffId: "staff-1",
      staffName: "Therapist One",
      staffNickname: null,
      staffType: "therapist",
      staffSystemRole: "staff",
      staffIsActive: true,
      source: "attendance_scan",
      status: "open",
      profileBranchId: "branch-a",
      profileBranchName: "Main",
      affectedBranchId: "branch-b",
      affectedBranchName: "SM",
      scanEventId: "scan-1",
      rootCauses: ["wrong_qr_scan_only"],
      scheduleBranches: [],
      bookingBranches: [],
      activeTemporaryPermissionCount: 0,
      openAttendanceCount: 0,
      recommendedResolution: "confirm_wrong_qr_scan",
      repairsRequiringReview: [],
      nextAction: null,
      reason: null,
      createdAt: "2026-10-18T00:00:00.000Z",
      decidedAt: null,
      resolutionType: null,
      isTest: false,
    },
  ],
};

beforeEach(() => {
  invalidate.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PERF-7 CRM Staff confirmed mutation reconciliation", () => {
  it.each([
    ["onboarding", "Resolve onboarding"],
    ["branch correction", "Resolve branch issue"],
    ["profile/status", "Commit staff mutation"],
    ["service assignment", "Save services"],
  ])("invalidates crm-staff once after confirmed %s success", (_label, buttonName) => {
    render(
      <CrmStaffWorkspace initialTab="applications" initialData={initialData} />
    );

    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith("crm-staff");
  });
});
