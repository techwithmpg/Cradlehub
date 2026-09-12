import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/cache/cache-tags", () => ({
  invalidateCrmWorkspace: vi.fn(),
  invalidateManagerWorkspace: vi.fn(),
}));
vi.mock("@/lib/notifications/workflow-signals", () => ({
  emitWorkflowEvent: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}));
vi.mock("@/lib/queries/branches", () => ({
  getAllBranches: vi.fn().mockResolvedValue([
    { id: "branch-main", name: "Main Spa", is_active: true },
    { id: "branch-north", name: "North Spa", is_active: true },
  ]),
}));
vi.mock("@/lib/services/service-catalog", () => ({
  validateBranchServiceEligibility: vi.fn().mockResolvedValue({ ok: true }),
}));

const mockAdminClient = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

import {
  approveStaffOnboardingRequest,
  rejectStaffOnboardingRequest,
} from "@/lib/staff/staff-onboarding-service";

describe("staff-onboarding-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("approveStaffOnboardingRequest", () => {
    it("returns NOT_FOUND when onboarding request does not exist", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "actor-1",
          authUserId: "user-1",
          systemRole: "owner",
          branchId: null,
        },
        requestId: "req-404",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("NOT_FOUND");
      }
    });

    it("returns INVALID_STATE when onboarding request is already reviewed", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "req-1",
                requested_branch_id: "branch-main",
                staff_id: "staff-1",
                status: "approved",
                preferred_role: "therapist",
                full_name: "Test Staff",
                metadata: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "actor-1",
          authUserId: "user-1",
          systemRole: "owner",
          branchId: null,
        },
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INVALID_STATE");
      }
    });

    it("returns FORBIDDEN when actor role is not allowed to approve staff", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "req-1",
                requested_branch_id: "branch-main",
                staff_id: "staff-1",
                status: "submitted",
                preferred_role: "therapist",
                full_name: "Test Staff",
                metadata: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "actor-1",
          authUserId: "user-1",
          systemRole: "staff", // regular staff cannot approve
          branchId: "branch-main",
        },
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORBIDDEN");
      }
    });

    it("returns FORBIDDEN when branch manager attempts to approve for another branch", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "req-1",
                requested_branch_id: "branch-north",
                staff_id: "staff-1",
                status: "submitted",
                preferred_role: "therapist",
                full_name: "Test Staff",
                metadata: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "actor-1",
          authUserId: "user-1",
          systemRole: "manager",
          branchId: "branch-main", // actor is at main, target is north
        },
        requestId: "req-1",
        input: {
          branchId: "branch-north",
          systemRole: "staff",
          tier: "junior",
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORBIDDEN");
      }
    });

    it("approves successfully and server-derives staff_id from the request", async () => {
      const priorStaffRecord = {
        id: "staff-1",
        is_active: false,
        branch_id: null,
        system_role: "staff",
        staff_type: "therapist",
        tier: "junior",
        nickname: null,
      };

      const selectRequestMock = vi.fn().mockResolvedValue({
        data: {
          id: "req-1",
          requested_branch_id: "branch-main",
          staff_id: "staff-1",
          status: "submitted",
          preferred_role: "therapist",
          full_name: "Test Staff",
          metadata: { nickname: "Tester" },
        },
        error: null,
      });

      const selectStaffMock = vi.fn().mockResolvedValue({
        data: priorStaffRecord,
        error: null,
      });

      mockAdminClient.rpc.mockResolvedValue({ data: null, error: null });
      const updateStaffMock = vi.fn().mockResolvedValue({ error: null });
      const updateRequestMock = vi.fn().mockResolvedValue({ error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: selectRequestMock,
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: updateRequestMock,
              }),
            }),
          };
        }
        if (table === "staff") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: selectStaffMock,
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: updateStaffMock,
            }),
          };
        }
        return {};
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
          serviceIds: ["svc-1", "svc-2"],
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.staffId).toBe("staff-1");
        expect(res.data.branchId).toBe("branch-main");
        expect(res.data.systemRole).toBe("staff");
      }
    });

    it("performs compensating rollback when downstream capability update fails", async () => {
      mockAdminClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Failed to persist service capabilities" },
      });

      const priorStaffRecord = {
        id: "staff-1",
        is_active: false,
        branch_id: null,
        system_role: "staff",
        staff_type: "therapist",
        tier: "junior",
        nickname: null,
      };

      const updateStaffRollbackMock = vi.fn().mockResolvedValue({ error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "req-1",
                    requested_branch_id: "branch-main",
                    staff_id: "staff-1",
                    status: "submitted",
                    preferred_role: "therapist",
                    full_name: "Test Staff",
                    metadata: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "staff") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: priorStaffRecord,
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: updateStaffRollbackMock,
            }),
          };
        }
        return {};
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
          serviceIds: ["svc-1"],
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("SAVE_FAILED");
        expect(res.error).toContain("Failed to persist service capabilities");
      }
      // Verify rollback was invoked to restore prior staff state
      expect(updateStaffRollbackMock).toHaveBeenCalled();
    });
  });

  describe("rejectStaffOnboardingRequest", () => {
    it("returns NOT_FOUND when onboarding request does not exist", async () => {
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const res = await rejectStaffOnboardingRequest({
        actor: {
          staffId: "actor-1",
          authUserId: "user-1",
          systemRole: "owner",
          branchId: null,
        },
        requestId: "req-404",
        input: { rejectionReason: "Not qualified" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("NOT_FOUND");
      }
    });

    it("rejects successfully when actor has permission", async () => {
      const updateRequestMock = vi.fn().mockResolvedValue({ error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "req-1",
                    requested_branch_id: "branch-main",
                    staff_id: "staff-1",
                    status: "submitted",
                    full_name: "Candidate One",
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: updateRequestMock,
              }),
            }),
          };
        }
        return {};
      });

      const res = await rejectStaffOnboardingRequest({
        actor: {
          staffId: "actor-1",
          authUserId: "user-1",
          systemRole: "owner",
          branchId: null,
        },
        requestId: "req-1",
        input: { rejectionReason: "Overcapacity" },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.requestId).toBe("req-1");
        expect(res.data.staffId).toBe("staff-1");
      }
    });
  });
});
