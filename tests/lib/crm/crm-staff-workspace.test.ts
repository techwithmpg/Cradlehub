import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getAllBranches: vi.fn(),
  getStaffByBranchWithBranches: vi.fn(),
  getPendingStaffByBranch: vi.fn(),
  getBranchAssignableServices: vi.fn(),
  getBranchStaffAndServiceAssignments: vi.fn(),
  canReviewStaffOnboarding: vi.fn(),
  getBranchAssignmentIssuesForActor: vi.fn(),
  getFrontDeskContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/queries/branches", () => ({
  getAllBranches: mocks.getAllBranches,
}));
vi.mock("@/lib/queries/staff", () => ({
  getStaffByBranchWithBranches:
    mocks.getStaffByBranchWithBranches,
  getPendingStaffByBranch:
    mocks.getPendingStaffByBranch,
}));
vi.mock("@/lib/services/service-catalog", () => ({
  getBranchAssignableServices:
    mocks.getBranchAssignableServices,
}));
vi.mock("@/lib/queries/crm-services", () => ({
  getBranchStaffAndServiceAssignments:
    mocks.getBranchStaffAndServiceAssignments,
}));
vi.mock("@/lib/permissions", () => ({
  canReviewStaffOnboarding:
    mocks.canReviewStaffOnboarding,
}));
vi.mock("@/lib/staff/branch-assignment-resolver", () => ({
  getBranchAssignmentIssuesForActor:
    mocks.getBranchAssignmentIssuesForActor,
}));
vi.mock("@/lib/queries/crm-context", () => ({
  getFrontDeskContext: mocks.getFrontDeskContext,
}));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => false,
  getDevBypassLayoutStaff: vi.fn(),
}));
vi.mock("@/lib/auth/crm-permissions", () => ({
  canAccessCrmWorkspace: () => true,
}));
vi.mock(
  "@/components/features/crm/staff/service-row-adapter",
  () => ({
    getCrmStaffNestedService: () => null,
    getCrmStaffServiceId: () => null,
  })
);

import { loadCrmStaffWorkspaceData } from "@/lib/queries/crm-staff-workspace";

const branchId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();

  const staffQuery = {
    select: () => staffQuery,
    eq: () => staffQuery,
    maybeSingle: async () => ({
      data: {
        id: "staff-reviewer",
        system_role: "crm",
        branch_id: branchId,
        branches: { name: "Main Branch" },
      },
      error: null,
    }),
  };

  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: "auth-user" } },
      }),
    },
    from: (table: string) => {
      if (table !== "staff") {
        throw new Error(`Unexpected table ${table}`);
      }
      return staffQuery;
    },
  });

  mocks.getFrontDeskContext.mockResolvedValue({
    userId: "auth-user",
    role: "crm",
    branchId,
    branchName: "Main Branch",
    capabilities: {},
    allowedDestinations: [],
  });
  mocks.getStaffByBranchWithBranches.mockResolvedValue([]);
  mocks.getPendingStaffByBranch.mockResolvedValue([]);
  mocks.getAllBranches.mockResolvedValue([
    { id: branchId, name: "Main Branch" },
  ]);
  mocks.getBranchAssignableServices.mockResolvedValue([]);
  mocks.getBranchAssignmentIssuesForActor.mockResolvedValue([]);
  mocks.canReviewStaffOnboarding.mockReturnValue(false);
});

describe("PERF-7 CRM Staff server loader", () => {
  it("does not execute privileged onboarding reads when the reviewer lacks permission", async () => {
    const result = await loadCrmStaffWorkspaceData();

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.data.canReviewOnboarding).toBe(false);
    expect(result.data.onboardingRequests).toEqual([]);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(
      mocks.getBranchAssignmentIssuesForActor
    ).toHaveBeenCalledWith({
      systemRole: "crm",
      branchId,
    });
  });

  it("keeps privileged onboarding reads branch-scoped for a permitted non-owner reviewer", async () => {
    const eqCalls: Array<[string, unknown]> = [];
    const onboardingRows = [
      {
        id: "request-1",
        status: "submitted",
        requested_branch_id: branchId,
      },
    ];

    const onboardingQuery = {
      select: () => onboardingQuery,
      eq: (column: string, value: unknown) => {
        eqCalls.push([column, value]);
        return onboardingQuery;
      },
      order: async () => ({
        data: onboardingRows,
        error: null,
      }),
    };

    mocks.canReviewStaffOnboarding.mockReturnValue(true);
    mocks.createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "staff_onboarding_requests") {
          throw new Error(`Unexpected table ${table}`);
        }
        return onboardingQuery;
      },
    });

    const branchIssue = {
      id: "issue-1",
      staffId: "staff-1",
      staffName: "Therapist One",
      status: "open",
    };
    mocks.getBranchAssignmentIssuesForActor.mockResolvedValue([
      branchIssue,
    ]);

    const result = await loadCrmStaffWorkspaceData();

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(eqCalls).toContainEqual(["status", "submitted"]);
    expect(eqCalls).toContainEqual([
      "requested_branch_id",
      branchId,
    ]);
    expect(result.data.onboardingRequests).toEqual(
      onboardingRows
    );
    expect(result.data.branchCorrectionRequests).toEqual([
      branchIssue,
    ]);
  });
});
