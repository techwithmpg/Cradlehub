import { describe, expect, it } from "vitest";

import { canApproveStaffOnboarding } from "@/lib/staff/approval-permissions";

const MAIN_BRANCH = "branch-main";
const SM_BRANCH = "branch-sm";

describe("Staff onboarding approval branch safety", () => {
  it("allows CRM to approve operational staff for their own branch", () => {
    const result = canApproveStaffOnboarding({
      approverRole: "crm",
      approverBranchId: MAIN_BRANCH,
      targetBranchId: MAIN_BRANCH,
      requestedSystemRole: "staff",
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks CRM from approving staff for a different branch", () => {
    const result = canApproveStaffOnboarding({
      approverRole: "crm",
      approverBranchId: MAIN_BRANCH,
      targetBranchId: SM_BRANCH,
      requestedSystemRole: "staff",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("own branch");
  });

  it("blocks manager from approving staff for a different branch", () => {
    const result = canApproveStaffOnboarding({
      approverRole: "manager",
      approverBranchId: MAIN_BRANCH,
      targetBranchId: SM_BRANCH,
      requestedSystemRole: "staff",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("own branch");
  });

  it("allows manager to approve staff for their own branch", () => {
    const result = canApproveStaffOnboarding({
      approverRole: "manager",
      approverBranchId: MAIN_BRANCH,
      targetBranchId: MAIN_BRANCH,
      requestedSystemRole: "staff",
    });

    expect(result.allowed).toBe(true);
  });

  it("allows owner to approve staff for any branch", () => {
    const result = canApproveStaffOnboarding({
      approverRole: "owner",
      approverBranchId: MAIN_BRANCH,
      targetBranchId: SM_BRANCH,
      requestedSystemRole: "manager",
    });

    expect(result.allowed).toBe(true);
  });

  it("still blocks CRM from approving management roles even within branch", () => {
    const result = canApproveStaffOnboarding({
      approverRole: "crm",
      approverBranchId: MAIN_BRANCH,
      targetBranchId: MAIN_BRANCH,
      requestedSystemRole: "manager",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Management");
  });
});
