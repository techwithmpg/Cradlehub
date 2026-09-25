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

    function createQueryChain(config: {
      onMaybeSingle: () => Promise<{ data: unknown; error: unknown }>;
      onUpdate?: (payload: Record<string, unknown>) => void;
    }) {
      const chain: Record<string, unknown> = {
        select: vi.fn(() => chain),
        update: vi.fn((payload: Record<string, unknown>) => {
          config.onUpdate?.(payload);
          return chain;
        }),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(() => config.onMaybeSingle()),
      };
      return chain;
    }

    it("1. Authorized successful approval -> claims request first, mutates staff, syncs capabilities, emits events", async () => {
      const operations: string[] = [];
      const staffUpdatePayloads: Record<string, unknown>[] = [];
      const requestUpdatePayloads: Record<string, unknown>[] = [];

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: (payload) => {
              operations.push("claim_request");
              requestUpdatePayloads.push(payload);
            },
            onMaybeSingle: () => {
              if (requestUpdatePayloads.length === 0) {
                // Initial request fetch
                return Promise.resolve({
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
                });
              }
              // Claim request update
              return Promise.resolve({
                data: { id: "req-1" },
                error: null,
              });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: (payload) => {
              operations.push("mutate_staff");
              staffUpdatePayloads.push(payload);
            },
            onMaybeSingle: () => {
              if (staffUpdatePayloads.length === 0) {
                return Promise.resolve({ data: priorStaffRecord, error: null });
              }
              return Promise.resolve({ data: { id: "staff-1" }, error: null });
            },
          });
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ service_id: "svc-prior" }], error: null }),
            }),
          };
        }
        return {};
      });

      mockAdminClient.rpc = vi.fn().mockImplementation((name) => {
        operations.push(`rpc:${name}`);
        return Promise.resolve({ data: null, error: null });
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

      // Prove conceptual order: Claim request FIRST, then mutate staff, then sync capabilities
      expect(operations).toEqual([
        "claim_request",
        "mutate_staff",
        "rpc:replace_staff_service_capabilities",
      ]);
      expect(requestUpdatePayloads[0]?.status).toBe("approved");
      expect(staffUpdatePayloads[0]?.is_active).toBe(true);
      expect(mockAdminClient.rpc).toHaveBeenCalledWith("replace_staff_service_capabilities", {
        p_target_staff_id: "staff-1",
        p_service_ids: ["svc-1", "svc-2"],
      });
    });

    it("2. Pre-check: Request already reviewed before claim attempt -> returns INVALID_STATE without making any mutations", async () => {
      const staffUpdateMock = vi.fn();
      const requestUpdateMock = vi.fn();
      const rpcMock = vi.fn();

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: requestUpdateMock,
            onMaybeSingle: () =>
              Promise.resolve({
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
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: staffUpdateMock,
            onMaybeSingle: () => Promise.resolve({ data: priorStaffRecord, error: null }),
          });
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
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INVALID_STATE");
        expect(res.error).toContain("already been reviewed");
      }
      expect(requestUpdateMock).not.toHaveBeenCalled();
      expect(staffUpdateMock).not.toHaveBeenCalled();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("3. Race condition: Two reviewers race on submitted request -> only winning reviewer mutates; losing reviewer makes ZERO staff/capability mutations and returns INVALID_STATE", async () => {
      const staffUpdateMock = vi.fn();
      const rpcMock = vi.fn();
      let requestUpdateCount = 0;

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: () => {
              requestUpdateCount++;
            },
            onMaybeSingle: () => {
              if (requestUpdateCount === 0) {
                // Initial read returns submitted
                return Promise.resolve({
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
                });
              }
              // Claim update returns 0 rows because another reviewer already claimed it
              return Promise.resolve({ data: null, error: null });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: staffUpdateMock,
            onMaybeSingle: () => Promise.resolve({ data: priorStaffRecord, error: null }),
          });
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
          staffId: "reviewer-b",
          authUserId: "user-b",
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

      // Losing reviewer must return INVALID_STATE
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INVALID_STATE");
        expect(res.error).toContain("already been reviewed by another user");
      }

      // CRITICAL RACE-SAFETY ASSERTION:
      // The losing reviewer MUST NEVER modify staff profile/state, role, service capabilities, or approval-derived fields
      expect(staffUpdateMock).not.toHaveBeenCalled();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("4. Post-claim failure: Staff update DB error immediately after claim -> conditionally compensates onboarding request back to submitted", async () => {
      let requestUpdateCount = 0;
      let requestFetchCount = 0;
      const requestUpdatePayloads: Record<string, unknown>[] = [];
      const staffUpdateMock = vi.fn();

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: (payload) => {
              requestUpdateCount++;
              requestUpdatePayloads.push(payload);
            },
            onMaybeSingle: () => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                // Initial read
                return Promise.resolve({
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
                });
              }
              if (requestUpdateCount === 1 && requestFetchCount === 2) {
                // Claim update returned row
                return Promise.resolve({ data: { id: "req-1" }, error: null });
              }
              if (requestFetchCount === 3) {
                // Compensation pre-check of current request
                return Promise.resolve({
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                  },
                  error: null,
                });
              }
              // Compensation rollback update returned row
              return Promise.resolve({ data: { id: "req-1" }, error: null });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: staffUpdateMock,
            onMaybeSingle: () => {
              if (staffUpdateMock.mock.calls.length === 0) {
                // Initial prior staff fetch
                return Promise.resolve({ data: priorStaffRecord, error: null });
              }
              // Staff mutation fails with DB error
              return Promise.resolve({
                data: null,
                error: { message: "DB disk full on staff update" },
              });
            },
          });
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
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("SAVE_FAILED");
        expect(res.error).toContain("DB disk full on staff update");
      }

      // Request was claimed (call 1), then compensated back to submitted (call 2)
      expect(requestUpdatePayloads.length).toBe(2);
      expect(requestUpdatePayloads[0]?.status).toBe("approved");
      expect(requestUpdatePayloads[1]?.status).toBe("submitted");
      expect(requestUpdatePayloads[1]?.reviewed_by_staff_id).toBeNull();

      // Capabilities were never touched
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });

    it("5. Post-claim failure: Initial staff update affects zero rows -> conditionally compensates onboarding request back to submitted", async () => {
      let requestUpdateCount = 0;
      let requestFetchCount = 0;
      const requestUpdatePayloads: Record<string, unknown>[] = [];
      const staffUpdateMock = vi.fn();

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: (payload) => {
              requestUpdateCount++;
              requestUpdatePayloads.push(payload);
            },
            onMaybeSingle: () => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                // Initial read
                return Promise.resolve({
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
                });
              }
              if (requestUpdateCount === 1 && requestFetchCount === 2) {
                // Claim update returned row
                return Promise.resolve({ data: { id: "req-1" }, error: null });
              }
              if (requestFetchCount === 3) {
                // Compensation pre-check
                return Promise.resolve({
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                  },
                  error: null,
                });
              }
              // Compensation rollback returned row
              return Promise.resolve({ data: { id: "req-1" }, error: null });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: staffUpdateMock,
            onMaybeSingle: () => {
              if (staffUpdateMock.mock.calls.length === 0) {
                return Promise.resolve({ data: priorStaffRecord, error: null });
              }
              // 0 rows updated
              return Promise.resolve({ data: null, error: null });
            },
          });
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
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("SAVE_FAILED");
        expect(res.error).toContain("Target staff record could not be updated");
      }
      expect(requestUpdatePayloads.length).toBe(2);
      expect(requestUpdatePayloads[1]?.status).toBe("submitted");
    });

    it("6. Post-claim failure: Capability replacement RPC failure -> conditionally compensates staff row AND onboarding request", async () => {
      const staffUpdatePayloads: Record<string, unknown>[] = [];
      const requestUpdatePayloads: Record<string, unknown>[] = [];
      let requestFetchCount = 0;
      let staffFetchCount = 0;

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: (payload) => {
              requestUpdatePayloads.push(payload);
            },
            onMaybeSingle: () => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                // Initial read
                return Promise.resolve({
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
                });
              }
              if (requestFetchCount === 2) {
                // Claim update returned row
                return Promise.resolve({ data: { id: "req-1" }, error: null });
              }
              if (requestFetchCount === 3) {
                // Compensation pre-check
                return Promise.resolve({
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                  },
                  error: null,
                });
              }
              // Compensation rollback
              return Promise.resolve({ data: { id: "req-1" }, error: null });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: (payload) => {
              staffUpdatePayloads.push(payload);
            },
            onMaybeSingle: () => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                // Initial prior staff fetch
                return Promise.resolve({ data: priorStaffRecord, error: null });
              }
              if (staffFetchCount === 2) {
                // Mutation update returned row
                return Promise.resolve({ data: { id: "staff-1" }, error: null });
              }
              if (staffFetchCount === 3) {
                // Compensation pre-check: verify current staff matches applied state
                return Promise.resolve({
                  data: {
                    ...priorStaffRecord,
                    is_active: true,
                    branch_id: "branch-main",
                    system_role: "staff",
                    tier: "junior",
                  },
                  error: null,
                });
              }
              // Rollback update returned row
              return Promise.resolve({ data: { id: "staff-1" }, error: null });
            },
          });
        }
        if (table === "staff_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ service_id: "prior-svc" }], error: null }),
            }),
          };
        }
        return {};
      });

      mockAdminClient.rpc = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC timeout" },
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
        expect(res.error).toContain("Activated staff but failed to set services");
      }

      // Staff was mutated (call 1), then compensated back to prior values (call 2)
      expect(staffUpdatePayloads.length).toBe(2);
      expect(staffUpdatePayloads[0]?.is_active).toBe(true);
      expect(staffUpdatePayloads[1]).toEqual({
        is_active: priorStaffRecord.is_active,
        branch_id: priorStaffRecord.branch_id,
        system_role: priorStaffRecord.system_role,
        staff_type: priorStaffRecord.staff_type,
        tier: priorStaffRecord.tier,
        nickname: priorStaffRecord.nickname,
      });

      // Request was claimed (call 1), then compensated back to submitted (call 2)
      expect(requestUpdatePayloads.length).toBe(2);
      expect(requestUpdatePayloads[0]?.status).toBe("approved");
      expect(requestUpdatePayloads[1]?.status).toBe("submitted");
    });

    it("7. Compensation safety: Newer legitimate change on staff -> compensation verifies state and DOES NOT overwrite newer legitimate staff change", async () => {
      const staffUpdatePayloads: Record<string, unknown>[] = [];
      let requestFetchCount = 0;
      let staffFetchCount = 0;

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: () => {},
            onMaybeSingle: () => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                return Promise.resolve({
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
                });
              }
              if (requestFetchCount === 2) {
                return Promise.resolve({ data: { id: "req-1" }, error: null });
              }
              if (requestFetchCount === 3) {
                return Promise.resolve({
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                  },
                  error: null,
                });
              }
              return Promise.resolve({ data: { id: "req-1" }, error: null });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: (payload) => {
              staffUpdatePayloads.push(payload);
            },
            onMaybeSingle: () => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                return Promise.resolve({ data: priorStaffRecord, error: null });
              }
              if (staffFetchCount === 2) {
                return Promise.resolve({ data: { id: "staff-1" }, error: null });
              }
              if (staffFetchCount === 3) {
                // A newer legitimate change occurred in the meantime!
                return Promise.resolve({
                  data: {
                    id: "staff-1",
                    is_active: true,
                    branch_id: "branch-main",
                    system_role: "manager", // CHANGED by another administrator!
                    staff_type: "managerial",
                    tier: "junior",
                    nickname: null,
                  },
                  error: null,
                });
              }
              return Promise.resolve({ data: { id: "staff-1" }, error: null });
            },
          });
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
      // Staff was updated once for approval, but rollback was SKIPPED because state did not match
      expect(staffUpdatePayloads.length).toBe(1);
      expect(logError).toHaveBeenCalledWith(
        "staff.onboarding.compensation_staff_skipped_state_mismatch",
        expect.anything()
      );
    });

    it("8. Compensation safety: Newer legitimate change on onboarding request -> compensation verifies state and DOES NOT overwrite newer legitimate request change", async () => {
      let requestUpdateCount = 0;
      let requestFetchCount = 0;
      let staffFetchCount = 0;

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: () => {
              requestUpdateCount++;
            },
            onMaybeSingle: () => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                return Promise.resolve({
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
                });
              }
              if (requestFetchCount === 2) {
                // Claim update returned row
                return Promise.resolve({ data: { id: "req-1" }, error: null });
              }
              if (requestFetchCount === 3) {
                // When compensation checks, another reviewer has changed the request
                return Promise.resolve({
                  data: {
                    id: "req-1",
                    status: "rejected", // CHANGED by another admin!
                    reviewed_by_staff_id: "other-reviewer",
                  },
                  error: null,
                });
              }
              return Promise.resolve({ data: { id: "req-1" }, error: null });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: () => {},
            onMaybeSingle: () => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                return Promise.resolve({ data: priorStaffRecord, error: null });
              }
              // Staff mutation fails
              return Promise.resolve({ data: null, error: { message: "Staff DB fail" } });
            },
          });
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
        },
      });

      expect(res.ok).toBe(false);
      // Claim was attempted (call 1), but rollback was SKIPPED because request status was changed
      expect(requestUpdateCount).toBe(1);
      expect(logError).toHaveBeenCalledWith(
        "staff.onboarding.compensation_request_skipped_state_mismatch",
        expect.anything()
      );
    });

    it("9. Compensation error: DB error during conditional staff rollback -> logs consistency failure truthfully", async () => {
      let staffFetchCount = 0;
      let staffUpdateCount = 0;
      let requestFetchCount = 0;

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: () => {},
            onMaybeSingle: () => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                return Promise.resolve({
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
                });
              }
              if (requestFetchCount === 2) {
                return Promise.resolve({ data: { id: "req-1" }, error: null });
              }
              if (requestFetchCount === 3) {
                return Promise.resolve({
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                  },
                  error: null,
                });
              }
              return Promise.resolve({ data: { id: "req-1" }, error: null });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: () => {
              staffUpdateCount++;
            },
            onMaybeSingle: () => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                return Promise.resolve({ data: priorStaffRecord, error: null });
              }
              if (staffFetchCount === 2) {
                // Initial mutation succeeds
                return Promise.resolve({ data: { id: "staff-1" }, error: null });
              }
              if (staffFetchCount === 3) {
                // Pre-check matches
                return Promise.resolve({
                  data: {
                    ...priorStaffRecord,
                    is_active: true,
                    branch_id: "branch-main",
                    system_role: "staff",
                    tier: "junior",
                  },
                  error: null,
                });
              }
              // Staff rollback update fails with DB deadlock
              return Promise.resolve({
                data: null,
                error: { message: "Deadlock during staff rollback" },
              });
            },
          });
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
        error: { message: "Capability RPC failed" },
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
      expect(staffUpdateCount).toBe(2);
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
