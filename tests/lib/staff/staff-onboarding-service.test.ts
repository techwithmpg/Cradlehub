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
import { logError } from "@/lib/logger";

describe("staff-onboarding-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("approveStaffOnboardingRequest — Branch Authority", () => {
    it("rejects when manager attempts to approve into another branch even if request was for manager branch", async () => {
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
                full_name: "Applicant One",
                metadata: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "mgr-1",
          authUserId: "user-mgr",
          systemRole: "manager",
          branchId: "branch-main",
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
        expect(res.code).toBe("BRANCH_MISMATCH");
        expect(res.error).toContain("You can only approve staff into your own branch");
      }
    });

    it("allows manager approving within their own branch", async () => {
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
                    full_name: "Applicant One",
                    metadata: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "req-1" }, error: null }),
                  }),
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
                  data: {
                    id: "staff-1",
                    is_active: false,
                    branch_id: "branch-main",
                    system_role: "staff",
                    staff_type: "therapist",
                    tier: "junior",
                    nickname: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "staff-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "mgr-1",
          authUserId: "user-mgr",
          systemRole: "manager",
          branchId: "branch-main",
        },
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
        },
      });

      expect(res.ok).toBe(true);
    });

    it("rejects when CRM role attempts to approve into another branch", async () => {
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
                full_name: "Applicant One",
                metadata: null,
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "crm-1",
          authUserId: "user-crm",
          systemRole: "crm",
          branchId: "branch-main",
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
        expect(["BRANCH_MISMATCH", "FORBIDDEN"]).toContain(res.code);
      }
    });

    it("allows owner cross-branch approval when permitted", async () => {
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
                    full_name: "Applicant One",
                    metadata: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "req-1" }, error: null }),
                  }),
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
                  data: {
                    id: "staff-1",
                    is_active: false,
                    branch_id: "branch-main",
                    system_role: "staff",
                    staff_type: "therapist",
                    tier: "junior",
                    nickname: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "staff-1" }, error: null }),
                }),
              }),
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
          branchId: "branch-main",
        },
        requestId: "req-1",
        input: {
          branchId: "branch-north",
          systemRole: "staff",
          tier: "junior",
        },
      });

      expect(res.ok).toBe(true);
    });
  });

  describe("approveStaffOnboardingRequest — Compensation & Concurrency", () => {
    const priorStaffRecord = {
      id: "staff-1",
      is_active: false,
      branch_id: "branch-main",
      system_role: "staff",
      staff_type: "therapist",
      tier: "junior",
      nickname: "PriorNick",
    };

    it("A1. staff update DB error -> no later mutations executed", async () => {
      const rpcMock = vi.fn();

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
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: { message: "DB disk full" } }),
                }),
              }),
            }),
          };
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });
      mockAdminClient.rpc = rpcMock;

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
      }
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("A2. initial staff update affects zero rows -> returns SAVE_FAILED and does not continue to capability synchronization", async () => {
      const rpcMock = vi.fn();

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
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  // Zero rows returned
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });
      mockAdminClient.rpc = rpcMock;

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
        expect(res.error).toBe("Target staff record could not be updated.");
      }
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("B. capability RPC failure -> prior staff restored with exact prior values", async () => {
      const staffUpdatePayloads: Array<Record<string, unknown>> = [];
      const staffUpdateMock = vi.fn().mockImplementation((payload: unknown) => {
        staffUpdatePayloads.push(payload);
        return {
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "staff-1" }, error: null }),
            }),
          }),
        };
      });

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
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: staffUpdateMock,
          };
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      mockAdminClient.rpc = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: "RPC failed" },
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
        expect(res.error).toContain("Activated staff but failed to set services");
      }
      expect(staffUpdatePayloads.length).toBe(2);
      // Explicitly verify the staff rollback payload contains the previous fields
      expect(staffUpdatePayloads[1]).toEqual({
        is_active: priorStaffRecord.is_active,
        branch_id: priorStaffRecord.branch_id,
        system_role: priorStaffRecord.system_role,
        staff_type: priorStaffRecord.staff_type,
        tier: priorStaffRecord.tier,
        nickname: priorStaffRecord.nickname,
      });
    });

    it("C. onboarding-request update failure AFTER capability replacement -> restores staff row AND prior capabilities", async () => {
      const priorCapRows = [{ service_id: "prior-svc-1" }, { service_id: "prior-svc-2" }];
      const staffUpdatePayloads: Array<Record<string, unknown>> = [];
      const staffUpdateMock = vi.fn().mockImplementation((payload: unknown) => {
        staffUpdatePayloads.push(payload);
        return {
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "staff-1" }, error: null }),
            }),
          }),
        };
      });
      const rpcCalls: Array<{ name: string; args: { p_service_ids?: string[] } }> = [];

      mockAdminClient.rpc = vi.fn().mockImplementation((name, args) => {
        rpcCalls.push({ name, args });
        return Promise.resolve({ data: null, error: null });
      });

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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: "Request update failed in DB" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "staff") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: staffUpdateMock,
          };
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: priorCapRows, error: null }),
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
          serviceIds: ["new-svc-1"],
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("SAVE_FAILED");
      }
      // Staff rollback called with exact prior values
      expect(staffUpdatePayloads.length).toBe(2);
      expect(staffUpdatePayloads[1]).toEqual({
        is_active: priorStaffRecord.is_active,
        branch_id: priorStaffRecord.branch_id,
        system_role: priorStaffRecord.system_role,
        staff_type: priorStaffRecord.staff_type,
        tier: priorStaffRecord.tier,
        nickname: priorStaffRecord.nickname,
      });
      // Capability rollback called with PRIOR capability IDs
      expect(rpcCalls.length).toBe(2);
      expect(rpcCalls[0]?.args.p_service_ids).toEqual(["new-svc-1"]);
      expect(rpcCalls[1]?.args.p_service_ids).toEqual(["prior-svc-1", "prior-svc-2"]);
    });

    it("D. staff rollback failure -> logs consistency failure and returns error", async () => {
      mockAdminClient.rpc = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: "Cap RPC fail" },
      });

      let updateCount = 0;
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
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: vi.fn().mockImplementation(() => {
              updateCount++;
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi
                      .fn()
                      .mockImplementation(() =>
                        Promise.resolve(
                          updateCount === 1
                            ? { data: { id: "staff-1" }, error: null }
                            : { data: null, error: { message: "Deadlock during staff rollback" } }
                        )
                      ),
                  }),
                }),
              };
            }),
          };
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
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
      expect(logError).toHaveBeenCalledWith(
        "staff.onboarding.compensation_incomplete_critical",
        expect.anything()
      );
    });

    it("E. capability rollback failure -> logs consistency failure and returns error", async () => {
      let rpcCount = 0;
      mockAdminClient.rpc = vi.fn().mockImplementation(() => {
        rpcCount++;
        if (rpcCount === 1) return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: { message: "Cap rollback DB failure" } });
      });

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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: "Request update failed" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "staff") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "staff-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ service_id: "prior-1" }], error: null }),
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
          serviceIds: ["new-1"],
        },
      });

      expect(res.ok).toBe(false);
      expect(logError).toHaveBeenCalledWith(
        "staff.onboarding.compensation_incomplete_critical",
        expect.anything()
      );
    });

    it("F1. request lost submitted status (race) + compensation succeeds -> returns INVALID_STATE", async () => {
      const staffUpdatePayloads: Array<Record<string, unknown>> = [];
      const rollbackStaffMock = vi.fn().mockImplementation((payload: unknown) => {
        staffUpdatePayloads.push(payload);
        return {
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "staff-1" }, error: null }),
            }),
          }),
        };
      });

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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    // 0 rows updated because another reviewer changed status from submitted
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "staff") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: rollbackStaffMock,
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
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INVALID_STATE");
        expect(res.error).toContain("already been reviewed by another user");
      }
      expect(staffUpdatePayloads.length).toBe(2);
      expect(staffUpdatePayloads[1]).toEqual({
        is_active: priorStaffRecord.is_active,
        branch_id: priorStaffRecord.branch_id,
        system_role: priorStaffRecord.system_role,
        staff_type: priorStaffRecord.staff_type,
        tier: priorStaffRecord.tier,
        nickname: priorStaffRecord.nickname,
      });
    });

    it("F2. request lost submitted status (race) + staff rollback fails -> returns SAVE_FAILED and logs critical error", async () => {
      let staffUpdateCount = 0;
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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    // Concurrent reviewer won the race: 0 rows updated
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "staff") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: vi.fn().mockImplementation(() => {
              staffUpdateCount++;
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi
                      .fn()
                      .mockImplementation(() =>
                        Promise.resolve(
                          staffUpdateCount === 1
                            ? { data: { id: "staff-1" }, error: null }
                            : { data: null, error: { message: "Staff rollback connection error" } }
                        )
                      ),
                  }),
                }),
              };
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
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("SAVE_FAILED");
        expect(res.error).toContain("rollback could not be fully completed");
      }
      expect(logError).toHaveBeenCalledWith(
        "staff.onboarding.compensation_incomplete_critical",
        expect.anything()
      );
    });

    it("F3. request lost submitted status (race) + capability rollback fails -> returns SAVE_FAILED and logs critical error", async () => {
      let rpcCount = 0;
      mockAdminClient.rpc = vi.fn().mockImplementation(() => {
        rpcCount++;
        if (rpcCount === 1) return Promise.resolve({ data: null, error: null }); // initial replace ok
        return Promise.resolve({
          data: null,
          error: { message: "RPC capability rollback timeout" },
        }); // rollback fails
      });

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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    // Concurrent reviewer won the race
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "staff") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: priorStaffRecord, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "staff-1" }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ service_id: "prior-svc-1" }], error: null }),
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
          serviceIds: ["new-svc-1"],
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("SAVE_FAILED");
        expect(res.error).toContain("rollback could not be fully completed");
      }
      expect(logError).toHaveBeenCalledWith(
        "staff.onboarding.compensation_incomplete_critical",
        expect.anything()
      );
    });
  });

  describe("rejectStaffOnboardingRequest — Concurrency & Permission", () => {
    it("returns INVALID_STATE when request was concurrently reviewed before rejection write", async () => {
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
                    full_name: "Applicant One",
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
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
        input: { rejectionReason: "Position filled" },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INVALID_STATE");
        expect(res.error).toContain("already been reviewed by another user");
      }
    });

    it("rejects successfully when request status is submitted", async () => {
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
                    full_name: "Applicant One",
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "req-1" },
                      error: null,
                    }),
                  }),
                }),
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
