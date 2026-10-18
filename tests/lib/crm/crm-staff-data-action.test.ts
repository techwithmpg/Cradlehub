import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
}));

vi.mock("@/lib/queries/crm-staff-workspace", () => ({
  loadCrmStaffWorkspaceData: mocks.loadWorkspace,
}));

import { refreshCrmStaffWorkspaceAction } from "@/lib/actions/crm-staff-data-actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PERF-7 CRM Staff refresh authority", () => {
  it("accepts no client branch authority and returns the server-resolved workspace", async () => {
    const data = {
      branchId: "branch-authorized",
      branchName: "Main",
      reviewerSystemRole: "crm",
      reviewerBranchId: "branch-authorized",
      canReviewOnboarding: false,
      allStaff: [],
      pendingStaff: [],
      branches: [],
      activeServices: [],
      providerStaff: [],
      providerAssignments: [],
      providerAssignmentsError: null,
      onboardingRequests: [],
      branchCorrectionRequests: [],
    };

    mocks.loadWorkspace.mockResolvedValue({
      status: "ready",
      data,
    });

    const actionWithUntrustedArgument =
      refreshCrmStaffWorkspaceAction as unknown as (
        input: unknown
      ) => Promise<typeof data>;

    const result = await actionWithUntrustedArgument({
      branchId: "branch-attacker",
    });

    expect(mocks.loadWorkspace).toHaveBeenCalledWith();
    expect(result.branchId).toBe("branch-authorized");
  });

  it("fails closed when the server Staff context is unavailable", async () => {
    mocks.loadWorkspace.mockResolvedValue({
      status: "unauthorized",
    });

    await expect(
      refreshCrmStaffWorkspaceAction()
    ).rejects.toThrow(
      "CRM Staff workspace is unavailable for this session."
    );
  });
});
