import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mutation and select spies
const mockInsertSpy = vi.fn();
const mockUpdateSpy = vi.fn();
const mockDeleteSpy = vi.fn();
const mockUpsertSpy = vi.fn();

const mockGetUser = vi.fn();
const mockStaffSelect = vi.fn();
const mockBookingsSelect = vi.fn();
const mockBranchResourcesSelect = vi.fn();
const mockServicesSelect = vi.fn();
const mockWorkflowTasksSelect = vi.fn();
const mockWorkflowTasksUpdate = vi.fn();
const mockWorkflowTasksInsert = vi.fn();

function createChain(resolver: () => Promise<any>, customActions?: Record<string, any>) {
  const chain: any = {
    select: () => chain,
    insert: (payload: any) => {
      mockInsertSpy(payload);
      if (customActions?.insert) return customActions.insert(payload);
      return Promise.resolve({ data: payload, error: null });
    },
    update: (payload: any) => {
      mockUpdateSpy(payload);
      if (customActions?.update) return customActions.update(payload);
      return chain;
    },
    delete: () => {
      mockDeleteSpy();
      return chain;
    },
    upsert: (payload: any) => {
      mockUpsertSpy(payload);
      return chain;
    },
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    not: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => resolver(),
    single: () => resolver(),
    then: (resolve: any, reject: any) => resolver().then(resolve, reject),
  };
  return chain;
}

const mockAdminClient = {
  from: vi.fn((table: string) => {
    if (table === "bookings") {
      return createChain(mockBookingsSelect);
    }
    if (table === "branch_resources") {
      return createChain(mockBranchResourcesSelect);
    }
    if (table === "services") {
      return createChain(mockServicesSelect);
    }
    if (table === "staff") {
      return createChain(mockStaffSelect);
    }
    if (table === "workflow_tasks") {
      return createChain(mockWorkflowTasksSelect, {
        insert: (payload: any) => {
          mockWorkflowTasksInsert(payload);
          return Promise.resolve({ data: payload, error: null });
        },
        update: (payload: any) => {
          mockWorkflowTasksUpdate(payload);
          return chainForTasksUpdate;
        },
      });
    }
    if (table === "workspace_notifications") {
      return createChain(() => Promise.resolve({ data: [], error: null }));
    }
    return createChain(() => Promise.resolve({ data: null, error: null }));
  }),
};

const chainForTasksUpdate: any = {
  eq: () => chainForTasksUpdate,
  in: () => chainForTasksUpdate,
  select: () => chainForTasksUpdate,
  maybeSingle: () => Promise.resolve({ data: null, error: null }),
  then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
};

const mockUserClient = {
  auth: {
    getUser: mockGetUser,
  },
  from: vi.fn((table: string) => mockAdminClient.from(table)),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockUserClient),
}));

// Import modules after mock definition
import {
  triggerUtilityRoomTurnoverOnServiceCompletion,
  startRoomCleaning,
  markRoomReady,
  isResourceInActiveTurnover,
} from "@/lib/staff-pwa/utility-turnover";
import { getUtilityWorkspaceRuntime } from "@/lib/staff-pwa/utility-runtime";

describe("W1B: Utility Room Turnover Vertical Slice", () => {
  const branchId = "11111111-1111-1111-1111-111111111111";
  const otherBranchId = "22222222-2222-2222-2222-222222222222";
  const resourceId = "33333333-3333-3333-3333-333333333333";
  const bookingId = "44444444-4444-4444-4444-444444444444";
  const serviceId = "55555555-5555-5555-5555-555555555555";
  const staffId = "66666666-6666-6666-6666-666666666666";
  const userId = "77777777-7777-7777-7777-777777777777";
  const taskId = "88888888-8888-8888-8888-888888888888";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Turnover Creation Authority (Server-Side)", () => {
    it("creates room_turnover workflow task upon valid completed onsite service with active resource", async () => {
      mockBookingsSelect.mockResolvedValue({
        data: {
          id: bookingId,
          branch_id: branchId,
          resource_id: resourceId,
          service_id: serviceId,
          type: "in_spa",
          delivery_type: "in_spa",
          status: "completed",
          booking_progress_status: "completed",
          session_completed_at: "2026-09-13T10:30:00Z",
          completed_at: "2026-09-13T10:30:00Z",
        },
        error: null,
      });

      mockBranchResourcesSelect.mockResolvedValue({
        data: {
          id: resourceId,
          name: "Treatment Room 1",
          type: "room",
          branch_id: branchId,
          is_active: true,
        },
        error: null,
      });

      mockServicesSelect.mockResolvedValue({
        data: { name: "Signature Massage" },
        error: null,
      });

      // No existing open task
      mockWorkflowTasksSelect.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
        bookingId,
        actorStaffId: staffId,
      });

      expect(result.ok).toBe(true);
      expect(mockInsertSpy).toHaveBeenCalled();
      const insertArg = mockInsertSpy.mock.calls[0]?.[0];
      expect(insertArg.workspace_scope).toBe("utility");
      expect(insertArg.task_type).toBe("room_turnover");
      expect(insertArg.entity_type).toBe("branch_resource");
      expect(insertArg.entity_id).toBe(resourceId);
      expect(insertArg.branch_id).toBe(branchId);
      expect(insertArg.status).toBe("open");
      expect(insertArg.dedupe_key).toBe(`room_turnover:${branchId}:${resourceId}`);
      expect(insertArg.metadata.booking_id).toBe(bookingId);
      expect(insertArg.metadata.room_name).toBe("Treatment Room 1");
    });

    it("skips turnover task creation for home_service completion", async () => {
      mockBookingsSelect.mockResolvedValue({
        data: {
          id: bookingId,
          branch_id: branchId,
          resource_id: null,
          service_id: serviceId,
          type: "home_service",
          delivery_type: "home_service",
          status: "completed",
          booking_progress_status: "completed",
          session_completed_at: "2026-09-13T10:30:00Z",
        },
        error: null,
      });

      const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
        bookingId,
        actorStaffId: staffId,
      });

      expect(result.ok).toBe(false);
      expect(result.skippedReason).toBe("HOME_SERVICE_EXCLUDED");
      expect(mockInsertSpy).not.toHaveBeenCalled();
    });

    it("skips turnover task creation when onsite booking has no assigned resource", async () => {
      mockBookingsSelect.mockResolvedValue({
        data: {
          id: bookingId,
          branch_id: branchId,
          resource_id: null,
          service_id: serviceId,
          type: "in_spa",
          delivery_type: "in_spa",
          status: "completed",
          booking_progress_status: "completed",
          session_completed_at: "2026-09-13T10:30:00Z",
        },
        error: null,
      });

      const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
        bookingId,
        actorStaffId: staffId,
      });

      expect(result.ok).toBe(false);
      expect(result.skippedReason).toBe("NO_ASSIGNED_RESOURCE");
      expect(mockInsertSpy).not.toHaveBeenCalled();
    });

    it("does not create turnover when service is not completed", async () => {
      mockBookingsSelect.mockResolvedValue({
        data: {
          id: bookingId,
          branch_id: branchId,
          resource_id: resourceId,
          service_id: serviceId,
          type: "in_spa",
          delivery_type: "in_spa",
          status: "confirmed",
          booking_progress_status: "session_started",
          session_completed_at: null,
          completed_at: null,
        },
        error: null,
      });

      const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
        bookingId,
        actorStaffId: staffId,
      });

      expect(result.ok).toBe(false);
      expect(result.skippedReason).toBe("BOOKING_NOT_COMPLETED");
      expect(mockInsertSpy).not.toHaveBeenCalled();
    });

    it("rejects turnover creation when resource belongs to a different branch", async () => {
      mockBookingsSelect.mockResolvedValue({
        data: {
          id: bookingId,
          branch_id: branchId,
          resource_id: resourceId,
          service_id: serviceId,
          type: "in_spa",
          delivery_type: "in_spa",
          status: "completed",
          booking_progress_status: "completed",
          session_completed_at: "2026-09-13T10:30:00Z",
        },
        error: null,
      });

      mockBranchResourcesSelect.mockResolvedValue({
        data: {
          id: resourceId,
          name: "Treatment Room 1",
          type: "room",
          branch_id: otherBranchId, // Mismatch!
          is_active: true,
        },
        error: null,
      });

      const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
        bookingId,
        actorStaffId: staffId,
      });

      expect(result.ok).toBe(false);
      expect(result.skippedReason).toBe("RESOURCE_BRANCH_MISMATCH");
      expect(mockInsertSpy).not.toHaveBeenCalled();
    });

    it("skips turnover creation when resource is inactive", async () => {
      mockBookingsSelect.mockResolvedValue({
        data: {
          id: bookingId,
          branch_id: branchId,
          resource_id: resourceId,
          service_id: serviceId,
          type: "in_spa",
          delivery_type: "in_spa",
          status: "completed",
          booking_progress_status: "completed",
          session_completed_at: "2026-09-13T10:30:00Z",
        },
        error: null,
      });

      mockBranchResourcesSelect.mockResolvedValue({
        data: {
          id: resourceId,
          name: "Inactive Room",
          type: "room",
          branch_id: branchId,
          is_active: false, // Inactive!
        },
        error: null,
      });

      const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
        bookingId,
        actorStaffId: staffId,
      });

      expect(result.ok).toBe(false);
      expect(result.skippedReason).toBe("RESOURCE_INACTIVE");
      expect(mockInsertSpy).not.toHaveBeenCalled();
    });

    it("idempotently updates existing active turnover on retry without duplicating task", async () => {
      mockBookingsSelect.mockResolvedValue({
        data: {
          id: bookingId,
          branch_id: branchId,
          resource_id: resourceId,
          service_id: serviceId,
          type: "in_spa",
          delivery_type: "in_spa",
          status: "completed",
          booking_progress_status: "completed",
          session_completed_at: "2026-09-13T10:30:00Z",
        },
        error: null,
      });

      mockBranchResourcesSelect.mockResolvedValue({
        data: {
          id: resourceId,
          name: "Treatment Room 1",
          type: "room",
          branch_id: branchId,
          is_active: true,
        },
        error: null,
      });

      // Existing task already open for this resource
      mockWorkflowTasksSelect.mockResolvedValue({
        data: {
          id: taskId,
          status: "open",
          dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        },
        error: null,
      });

      const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
        bookingId,
        actorStaffId: staffId,
      });

      expect(result.ok).toBe(true);
      // createOrUpdateWorkflowTask should update existing task rather than inserting a duplicate
      expect(mockUpdateSpy).toHaveBeenCalled();
      expect(mockInsertSpy).not.toHaveBeenCalled();
    });
  });

  describe("2. Utility Turnover Actions (Start Cleaning & Mark Ready)", () => {
    it("allows authorized Utility staff to transition task from open to in_progress", async () => {
      mockStaffSelect.mockResolvedValue({
        data: {
          id: staffId,
          full_name: "Utility Worker",
          branch_id: branchId,
          system_role: "utility",
          staff_type: "utility",
          is_active: true,
        },
        error: null,
      });

      mockWorkflowTasksSelect.mockResolvedValue({
        data: {
          id: taskId,
          branch_id: branchId,
          workspace_scope: "utility",
          task_type: "room_turnover",
          entity_type: "branch_resource",
          entity_id: resourceId,
          status: "open",
          metadata: { room_name: "Treatment Room 1" },
        },
        error: null,
      });

      const result = await startRoomCleaning({
        taskId,
        actorUserId: userId,
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("in_progress");
      expect(mockWorkflowTasksUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "in_progress",
          assigned_to_staff_id: staffId,
          metadata: expect.objectContaining({
            started_by_staff_id: staffId,
          }),
        })
      );
    });

    it("rejects startRoomCleaning if task is already completed", async () => {
      mockStaffSelect.mockResolvedValue({
        data: {
          id: staffId,
          full_name: "Utility Worker",
          branch_id: branchId,
          system_role: "utility",
          staff_type: "utility",
          is_active: true,
        },
        error: null,
      });

      mockWorkflowTasksSelect.mockResolvedValue({
        data: {
          id: taskId,
          branch_id: branchId,
          workspace_scope: "utility",
          task_type: "room_turnover",
          entity_type: "branch_resource",
          status: "completed",
        },
        error: null,
      });

      const result = await startRoomCleaning({
        taskId,
        actorUserId: userId,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("ALREADY_COMPLETED");
      expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
    });

    it("allows authorized Utility staff to mark room ready (transition in_progress to completed)", async () => {
      mockStaffSelect.mockResolvedValue({
        data: {
          id: staffId,
          full_name: "Utility Worker",
          branch_id: branchId,
          system_role: "utility",
          staff_type: "utility",
          is_active: true,
        },
        error: null,
      });

      mockWorkflowTasksSelect.mockResolvedValue({
        data: {
          id: taskId,
          branch_id: branchId,
          workspace_scope: "utility",
          task_type: "room_turnover",
          entity_type: "branch_resource",
          entity_id: resourceId,
          status: "in_progress",
          metadata: { room_name: "Treatment Room 1" },
        },
        error: null,
      });

      const result = await markRoomReady({
        taskId,
        actorUserId: userId,
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("completed");
      expect(mockWorkflowTasksUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          completed_by_staff_id: staffId,
          metadata: expect.objectContaining({
            completed_by_staff_id: staffId,
          }),
        })
      );
    });

    it("rejects non-Utility staff (e.g. Therapist) from mutating turnover tasks", async () => {
      mockStaffSelect.mockResolvedValue({
        data: {
          id: staffId,
          full_name: "Therapist Jane",
          branch_id: branchId,
          system_role: "staff",
          staff_type: "therapist", // Not utility!
          is_active: true,
        },
        error: null,
      });

      const startResult = await startRoomCleaning({
        taskId,
        actorUserId: userId,
      });
      expect(startResult.ok).toBe(false);
      expect(startResult.code).toBe("NOT_UTILITY_ROLE");

      const readyResult = await markRoomReady({
        taskId,
        actorUserId: userId,
      });
      expect(readyResult.ok).toBe(false);
      expect(readyResult.code).toBe("NOT_UTILITY_ROLE");
      expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
    });

    it("rejects Utility staff from modifying tasks belonging to another branch", async () => {
      mockStaffSelect.mockResolvedValue({
        data: {
          id: staffId,
          full_name: "Branch 1 Utility",
          branch_id: branchId,
          system_role: "utility",
          staff_type: "utility",
          is_active: true,
        },
        error: null,
      });

      mockWorkflowTasksSelect.mockResolvedValue({
        data: {
          id: taskId,
          branch_id: otherBranchId, // Branch 2 task!
          workspace_scope: "utility",
          task_type: "room_turnover",
          entity_type: "branch_resource",
          status: "open",
        },
        error: null,
      });

      const result = await startRoomCleaning({
        taskId,
        actorUserId: userId,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("CROSS_BRANCH_FORBIDDEN");
      expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
    });

    it("rejects untrusted task_type or entity_type", async () => {
      mockStaffSelect.mockResolvedValue({
        data: {
          id: staffId,
          full_name: "Utility Worker",
          branch_id: branchId,
          system_role: "utility",
          staff_type: "utility",
          is_active: true,
        },
        error: null,
      });

      mockWorkflowTasksSelect.mockResolvedValue({
        data: {
          id: taskId,
          branch_id: branchId,
          workspace_scope: "manager", // Not utility!
          task_type: "staff_onboarding.review",
          entity_type: "staff_onboarding_request",
          status: "open",
        },
        error: null,
      });

      const result = await startRoomCleaning({
        taskId,
        actorUserId: userId,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe("INVALID_TASK_TYPE");
      expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
    });
  });

  describe("3. Utility Queue Read Model (Authoritative workflow_tasks)", () => {
    it("returns active turnover tasks for authorized branch with zero customer PII", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      mockStaffSelect.mockResolvedValue({
        data: {
          id: staffId,
          full_name: "Utility Employee",
          nickname: null,
          avatar_url: null,
          branch_id: branchId,
          system_role: "utility",
          staff_type: "utility",
        },
        error: null,
      });

      mockWorkflowTasksSelect.mockResolvedValue({
        data: [
          {
            id: taskId,
            branch_id: branchId,
            workspace_scope: "utility",
            task_type: "room_turnover",
            entity_type: "branch_resource",
            entity_id: resourceId,
            status: "open",
            created_at: "2026-09-13T10:35:00Z",
            metadata: {
              room_name: "Treatment Room 1",
              resource_type: "room",
              service_name: "Swedish Massage",
              completed_at: "2026-09-13T10:30:00Z",
              booking_id: bookingId,
            },
          },
        ],
        error: null,
      });

      mockBranchResourcesSelect.mockResolvedValue({
        data: [
          {
            id: resourceId,
            name: "Treatment Room 1",
            type: "room",
          },
        ],
        error: null,
      });

      const runtime = await getUtilityWorkspaceRuntime();

      expect(runtime).not.toBeNull();
      expect(runtime?.turnoverItems).toHaveLength(1);
      const item = runtime?.turnoverItems[0];
      expect(item?.taskId).toBe(taskId);
      expect(item?.resourceId).toBe(resourceId);
      expect(item?.roomName).toBe("Treatment Room 1");
      expect(item?.serviceName).toBe("Swedish Massage");
      expect(item?.status).toBe("open");
      expect(item?.customerName).toBeNull(); // Zero customer PII!
      expect(item).not.toHaveProperty("customer_phone");
      expect(item).not.toHaveProperty("customer_email");
      expect(item).not.toHaveProperty("customer_address");
    });

    it("returns empty turnoverItems when there are no open or in_progress tasks", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      mockStaffSelect.mockResolvedValue({
        data: {
          id: staffId,
          full_name: "Utility Employee",
          nickname: null,
          avatar_url: null,
          branch_id: branchId,
          system_role: "utility",
          staff_type: "utility",
        },
        error: null,
      });

      mockWorkflowTasksSelect.mockResolvedValue({
        data: [],
        error: null,
      });

      const runtime = await getUtilityWorkspaceRuntime();

      expect(runtime).not.toBeNull();
      expect(runtime?.turnoverItems).toEqual([]);
      expect(runtime?.queueError).toBeNull();
    });
  });

  describe("4. Operational Room Readiness Signal", () => {
    it("returns true when room currently has an active turnover task", async () => {
      mockWorkflowTasksSelect.mockResolvedValue({
        data: [{ id: taskId }],
        error: null,
      });

      const inTurnover = await isResourceInActiveTurnover(resourceId);
      expect(inTurnover).toBe(true);
    });

    it("returns false when room has no active turnover task", async () => {
      mockWorkflowTasksSelect.mockResolvedValue({
        data: [],
        error: null,
      });

      const inTurnover = await isResourceInActiveTurnover(resourceId);
      expect(inTurnover).toBe(false);
    });
  });
});
