import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

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

const mockAuthenticatedClient = {
  rpc: vi.fn(),
  from: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

import {
  approveStaffOnboardingRequest,
  rejectStaffOnboardingRequest,
} from "@/lib/staff/staff-onboarding-service";
import { logError } from "@/lib/logger";

type QueryFilter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "is"; column: string; value: unknown }
  | { type: "contains"; column: string; value: unknown };

interface QueryChainInstance {
  filters: QueryFilter[];
  updatePayload?: Record<string, unknown>;
  selectColumns?: string;
  select: (cols?: string) => QueryChainInstance;
  update: (payload: Record<string, unknown>) => QueryChainInstance;
  eq: (column: string, value: unknown) => QueryChainInstance;
  is: (column: string, value: unknown) => QueryChainInstance;
  contains: (column: string, value: unknown) => QueryChainInstance;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
}

function createQueryChain(config: {
  onMaybeSingle?: (chain: QueryChainInstance) => Promise<{ data: unknown; error: unknown }>;
  onUpdate?: (payload: Record<string, unknown>, chain: QueryChainInstance) => void;
}): QueryChainInstance {
  const filters: QueryFilter[] = [];
  let updatePayload: Record<string, unknown> | undefined;
  let selectColumns: string | undefined;

  const chain: QueryChainInstance = {
    filters,
    get updatePayload() {
      return updatePayload;
    },
    get selectColumns() {
      return selectColumns;
    },
    select(cols) {
      selectColumns = cols;
      return chain;
    },
    update(payload) {
      updatePayload = payload;
      config.onUpdate?.(payload, chain);
      return chain;
    },
    eq(column, value) {
      filters.push({ type: "eq", column, value });
      return chain;
    },
    is(column, value) {
      filters.push({ type: "is", column, value });
      return chain;
    },
    contains(column, value) {
      filters.push({ type: "contains", column, value });
      return chain;
    },
    maybeSingle() {
      if (config.onMaybeSingle) {
        return config.onMaybeSingle(chain);
      }
      return Promise.resolve({ data: null, error: null });
    },
    single() {
      if (config.onMaybeSingle) {
        return config.onMaybeSingle(chain);
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  return chain;
}

describe("staff-onboarding-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("approveStaffOnboardingRequest — Branch Authority", () => {
    it("rejects when manager attempts to approve into another branch even if request was for manager branch", async () => {
      mockAdminClient.from.mockReturnValue(
        createQueryChain({
          onMaybeSingle: () =>
            Promise.resolve({
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
        })
      );

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "mgr-1",
          authUserId: "user-mgr",
          systemRole: "manager",
          branchId: "branch-main",
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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
          return createQueryChain({
            onMaybeSingle: (chain) => {
              if (chain.updatePayload) {
                return Promise.resolve({ data: { id: "req-1" }, error: null });
              }
              return Promise.resolve({
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
              });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: () =>
              Promise.resolve({
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
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "mgr-1",
          authUserId: "user-mgr",
          systemRole: "manager",
          branchId: "branch-main",
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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
      mockAdminClient.from.mockReturnValue(
        createQueryChain({
          onMaybeSingle: () =>
            Promise.resolve({
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
        })
      );

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "crm-1",
          authUserId: "user-crm",
          systemRole: "crm",
          branchId: "branch-main",
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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

    it("allows owner cross-branch approval when permitted", async () => {
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: (chain) => {
              if (chain.updatePayload) {
                return Promise.resolve({ data: { id: "req-1" }, error: null });
              }
              return Promise.resolve({
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
              });
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: () =>
              Promise.resolve({
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
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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

    it("1. Authorized successful approval -> claims request first, mutates staff, syncs capabilities via authenticatedClient (NOT admin.rpc)", async () => {
      const operations: string[] = [];
      const staffUpdatePayloads: Record<string, unknown>[] = [];
      const requestUpdatePayloads: Record<string, unknown>[] = [];

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({ data: [], error: null });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onUpdate: (payload) => {
              operations.push("claim_request");
              requestUpdatePayloads.push(payload);
            },
            onMaybeSingle: () => {
              if (requestUpdatePayloads.length === 0) {
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
              return Promise.resolve({ data: { id: "req-1" }, error: null });
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
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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

      // Prove conceptual order: Claim request FIRST, then mutate staff
      expect(operations).toEqual(["claim_request", "mutate_staff"]);
      expect(requestUpdatePayloads[0]?.status).toBe("approved");
      expect(staffUpdatePayloads[0]?.is_active).toBe(true);

      // BLOCKER 1: Prove capability RPC was called through authenticatedClient, NOT mockAdminClient!
      expect(mockAuthenticatedClient.rpc).toHaveBeenCalledWith(
        "replace_staff_service_capabilities",
        {
          p_target_staff_id: "staff-1",
          p_service_ids: ["svc-1", "svc-2"],
        }
      );
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });

    it("2. Pre-check: Request already reviewed before claim attempt -> returns INVALID_STATE without making any mutations", async () => {
      const staffUpdateMock = vi.fn();
      const requestUpdateMock = vi.fn();

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
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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
      expect(mockAuthenticatedClient.rpc).not.toHaveBeenCalled();
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });

    it("3. Deterministic Shared-State Concurrency (BLOCKER 5): Two reviewers race on submitted request -> exactly ONE claims and mutates; losing reviewer makes ZERO mutations", async () => {
      // Shared simulated database state
      const sharedDb = {
        claimed: false,
        claimedBy: null as string | null,
        staffMutations: [] as { actor: string; payload: Record<string, unknown> }[],
        capabilityCalls: [] as {
          actor: string;
          p_target_staff_id: string;
          p_service_ids: string[];
        }[],
      };

      // Reviewer A client and Reviewer B client
      const clientA = {
        rpc: vi.fn(
          async (fn: string, args: { p_target_staff_id: string; p_service_ids: string[] }) => {
            sharedDb.capabilityCalls.push({ actor: "reviewer-a", ...args });
            return { data: [], error: null };
          }
        ),
      };
      const clientB = {
        rpc: vi.fn(
          async (fn: string, args: { p_target_staff_id: string; p_service_ids: string[] }) => {
            sharedDb.capabilityCalls.push({ actor: "reviewer-b", ...args });
            return { data: [], error: null };
          }
        ),
      };

      let currentActorCalling = "none";

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              // Read before claim
              if (!chain.updatePayload) {
                return {
                  data: {
                    id: "req-race-1",
                    requested_branch_id: "branch-main",
                    staff_id: "staff-race-1",
                    status: "submitted",
                    preferred_role: "therapist",
                    full_name: "Race Staff",
                    metadata: null,
                  },
                  error: null,
                };
              }
              // Conditional claim update: .eq("status", "submitted")
              const statusFilter = chain.filters.find(
                (f) => f.type === "eq" && f.column === "status" && f.value === "submitted"
              );
              if (statusFilter && !sharedDb.claimed) {
                sharedDb.claimed = true;
                sharedDb.claimedBy = currentActorCalling;
                return { data: { id: "req-race-1" }, error: null };
              }
              // Claim failed because already claimed!
              return { data: null, error: null };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                sharedDb.staffMutations.push({
                  actor: currentActorCalling,
                  payload: chain.updatePayload,
                });
                return { data: { id: "staff-race-1" }, error: null };
              }
              return {
                data: {
                  id: "staff-race-1",
                  is_active: false,
                  branch_id: "branch-main",
                  system_role: "staff",
                  staff_type: "therapist",
                  tier: "junior",
                  nickname: null,
                },
                error: null,
              };
            },
          });
        }
        return createQueryChain({});
      });

      // Reviewer A calls approval
      currentActorCalling = "reviewer-a";
      const resA = await approveStaffOnboardingRequest({
        actor: {
          staffId: "reviewer-a",
          authUserId: "user-a",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: clientA as unknown as SupabaseClient<Database>,
        requestId: "req-race-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
          serviceIds: ["svc-1"],
        },
      });

      // Reviewer B calls approval on same request
      currentActorCalling = "reviewer-b";
      const resB = await approveStaffOnboardingRequest({
        actor: {
          staffId: "reviewer-b",
          authUserId: "user-b",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: clientB as unknown as SupabaseClient<Database>,
        requestId: "req-race-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
          serviceIds: ["svc-1"],
        },
      });

      // Assertions required by BLOCKER 5:
      expect(resA.ok).toBe(true);
      expect(resB.ok).toBe(false);
      if (!resB.ok) {
        expect(resB.code).toBe("INVALID_STATE");
        expect(resB.error).toContain("already been reviewed by another user");
      }

      // Exactly ONE approval reaches staff mutation
      expect(sharedDb.staffMutations.length).toBe(1);
      expect(sharedDb.staffMutations[0]!.actor).toBe("reviewer-a");

      // Exactly ONE approval reaches capability RPC
      expect(sharedDb.capabilityCalls.length).toBe(1);
      expect(sharedDb.capabilityCalls[0]!.actor).toBe("reviewer-a");
      expect(clientA.rpc).toHaveBeenCalledTimes(1);
      expect(clientB.rpc).toHaveBeenCalledTimes(0);

      // Admin RPC was never called
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });

    it("4. Post-claim failure: Staff update DB error immediately after claim -> conditionally compensates onboarding request with write guards (BLOCKER 3)", async () => {
      let requestUpdateCount = 0;
      let requestFetchCount = 0;
      const requestChains: QueryChainInstance[] = [];

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                // Initial read
                return {
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
                };
              }
              if (chain.updatePayload && requestUpdateCount === 0) {
                // Claim update
                requestUpdateCount++;
                requestChains.push(chain);
                return { data: { id: "req-1" }, error: null };
              }
              if (requestFetchCount === 3) {
                // Compensation pre-check
                return {
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                    reviewed_at: requestChains[0]?.updatePayload?.reviewed_at,
                    requested_branch_id: "branch-main",
                    metadata: requestChains[0]?.updatePayload?.metadata,
                  },
                  error: null,
                };
              }
              // Compensation rollback update
              requestChains.push(chain);
              return { data: { id: "req-1" }, error: null };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: null, error: { message: "DB disk full on staff update" } };
              }
              return { data: priorStaffRecord, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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

      // Assert rollback query guarded all required fields (BLOCKER 3 & 7)
      const rollbackChain = requestChains[1];
      expect(rollbackChain).toBeDefined();
      expect(rollbackChain?.filters).toEqual(
        expect.arrayContaining([
          { type: "eq", column: "id", value: "req-1" },
          { type: "eq", column: "status", value: "approved" },
          { type: "eq", column: "reviewed_by_staff_id", value: "owner-1" },
          { type: "eq", column: "requested_branch_id", value: "branch-main" },
          expect.objectContaining({ type: "eq", column: "metadata", value: expect.any(String) }),
        ])
      );
      expect(mockAuthenticatedClient.rpc).not.toHaveBeenCalled();
    });

    it("5. Post-claim failure: Capability replacement RPC failure -> conditionally compensates staff row and request; no capability rollback attempted (BLOCKER 1, 2, 4)", async () => {
      const staffChains: QueryChainInstance[] = [];
      const requestChains: QueryChainInstance[] = [];
      let requestFetchCount = 0;
      let staffFetchCount = 0;

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC timeout" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                return {
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
                };
              }
              if (chain.updatePayload && requestChains.length === 0) {
                requestChains.push(chain);
                return { data: { id: "req-1" }, error: null };
              }
              if (requestFetchCount === 3) {
                return {
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                    reviewed_at: requestChains[0]?.updatePayload?.reviewed_at,
                    requested_branch_id: "branch-main",
                    metadata: requestChains[0]?.updatePayload?.metadata,
                  },
                  error: null,
                };
              }
              requestChains.push(chain);
              return { data: { id: "req-1" }, error: null };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                return { data: priorStaffRecord, error: null };
              }
              if (chain.updatePayload && staffChains.length === 0) {
                staffChains.push(chain);
                return { data: { id: "staff-1" }, error: null };
              }
              if (staffFetchCount === 3) {
                return {
                  data: {
                    ...priorStaffRecord,
                    is_active: true,
                    branch_id: "branch-main",
                    system_role: "staff",
                    staff_type: "therapist",
                    tier: "junior",
                  },
                  error: null,
                };
              }
              staffChains.push(chain);
              return { data: { id: "staff-1" }, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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

      // BLOCKER 2 & 7: Verify staff rollback query explicitly guarded staff_type along with all fields
      const staffRollbackChain = staffChains[1];
      expect(staffRollbackChain).toBeDefined();
      expect(staffRollbackChain?.filters).toEqual(
        expect.arrayContaining([
          { type: "eq", column: "id", value: "staff-1" },
          { type: "eq", column: "is_active", value: true },
          { type: "eq", column: "branch_id", value: "branch-main" },
          { type: "eq", column: "system_role", value: "staff" },
          { type: "eq", column: "staff_type", value: "therapist" },
          { type: "eq", column: "tier", value: "junior" },
        ])
      );

      // BLOCKER 4: replace_staff_service_capabilities was called via authenticatedClient,
      // and NO application-level capability rollback was invoked
      expect(mockAuthenticatedClient.rpc).toHaveBeenCalledTimes(1);
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });

    it("6. Staff write guard (BLOCKER 2 & 6): staff_type changed concurrently -> conditional rollback fails write guard and SKIPS restoring staff row", async () => {
      let staffFetchCount = 0;
      const staffChains: QueryChainInstance[] = [];

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC failed" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: { id: "req-1" }, error: null };
              }
              return {
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
              };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                return { data: priorStaffRecord, error: null };
              }
              if (chain.updatePayload && staffChains.length === 0) {
                staffChains.push(chain);
                return { data: { id: "staff-1" }, error: null };
              }
              if (staffFetchCount === 3) {
                // Pre-check verification read passes
                return {
                  data: {
                    ...priorStaffRecord,
                    is_active: true,
                    branch_id: "branch-main",
                    system_role: "staff",
                    staff_type: "therapist",
                    tier: "junior",
                  },
                  error: null,
                };
              }
              // Concurrently, staff_type changed to managerial between pre-check and write!
              // The update query has .eq("staff_type", "therapist") which returns 0 rows!
              staffChains.push(chain);
              return { data: null, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
          serviceIds: ["svc-1"],
        },
      });

      expect(res.ok).toBe(false);
      // Rollback write guard failed, logged concurrent conflict
      expect(logError).toHaveBeenCalledWith(
        "staff.onboarding.compensation_staff_concurrent_conflict",
        expect.anything()
      );
    });

    it("7. Nickname safety (BLOCKER 2 & 6): When approval did NOT change nickname -> rollback payload does NOT touch nickname", async () => {
      const staffChains: QueryChainInstance[] = [];
      let staffFetchCount = 0;

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC failed" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async () => ({
              data: {
                id: "req-1",
                requested_branch_id: "branch-main",
                staff_id: "staff-1",
                status: "submitted",
                preferred_role: "therapist",
                full_name: "Test Staff",
                metadata: { nickname: null }, // NO nickname change
              },
              error: null,
            }),
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                return { data: priorStaffRecord, error: null };
              }
              if (chain.updatePayload && staffChains.length === 0) {
                staffChains.push(chain);
                return { data: { id: "staff-1" }, error: null };
              }
              if (staffFetchCount === 3) {
                return {
                  data: {
                    ...priorStaffRecord,
                    is_active: true,
                    nickname: "PriorNick",
                  },
                  error: null,
                };
              }
              staffChains.push(chain);
              return { data: { id: "staff-1" }, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
          serviceIds: ["svc-1"],
        },
      });

      expect(res.ok).toBe(false);
      // Staff rollback payload MUST NOT contain nickname when approval did not change it!
      const rollbackChain = staffChains[1];
      expect(rollbackChain).toBeDefined();
      expect(rollbackChain?.updatePayload).not.toHaveProperty("nickname");
      // And query filters must not filter on nickname
      expect(rollbackChain?.filters.some((f) => f.column === "nickname")).toBe(false);
    });

    it("8. Nickname safety (BLOCKER 2 & 6): When approval DID change nickname -> rollback conditions on applied nickname and restores prior nickname", async () => {
      const staffChains: QueryChainInstance[] = [];
      let staffFetchCount = 0;

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC failed" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async () => ({
              data: {
                id: "req-1",
                requested_branch_id: "branch-main",
                staff_id: "staff-1",
                status: "submitted",
                preferred_role: "therapist",
                full_name: "Test Staff",
                metadata: { nickname: "NewNick" }, // Approval DID change nickname from PriorNick to NewNick!
              },
              error: null,
            }),
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                return { data: priorStaffRecord, error: null };
              }
              if (chain.updatePayload && staffChains.length === 0) {
                staffChains.push(chain);
                return { data: { id: "staff-1" }, error: null };
              }
              if (staffFetchCount === 3) {
                return {
                  data: {
                    ...priorStaffRecord,
                    is_active: true,
                    nickname: "NewNick",
                  },
                  error: null,
                };
              }
              staffChains.push(chain);
              return { data: { id: "staff-1" }, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
          serviceIds: ["svc-1"],
        },
      });

      expect(res.ok).toBe(false);
      const rollbackChain = staffChains[1];
      expect(rollbackChain).toBeDefined();
      // Restores prior nickname
      expect(rollbackChain?.updatePayload?.nickname).toBe("PriorNick");
      // Conditionally guards on applied nickname
      expect(rollbackChain?.filters).toEqual(
        expect.arrayContaining([{ type: "eq", column: "nickname", value: "NewNick" }])
      );
    });

    it("9. Request compensation guard (BLOCKER 3 & 6): reviewed_at changed legitimately after claim -> compensation SKIPS request rollback", async () => {
      let requestFetchCount = 0;
      let requestUpdateCount = 0;

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC failed" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                return {
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
                };
              }
              if (chain.updatePayload && requestUpdateCount === 0) {
                requestUpdateCount++;
                return { data: { id: "req-1" }, error: null };
              }
              if (requestFetchCount === 3) {
                // Later legitimate change updated reviewed_at!
                return {
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                    reviewed_at: "2099-01-01T00:00:00.000Z", // CHANGED!
                    requested_branch_id: "branch-main",
                    metadata: { approved_at: "2099-01-01T00:00:00.000Z" },
                  },
                  error: null,
                };
              }
              return { data: { id: "req-1" }, error: null };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: { id: "staff-1" }, error: null };
              }
              return { data: priorStaffRecord, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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
        "staff.onboarding.compensation_request_skipped_state_mismatch",
        expect.anything()
      );
    });

    it("10. Request compensation guard (BLOCKER 3 & 6): requested_branch_id changed legitimately after claim -> compensation SKIPS request rollback", async () => {
      let requestFetchCount = 0;
      let requestUpdateCount = 0;

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC failed" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                return {
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
                };
              }
              if (chain.updatePayload && requestUpdateCount === 0) {
                requestUpdateCount++;
                return { data: { id: "req-1" }, error: null };
              }
              if (requestFetchCount === 3) {
                // Later legitimate change updated branch!
                return {
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                    reviewed_at: "2026-09-01T00:00:00.000Z",
                    requested_branch_id: "branch-different", // CHANGED!
                    metadata: { approved_at: "2026-09-01T00:00:00.000Z" },
                  },
                  error: null,
                };
              }
              return { data: { id: "req-1" }, error: null };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: { id: "staff-1" }, error: null };
              }
              return { data: priorStaffRecord, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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
        "staff.onboarding.compensation_request_skipped_state_mismatch",
        expect.anything()
      );
    });

    it("11. Request compensation guard (BLOCKER 3 & 6): metadata operation marker changed -> compensation SKIPS request rollback", async () => {
      let requestFetchCount = 0;
      let requestUpdateCount = 0;

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC failed" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                return {
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
                };
              }
              if (chain.updatePayload && requestUpdateCount === 0) {
                requestUpdateCount++;
                return { data: { id: "req-1" }, error: null };
              }
              if (requestFetchCount === 3) {
                // Later legitimate update changed approved_at marker!
                return {
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                    reviewed_at: "2026-09-01T00:00:00.000Z",
                    requested_branch_id: "branch-main",
                    metadata: { approved_at: "2099-12-31T23:59:59.000Z" }, // Operation marker differs!
                  },
                  error: null,
                };
              }
              return { data: { id: "req-1" }, error: null };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: { id: "staff-1" }, error: null };
              }
              return { data: priorStaffRecord, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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
        "staff.onboarding.compensation_request_skipped_state_mismatch",
        expect.anything()
      );
    });

    it("11b. Request compensation guard: non-marker metadata property (assigned_tier) changed while approved_at unchanged -> compensation SKIPS request rollback", async () => {
      let requestFetchCount = 0;
      let requestUpdateCount = 0;
      const requestChains: QueryChainInstance[] = [];

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC failed" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              requestFetchCount++;
              if (requestFetchCount === 1) {
                return {
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
                };
              }
              if (chain.updatePayload && requestUpdateCount === 0) {
                requestUpdateCount++;
                requestChains.push(chain);
                return { data: { id: "req-1" }, error: null };
              }
              if (requestFetchCount === 3) {
                // Later legitimate update changed assigned_tier while approved_at remains identical!
                const claimedMeta = (requestChains[0]?.updatePayload?.metadata ?? {}) as Record<
                  string,
                  unknown
                >;
                return {
                  data: {
                    id: "req-1",
                    status: "approved",
                    reviewed_by_staff_id: "owner-1",
                    reviewed_at: requestChains[0]?.updatePayload?.reviewed_at,
                    requested_branch_id: "branch-main",
                    metadata: {
                      ...claimedMeta,
                      assigned_tier: "senior", // Legitimate change after approval!
                    },
                  },
                  error: null,
                };
              }
              // If compensation incorrectly attempted update
              requestChains.push(chain);
              return { data: { id: "req-1" }, error: null };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: { id: "staff-1" }, error: null };
              }
              return { data: priorStaffRecord, error: null };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
        requestId: "req-1",
        input: {
          branchId: "branch-main",
          systemRole: "staff",
          tier: "junior",
          serviceIds: ["svc-1"],
        },
      });

      expect(res.ok).toBe(false);
      // Rollback was skipped: only initial claim update was executed on requests, no rollback update
      expect(requestChains.length).toBe(1);
      expect(logError).toHaveBeenCalledWith(
        "staff.onboarding.compensation_request_skipped_state_mismatch",
        expect.objectContaining({
          requestId: "req-1",
        })
      );
    });

    it("12. Compensation error: DB deadlock during conditional staff rollback -> logs consistency failure truthfully", async () => {
      let staffFetchCount = 0;
      let staffUpdateCount = 0;

      mockAuthenticatedClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Capability RPC failed" },
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: { id: "req-1" }, error: null };
              }
              return {
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
              };
            },
          });
        }
        if (table === "staff") {
          return createQueryChain({
            onUpdate: () => {
              staffUpdateCount++;
            },
            onMaybeSingle: async () => {
              staffFetchCount++;
              if (staffFetchCount === 1) {
                return { data: priorStaffRecord, error: null };
              }
              if (staffFetchCount === 2) {
                return { data: { id: "staff-1" }, error: null };
              }
              if (staffFetchCount === 3) {
                return {
                  data: {
                    ...priorStaffRecord,
                    is_active: true,
                    branch_id: "branch-main",
                    system_role: "staff",
                    staff_type: "therapist",
                    tier: "junior",
                  },
                  error: null,
                };
              }
              // Deadlock during rollback
              return { data: null, error: { message: "Deadlock during staff rollback" } };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await approveStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        authenticatedClient: mockAuthenticatedClient as unknown as SupabaseClient<Database>,
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
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: null, error: null };
              }
              return {
                data: {
                  id: "req-1",
                  requested_branch_id: "branch-main",
                  status: "submitted",
                  staff_id: "staff-1",
                  full_name: "Applicant One",
                  metadata: null,
                },
                error: null,
              };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await rejectStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        requestId: "req-1",
        input: {
          rejectionReason: "Position filled",
        },
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("INVALID_STATE");
      }
    });

    it("rejects successfully when request status is submitted", async () => {
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "staff_onboarding_requests") {
          return createQueryChain({
            onMaybeSingle: async (chain) => {
              if (chain.updatePayload) {
                return { data: { id: "req-1" }, error: null };
              }
              return {
                data: {
                  id: "req-1",
                  requested_branch_id: "branch-main",
                  status: "submitted",
                  staff_id: "staff-1",
                  full_name: "Applicant One",
                  metadata: null,
                },
                error: null,
              };
            },
          });
        }
        return createQueryChain({});
      });

      const res = await rejectStaffOnboardingRequest({
        actor: {
          staffId: "owner-1",
          authUserId: "user-owner",
          systemRole: "owner",
          branchId: null,
        },
        requestId: "req-1",
        input: {
          rejectionReason: "Position filled",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.requestId).toBe("req-1");
      }
    });
  });
});
