import { describe, expect, it } from "vitest";

import {
  canRequestBranchCorrection,
  canReviewBranchCorrectionRequest,
  canSeeAllBranchCorrectionRequests,
} from "@/lib/staff/branch-correction-policy";

describe("branch correction permission policy", () => {
  it("allows owner and management roles to review any branch request", () => {
    for (const role of ["owner", "manager", "assistant_manager", "store_manager"]) {
      expect(
        canReviewBranchCorrectionRequest(
          { systemRole: role, branchId: "branch-main" },
          { requestedBranchId: "branch-sm" }
        )
      ).toBe(true);
      expect(canSeeAllBranchCorrectionRequests(role)).toBe(true);
    }
  });

  it("allows CRM/front-desk aliases only for their own requested branch", () => {
    for (const role of ["crm", "csr", "csr_head", "csr_staff"]) {
      expect(
        canReviewBranchCorrectionRequest(
          { systemRole: role, branchId: "branch-main" },
          { requestedBranchId: "branch-main" }
        )
      ).toBe(true);
      expect(
        canReviewBranchCorrectionRequest(
          { systemRole: role, branchId: "branch-main" },
          { requestedBranchId: "branch-sm" }
        )
      ).toBe(false);
      expect(canSeeAllBranchCorrectionRequests(role)).toBe(false);
    }
  });

  it("does not allow staff to approve their own branch correction request", () => {
    expect(
      canReviewBranchCorrectionRequest(
        { systemRole: "staff", branchId: "branch-main" },
        { requestedBranchId: "branch-main" }
      )
    ).toBe(false);
  });

  it("allows staff to request only when active and moving to a different branch", () => {
    expect(
      canRequestBranchCorrection({
        staffIsActive: true,
        currentBranchId: "branch-sm",
        requestedBranchId: "branch-main",
      })
    ).toBe(true);
    expect(
      canRequestBranchCorrection({
        staffIsActive: true,
        currentBranchId: "branch-main",
        requestedBranchId: "branch-main",
      })
    ).toBe(false);
    expect(
      canRequestBranchCorrection({
        staffIsActive: false,
        currentBranchId: "branch-sm",
        requestedBranchId: "branch-main",
      })
    ).toBe(false);
  });
});
