// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CrmStaffBranchCorrectionsTab } from "@/components/features/crm/staff/crm-staff-branch-corrections-tab";
import type { BranchAssignmentIssue } from "@/lib/staff/branch-correction-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(dashboard)/crm/staff/actions", () => ({
  resolveBranchAssignmentIssueAction: vi.fn(),
}));

const openIssue: BranchAssignmentIssue = {
  id: "issue-1",
  staffId: "staff-1",
  staffName: "Melrose Barot Sioco",
  staffNickname: null,
  staffType: "therapist",
  staffSystemRole: "staff",
  staffIsActive: true,
  source: "attendance_scan",
  status: "open",
  profileBranchId: "branch-sm",
  profileBranchName: "Cradle Wellness Living SM",
  affectedBranchId: "branch-main",
  affectedBranchName: "Cradle Wellness living Main Spa",
  scanEventId: "scan-1",
  rootCauses: ["wrong_qr_scan_only"],
  scheduleBranches: [],
  bookingBranches: [],
  activeTemporaryPermissionCount: 0,
  openAttendanceCount: 0,
  recommendedResolution: "confirm_wrong_qr_scan",
  repairsRequiringReview: [],
  nextAction: "rescan_required",
  reason: null,
  createdAt: "2026-07-16T03:45:38.150Z",
  decidedAt: null,
  resolutionType: null,
  isTest: false,
};

afterEach(cleanup);

describe("CrmStaffBranchCorrectionsTab", () => {
  it("renders an open authoritative branch assignment issue", () => {
    render(<CrmStaffBranchCorrectionsTab requests={[openIssue]} />);

    expect(screen.getByText("Melrose Barot Sioco")).toBeTruthy();
    expect(screen.getByText("Cradle Wellness Living SM")).toBeTruthy();
    expect(screen.getByText("Cradle Wellness living Main Spa")).toBeTruthy();
    expect(screen.getByRole("button", { name: /resolve branch/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /wrong qr only/i })).toBeTruthy();
  });

  it("does not offer resolution buttons for a resolved issue", () => {
    const resolvedIssue: BranchAssignmentIssue = {
      ...openIssue,
      status: "resolved",
      resolutionType: "correct_permanent_primary_branch",
      decidedAt: "2026-07-16T05:07:37.897Z",
      reason: "Permanent transfer approved.",
    };

    render(<CrmStaffBranchCorrectionsTab requests={[resolvedIssue]} />);

    expect(screen.getByText("Melrose Barot Sioco")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /resolve branch/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /wrong qr only/i })).toBeNull();
  });
});