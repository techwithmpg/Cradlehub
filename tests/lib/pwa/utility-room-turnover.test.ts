import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn() })),
}));

// Mutation and select spies
const mockInsertSpy = vi.fn();
const mockUpdateSpy = vi.fn();
const mockDeleteSpy = vi.fn();
const mockUpsertSpy = vi.fn();
const mockRpcSpy = vi.fn();

const mockGetUser = vi.fn();
const mockStaffSelect = vi.fn();
const mockBookingsSelect = vi.fn();
const mockBranchResourcesSelect = vi.fn();
const mockServicesSelect = vi.fn();
const mockWorkflowTasksSelect = vi.fn();
const mockWorkflowTasksUpdate = vi.fn();
const mockWorkflowTasksInsert = vi.fn();

let updateCasRowsOverride: any[] | (() => any[]) | null = null;
let insertErrorOverride: any | null = null;

function createChain(resolver: () => Promise<any>, customActions?: Record<string, any>) {
  const chain: any = {
    select: () => chain,
    insert: (payload: any) => {
      mockInsertSpy(payload);
      if (customActions?.insert) return customActions.insert(payload);
      return chain;
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
  rpc: (fn: string, args: any) => {
    mockRpcSpy(fn, args);
    return Promise.resolve({ data: null, error: null });
  },
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
          const insertChain: any = {
            select: () => insertChain,
            single: () => {
              if (insertErrorOverride) return Promise.resolve({ data: null, error: insertErrorOverride });
              return Promise.resolve({ data: { id: taskId, ...payload }, error: null });
            },
            maybeSingle: () => {
              if (insertErrorOverride) return Promise.resolve({ data: null, error: insertErrorOverride });
              return Promise.resolve({ data: { id: taskId, ...payload }, error: null });
            },
            then: (resolve: any, reject: any) => {
              if (insertErrorOverride) return Promise.resolve({ data: null, error: insertErrorOverride }).then(resolve, reject);
              return Promise.resolve({ data: { id: taskId, ...payload }, error: null }).then(resolve, reject);
            },
          };
          return insertChain;
        },
        update: (payload: any) => {
          mockWorkflowTasksUpdate(payload);
          const updateChain: any = {
            eq: () => updateChain,
            in: () => updateChain,
            select: () => updateChain,
            maybeSingle: () => {
              const rows =
                typeof updateCasRowsOverride === "function"
                  ? updateCasRowsOverride()
                  : updateCasRowsOverride !== null
                  ? updateCasRowsOverride
                  : [{ id: taskId, ...payload }];
              return Promise.resolve({ data: rows[0] ?? null, error: null });
            },
            single: () => {
              const rows =
                typeof updateCasRowsOverride === "function"
                  ? updateCasRowsOverride()
                  : updateCasRowsOverride !== null
                  ? updateCasRowsOverride
                  : [{ id: taskId, ...payload }];
              return Promise.resolve({ data: rows[0] ?? null, error: null });
            },
            then: (resolve: any, reject: any) => {
              const rows =
                typeof updateCasRowsOverride === "function"
                  ? updateCasRowsOverride()
                  : updateCasRowsOverride !== null
                  ? updateCasRowsOverride
                  : [{ id: taskId, ...payload }];
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
            },
          };
          return updateChain;
        },
      });
    }
    if (table === "workspace_notifications") {
      return createChain(() => Promise.resolve({ data: [], error: null }));
    }
    return createChain(() => Promise.resolve({ data: null, error: null }));
  }),
};

const mockUserClient = {
  auth: {
    getUser: mockGetUser,
  },
  rpc: mockAdminClient.rpc,
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
import { isResourceInActiveTurnover as engineIsResourceInActiveTurnover } from "@/lib/engine/resource-availability";
import { getUtilityWorkspaceRuntime } from "@/lib/staff-pwa/utility-runtime";
import { completeCrmBookingService } from "@/lib/bookings/crm-booking-operations";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";

const branchId = "11111111-1111-1111-1111-111111111111";
const otherBranchId = "22222222-2222-2222-2222-222222222222";
const resourceId = "33333333-3333-3333-3333-333333333333";
const bookingId = "44444444-4444-4444-4444-444444444444";
const serviceId = "55555555-5555-5555-5555-555555555555";
const staffId = "66666666-6666-6666-6666-666666666666";
const cleaner2StaffId = "66666666-6666-6666-6666-666666666667";
const userId = "77777777-7777-7777-7777-777777777777";
const taskId = "88888888-8888-8888-8888-888888888888";

describe("W1B: Utility Room Turnover Integrity, Concurrency & Recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCasRowsOverride = null;
    insertErrorOverride = null;
    mockWorkflowTasksSelect.mockResolvedValue({ data: null, error: null });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Existing OPEN turnover + repeat service completion
  // ───────────────────────────────────────────────────────────────────────────
  it("1. existing OPEN turnover + repeat service completion remains OPEN with no duplicate", async () => {
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
      data: { name: "Swedish Massage" },
      error: null,
    });

    // An OPEN turnover task already exists for this room
    mockWorkflowTasksSelect.mockResolvedValue({
      data: {
        id: taskId,
        status: "open",
        branch_id: branchId,
        entity_id: resourceId,
        assigned_to_staff_id: null,
        metadata: { room_name: "Treatment Room 1", booking_id: "prior-booking-id" },
      },
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(taskId);
    // Task must remain OPEN and enriched, not inserted as duplicate
    expect(mockWorkflowTasksInsert).not.toHaveBeenCalled();
    expect(mockWorkflowTasksUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          booking_id: bookingId,
        }),
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Existing IN_PROGRESS turnover + repeat service completion
  // ───────────────────────────────────────────────────────────────────────────
  it("2. existing IN_PROGRESS turnover + another service completion remains IN_PROGRESS with cleaner & started metadata preserved", async () => {
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Facial" },
      error: null,
    });

    // Existing task is IN_PROGRESS with assigned cleaner and started metadata
    const startedAt = "2026-09-13T10:32:00Z";
    mockWorkflowTasksSelect.mockResolvedValue({
      data: {
        id: taskId,
        status: "in_progress",
        branch_id: branchId,
        entity_id: resourceId,
        assigned_to_staff_id: staffId,
        metadata: {
          room_name: "Treatment Room 1",
          started_at: startedAt,
          started_by_staff_id: staffId,
          started_by_name: "Active Cleaner",
        },
      },
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: "another-actor-id",
    });

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(taskId);
    // Task must remain IN_PROGRESS
    expect(mockWorkflowTasksInsert).not.toHaveBeenCalled();
    expect(mockWorkflowTasksUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          started_at: startedAt, // Started timestamp preserved!
          started_by_staff_id: staffId, // Started staff preserved!
          latest_booking_id: bookingId,
        }),
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Completed historical turnover + next service completion
  // ───────────────────────────────────────────────────────────────────────────
  it("3. completed historical turnover + next service completion creates fresh OPEN turnover without reopening historical row", async () => {
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Body Scrub" },
      error: null,
    });

    // Active task query filters status IN ('open', 'in_progress'), returning null because previous is completed
    mockWorkflowTasksSelect.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    // Fresh INSERT must be invoked
    expect(mockWorkflowTasksInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
        task_type: "room_turnover",
        workspace_scope: "utility",
        entity_id: resourceId,
        branch_id: branchId,
      })
    );
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Unique-insert race re-queries active task only
  // ───────────────────────────────────────────────────────────────────────────
  it("4. unique-insert race (23505) re-queries active task and does not update completed history", async () => {
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Foot Massage" },
      error: null,
    });

    // Step 1: Initial active task select returns null (racing thread hasn't committed yet)
    // Step 2: INSERT encounters 23505 unique violation
    insertErrorOverride = { code: "23505", message: "duplicate key value violates unique constraint" };

    // Step 3: Re-query active task finds the concurrent task created by the racing thread
    mockWorkflowTasksSelect
      .mockResolvedValueOnce({ data: null, error: null }) // initial active check
      .mockResolvedValueOnce({
        data: {
          id: "racing-task-id",
          status: "open",
          branch_id: branchId,
          entity_id: resourceId,
          metadata: { room_name: "Treatment Room 1" },
        },
        error: null,
      }); // active task re-query

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe("racing-task-id");
    // Did not update completed historical rows
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Two Start Cleaning attempts (Compare-And-Set)
  // ───────────────────────────────────────────────────────────────────────────
  it("5. two Start Cleaning attempts: only valid OPEN compare-and-set succeeds, no last-writer overwrite", async () => {
    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        full_name: "Cleaner One",
        branch_id: branchId,
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      error: null,
    });

    mockBranchResourcesSelect.mockResolvedValue({
      data: { id: resourceId, branch_id: branchId, is_active: true },
      error: null,
    });

    // Initial read saw 'open'
    mockWorkflowTasksSelect.mockResolvedValue({
      data: {
        id: taskId,
        branch_id: branchId,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
        status: "open",
        metadata: {},
      },
      error: null,
    });

    // Attempt 1: CAS returns updated row -> SUCCESS
    const attempt1 = await startRoomCleaning({ taskId, actorUserId: userId });
    expect(attempt1.ok).toBe(true);
    expect(attempt1.status).toBe("in_progress");

    // Attempt 2: Another cleaner tries. CAS returns 0 rows because status is now in_progress
    updateCasRowsOverride = [];
    // Authoritative re-fetch shows it is claimed by Cleaner One
    mockWorkflowTasksSelect.mockResolvedValue({
      data: {
        id: taskId,
        status: "in_progress",
        assigned_to_staff_id: staffId,
        branch_id: branchId,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
      },
      error: null,
    });

    mockStaffSelect.mockResolvedValue({
      data: {
        id: cleaner2StaffId,
        full_name: "Cleaner Two",
        branch_id: branchId,
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      error: null,
    });

    const attempt2 = await startRoomCleaning({ taskId, actorUserId: "user-2" });
    expect(attempt2.ok).toBe(false);
    expect(attempt2.code).toBe("ALREADY_CLAIMED");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Start Cleaning racing with Mark Ready
  // ───────────────────────────────────────────────────────────────────────────
  it("6. Start Cleaning racing with Mark Ready: completed state cannot be reopened", async () => {
    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        full_name: "Late Cleaner",
        branch_id: branchId,
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      error: null,
    });

    mockBranchResourcesSelect.mockResolvedValue({
      data: { id: resourceId, branch_id: branchId, is_active: true },
      error: null,
    });

    // Initial read saw open, but concurrently another cleaner completed it
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: {
        id: taskId,
        branch_id: branchId,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
        status: "open",
        metadata: {},
      },
      error: null,
    });

    // CAS returned 0 rows
    updateCasRowsOverride = [];
    // Authoritative re-read shows completed
    mockWorkflowTasksSelect.mockResolvedValue({
      data: {
        id: taskId,
        status: "completed",
        assigned_to_staff_id: cleaner2StaffId,
      },
      error: null,
    });

    const result = await startRoomCleaning({ taskId, actorUserId: userId });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("ALREADY_COMPLETED");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. OPEN -> COMPLETED direct server call is rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("7. OPEN -> COMPLETED direct server call is rejected with CLEANING_NOT_STARTED", async () => {
    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        full_name: "Utility Staff",
        branch_id: branchId,
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      error: null,
    });

    mockBranchResourcesSelect.mockResolvedValue({
      data: { id: resourceId, branch_id: branchId, is_active: true },
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
        status: "open", // Task is still open!
        metadata: {},
      },
      error: null,
    });

    const result = await markRoomReady({ taskId, actorUserId: userId });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CLEANING_NOT_STARTED");
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. IN_PROGRESS -> COMPLETED succeeds
  // ───────────────────────────────────────────────────────────────────────────
  it("8. IN_PROGRESS -> COMPLETED succeeds", async () => {
    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        full_name: "Utility Staff",
        branch_id: branchId,
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      error: null,
    });

    mockBranchResourcesSelect.mockResolvedValue({
      data: { id: resourceId, branch_id: branchId, is_active: true },
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

    const result = await markRoomReady({ taskId, actorUserId: userId });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("completed");
    expect(mockWorkflowTasksUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        completed_by_staff_id: staffId,
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Resource / task branch mismatch is rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("9. resource/task branch mismatch is rejected", async () => {
    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        full_name: "Utility Staff",
        branch_id: branchId,
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      error: null,
    });

    // Task has branchId, but resource belongs to otherBranchId
    mockBranchResourcesSelect.mockResolvedValue({
      data: { id: resourceId, branch_id: otherBranchId, is_active: true },
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
      },
      error: null,
    });

    const result = await startRoomCleaning({ taskId, actorUserId: userId });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("RESOURCE_BRANCH_MISMATCH");
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Missing resource is rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("10. missing resource is rejected", async () => {
    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        full_name: "Utility Staff",
        branch_id: branchId,
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      error: null,
    });

    // Resource not found
    mockBranchResourcesSelect.mockResolvedValue({
      data: null,
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
      },
      error: null,
    });

    const result = await startRoomCleaning({ taskId, actorUserId: userId });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("RESOURCE_NOT_FOUND");
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Inactive resource is rejected
  // ───────────────────────────────────────────────────────────────────────────
  it("11. inactive resource is rejected", async () => {
    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        full_name: "Utility Staff",
        branch_id: branchId,
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      error: null,
    });

    mockBranchResourcesSelect.mockResolvedValue({
      data: { id: resourceId, branch_id: branchId, is_active: false }, // Inactive!
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
      },
      error: null,
    });

    const result = await startRoomCleaning({ taskId, actorUserId: userId });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("RESOURCE_INACTIVE");
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Utility read queue resource query is branch-scoped
  // ───────────────────────────────────────────────────────────────────────────
  it("12. Utility read queue resource query is branch-scoped", async () => {
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
    expect(runtime?.turnoverItems[0]?.customerName).toBeNull(); // Zero PII preserved
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 13. Service completion turnover failure is surfaced truthfully
  // ───────────────────────────────────────────────────────────────────────────
  it("13. service completion turnover failure: service completion truth remains explicit, failure is surfaced", async () => {
    // When CRM executes complete_service
    mockBookingsSelect.mockResolvedValue({
      data: {
        id: bookingId,
        branch_id: branchId,
        status: "confirmed",
        booking_progress_status: "session_started",
        payment_status: "paid",
        resource_id: resourceId,
        service_id: serviceId,
        type: "in_spa",
        delivery_type: "in_spa",
        session_completed_at: "2026-09-13T10:30:00Z",
      },
      error: null,
    });

    // Make triggerUtilityRoomTurnover fail (e.g. branch resources DB error)
    mockBranchResourcesSelect.mockResolvedValue({
      data: null,
      error: { message: "connection timeout" },
    });

    const crmCtx = {
      supabase: mockUserClient as any,
      authUserId: userId,
      me: { id: staffId, branch_id: branchId, system_role: "owner" },
    };

    const opResult = await completeCrmBookingService(crmCtx, {
      bookingId,
    });

    // Service completion RPC committed (truthful success: true)
    expect(opResult.success).toBe(true);
    // Turnover failure is surfaced truthfully
    expect(opResult.turnoverSyncStatus).toBe("failed");
    expect(opResult.code).toBe("TURNOVER_SYNC_REQUIRED");
    expect(opResult.turnoverWarning).toContain("turnover task synchronization failed");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 14. Retry already-completed onsite service with missing turnover repairs idempotently
  // ───────────────────────────────────────────────────────────────────────────
  it("14. retry already-completed onsite service with missing turnover repairs turnover idempotently", async () => {
    mockBookingsSelect.mockResolvedValue({
      data: {
        id: bookingId,
        branch_id: branchId,
        status: "completed", // Already completed!
        booking_progress_status: "completed",
        resource_id: resourceId,
        service_id: serviceId,
        type: "in_spa",
        delivery_type: "in_spa",
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

    // No active turnover task currently exists
    mockWorkflowTasksSelect.mockResolvedValue({
      data: null,
      error: null,
    });

    const crmCtx = {
      supabase: mockUserClient as any,
      authUserId: userId,
      me: { id: staffId, branch_id: branchId, system_role: "owner" },
    };

    const opResult = await completeCrmBookingService(crmCtx, {
      bookingId,
    });

    expect(opResult.success).toBe(true);
    expect(opResult.turnoverSyncStatus).toBe("synced");
    // Verified repaired: task inserted
    expect(mockWorkflowTasksInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
        task_type: "room_turnover",
        entity_id: resourceId,
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 15. Canonical action_href handling: stored as null
  // ───────────────────────────────────────────────────────────────────────────
  it("15. canonical action_href handling: stored as null under zero-migration DB constraints", async () => {
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
      data: { name: "Aromatherapy" },
      error: null,
    });

    mockWorkflowTasksSelect.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    expect(mockWorkflowTasksInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action_href: null, // Truthful null: DB constraint rejects /staff deep links
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 16. Readiness helper database error throws, does not fail open
  // ───────────────────────────────────────────────────────────────────────────
  it("16. readiness helper error throws and does not fail open", async () => {
    mockWorkflowTasksSelect.mockResolvedValue({
      data: null,
      error: { message: "database unreachable" },
    });

    // Must throw, never silently returning false (which would imply room is ready)
    await expect(isResourceInActiveTurnover(resourceId)).rejects.toThrow(
      "database unreachable"
    );

    // Re-exported engine helper behaves identically
    await expect(engineIsResourceInActiveTurnover(resourceId)).rejects.toThrow(
      "database unreachable"
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 17. Home Service completion via staff portal: legitimate skip
  // ───────────────────────────────────────────────────────────────────────────
  it("17. Home Service completion via staff portal: service completed, turnoverSyncStatus = 'skipped', no warning, no task created", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        branch_id: branchId,
        system_role: "staff",
        staff_type: "therapist",
        is_active: true,
      },
      error: null,
    });

    mockBookingsSelect.mockResolvedValue({
      data: {
        id: bookingId,
        branch_id: branchId,
        staff_id: staffId,
        type: "home_service",
        delivery_type: "home_service",
        status: "confirmed",
        booking_progress_status: "session_started",
        resource_id: null,
        session_started_at: "2026-09-13T10:00:00Z",
        session_completed_at: "2026-09-13T11:00:00Z",
      },
      error: null,
    });

    const result = await updateBookingProgressAction({
      bookingId,
      nextStatus: "completed",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected updateBookingProgressAction to succeed");
    expect(result.status).toBe("completed");
    expect(result.turnoverSyncStatus).toBe("skipped");
    expect(result.turnoverWarning).toBeUndefined();
    expect(mockWorkflowTasksInsert).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 18. Already-completed Home Service retry via staff portal
  // ───────────────────────────────────────────────────────────────────────────
  it("18. already-completed Home Service retry via staff portal: returns completed truth, turnoverSyncStatus = 'skipped', no warning", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    mockStaffSelect.mockResolvedValue({
      data: {
        id: staffId,
        branch_id: branchId,
        system_role: "staff",
        staff_type: "therapist",
        is_active: true,
      },
      error: null,
    });

    mockBookingsSelect.mockResolvedValue({
      data: {
        id: bookingId,
        branch_id: branchId,
        staff_id: staffId,
        type: "home_service",
        delivery_type: "home_service",
        status: "completed", // Already completed
        booking_progress_status: "completed",
        resource_id: null,
        session_completed_at: "2026-09-13T11:00:00Z",
      },
      error: null,
    });

    const result = await updateBookingProgressAction({
      bookingId,
      nextStatus: "completed",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected updateBookingProgressAction to succeed");
    expect(result.status).toBe("completed");
    expect(result.turnoverSyncStatus).toBe("skipped");
    expect(result.turnoverWarning).toBeUndefined();
    expect(mockWorkflowTasksInsert).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 19. CRM Home Service completion: legitimate skip
  // ───────────────────────────────────────────────────────────────────────────
  it("19. CRM Home Service completion: returns success = true, turnoverSyncStatus = 'skipped', no TURNOVER_SYNC_REQUIRED, no warning", async () => {
    mockBookingsSelect.mockResolvedValue({
      data: {
        id: bookingId,
        branch_id: branchId,
        customer_id: "customer-1",
        staff_id: staffId,
        type: "home_service",
        delivery_type: "home_service",
        status: "confirmed",
        booking_progress_status: "session_started",
        payment_status: "paid",
        resource_id: null,
        session_completed_at: "2026-09-13T11:00:00Z",
      },
      error: null,
    });

    const crmCtx = {
      supabase: mockUserClient as any,
      authUserId: userId,
      me: { id: staffId, branch_id: branchId, system_role: "owner" },
    };

    const opResult = await completeCrmBookingService(crmCtx, {
      bookingId,
    });

    expect(opResult.success).toBe(true);
    expect(opResult.turnoverSyncStatus).toBe("skipped");
    expect(opResult.code).not.toBe("TURNOVER_SYNC_REQUIRED");
    expect(opResult.turnoverWarning).toBeUndefined();
    expect(mockWorkflowTasksInsert).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 20. Actual eligible onsite turnover creation failure: surfaces TURNOVER_SYNC_REQUIRED
  // ───────────────────────────────────────────────────────────────────────────
  it("20. actual eligible onsite turnover creation failure: turnoverSyncStatus = 'failed', TURNOVER_SYNC_REQUIRED surfaced, completion truth preserved", async () => {
    mockBookingsSelect.mockResolvedValue({
      data: {
        id: bookingId,
        branch_id: branchId,
        customer_id: "customer-1",
        status: "confirmed",
        booking_progress_status: "session_started",
        payment_status: "paid",
        resource_id: resourceId,
        service_id: serviceId,
        type: "in_spa",
        delivery_type: "in_spa",
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Swedish Massage" },
      error: null,
    });

    // Workflow tasks insert encounters actual fatal database error
    insertErrorOverride = { code: "50000", message: "disk I/O failure" };

    const crmCtx = {
      supabase: mockUserClient as any,
      authUserId: userId,
      me: { id: staffId, branch_id: branchId, system_role: "owner" },
    };

    const opResult = await completeCrmBookingService(crmCtx, {
      bookingId,
    });

    expect(opResult.success).toBe(true); // Service completion succeeded truthfully
    expect(opResult.turnoverSyncStatus).toBe("failed");
    expect(opResult.code).toBe("TURNOVER_SYNC_REQUIRED");
    expect(opResult.turnoverWarning).toContain("turnover task synchronization failed");
    expect(mockWorkflowTasksInsert).toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 21. Active room turnover lookup: includes canonical branch_id constraint & dedupe_key
  // ───────────────────────────────────────────────────────────────────────────
  it("21. active room turnover lookup: includes canonical branch_id constraint and dedupe_key", async () => {
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
      data: { name: "Swedish Massage" },
      error: null,
    });

    mockWorkflowTasksSelect.mockResolvedValue({
      data: {
        id: taskId,
        status: "open",
        branch_id: branchId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
        metadata: { room_name: "Treatment Room 1" },
      },
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(taskId);
    expect(mockWorkflowTasksUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          booking_id: bookingId,
        }),
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 22. Malformed active workflow task (wrong branch): must NOT be updated
  // ───────────────────────────────────────────────────────────────────────────
  it("22. malformed active workflow task (wrong branch): must NOT be updated", async () => {
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Swedish Massage" },
      error: null,
    });

    // Active lookup filters by canonical branch_id and dedupe_key.
    // Malformed task has wrong branch_id, so canonical query returns null.
    mockWorkflowTasksSelect.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    // Malformed task was NOT updated; a fresh canonical task was inserted
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
    expect(mockWorkflowTasksInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: branchId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        entity_id: resourceId,
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 23. Malformed active workflow task (inconsistent dedupe key): must NOT be adopted
  // ───────────────────────────────────────────────────────────────────────────
  it("23. malformed active workflow task (inconsistent dedupe key): must NOT be adopted as canonical turnover", async () => {
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Swedish Massage" },
      error: null,
    });

    // Active task with arbitrary non-canonical dedupe_key is not found by canonical query
    mockWorkflowTasksSelect.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    // Did not mutate the non-canonical row
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
    expect(mockWorkflowTasksInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 24. Unique-race recovery: only canonical active task is accepted
  // ───────────────────────────────────────────────────────────────────────────
  it("24. unique-race recovery: only canonical active task is accepted, malformed conflict rejected with failure", async () => {
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Swedish Massage" },
      error: null,
    });

    // 1. Initial select finds no active task
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    // 2. Insert hits 23505 collision
    insertErrorOverride = { code: "23505", message: "unique violation" };

    // 3. Race retry searches for canonical task (matching branchId and entity_id) but finds none (e.g. malformed row)
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    // Must return explicit synchronization failure, never mutating the malformed row
    expect(result.ok).toBe(false);
    expect(result.error).toContain("canonical turnover scope");
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 25. IN_PROGRESS task completed before metadata UPDATE:
  //     UPDATE affects 0 rows, canonical re-read finds no active turnover,
  //     fresh OPEN turnover is created, completed task is never reopened
  // ───────────────────────────────────────────────────────────────────────────
  it("25. IN_PROGRESS task completed before metadata UPDATE: zero rows updated, canonical re-read finds no active turnover, fresh OPEN turnover created, completed task never reopened", async () => {
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
      data: { name: "Swedish Massage" },
      error: null,
    });

    // Pass 1: SELECT finds existing active task as IN_PROGRESS
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: {
        id: taskId,
        status: "in_progress",
        branch_id: branchId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
        metadata: { room_name: "Treatment Room 1" },
      },
      error: null,
    });

    // Pass 1: UPDATE affects 0 rows (task was completed concurrently)
    updateCasRowsOverride = [];

    // Pass 2 (bounded retry): SELECT re-reads canonical active task -> none found (already completed)
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    // Fresh OPEN turnover created for the new service
    expect(mockWorkflowTasksInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        branch_id: branchId,
        status: "open",
        entity_id: resourceId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        metadata: expect.objectContaining({
          booking_id: bookingId,
        }),
      })
    );
    // Completed task was never reopened (never set status to 'open' on existing task)
    expect(mockWorkflowTasksUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: "open",
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 26. OPEN task changes to IN_PROGRESS before enrichment UPDATE:
  //     OPEN update affects 0 rows, canonical re-read finds IN_PROGRESS,
  //     lifecycle preserved as IN_PROGRESS, no duplicate OPEN task created
  // ───────────────────────────────────────────────────────────────────────────
  it("26. OPEN task changes to IN_PROGRESS before enrichment UPDATE: zero rows updated, canonical re-read finds IN_PROGRESS, lifecycle preserved as IN_PROGRESS, no duplicate OPEN task created", async () => {
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
      data: { name: "Swedish Massage" },
      error: null,
    });

    // Pass 1: SELECT finds existing active task as OPEN
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: {
        id: taskId,
        status: "open",
        branch_id: branchId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
        metadata: { room_name: "Treatment Room 1" },
      },
      error: null,
    });

    // First update (targeting status 'open') returns 0 rows; second update returns 1 row
    let updateAttempt = 0;
    updateCasRowsOverride = () => {
      updateAttempt++;
      return updateAttempt === 1 ? [] : [{ id: taskId, status: "in_progress" }];
    };

    // Pass 2 (bounded retry): SELECT re-reads canonical active task -> now IN_PROGRESS
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: {
        id: taskId,
        status: "in_progress",
        branch_id: branchId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
        assigned_to_staff_id: cleaner2StaffId,
        metadata: { room_name: "Treatment Room 1", started_at: "2026-09-13T10:00:00Z" },
      },
      error: null,
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    expect(result.ok).toBe(true);
    expect(result.taskId).toBe(taskId);
    // Preserved IN_PROGRESS: did not insert a duplicate OPEN task
    expect(mockWorkflowTasksInsert).not.toHaveBeenCalled();
    // Re-attempted update preserved IN_PROGRESS metadata
    expect(mockWorkflowTasksUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          latest_booking_id: bookingId,
        }),
      })
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 27. Existing task changes repeatedly during bounded retry:
  //     no infinite retry, returns explicit sync failure
  // ───────────────────────────────────────────────────────────────────────────
  it("27. existing task changes repeatedly during bounded retry: no infinite retry, returns explicit sync failure", async () => {
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Swedish Massage" },
      error: null,
    });

    // Pass 1: SELECT finds OPEN task
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: {
        id: taskId,
        status: "open",
        branch_id: branchId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
      },
      error: null,
    });

    // Pass 2: SELECT finds IN_PROGRESS task
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: {
        id: taskId,
        status: "in_progress",
        branch_id: branchId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
      },
      error: null,
    });

    // Both updates return 0 rows (concurrent state constantly shifting)
    updateCasRowsOverride = [];

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    // Bounded retry terminates with explicit sync failure, no infinite loop
    expect(result.ok).toBe(false);
    expect(result.error).toContain("concurrently during reconciliation");
    expect(mockWorkflowTasksUpdate).toHaveBeenCalledTimes(2);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 28. Zero-row UPDATE must never be treated as success without authoritative reconciliation
  // ───────────────────────────────────────────────────────────────────────────
  it("28. zero-row UPDATE must never be treated as success without authoritative reconciliation", async () => {
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

    mockServicesSelect.mockResolvedValue({
      data: { name: "Swedish Massage" },
      error: null,
    });

    // Initial SELECT finds active task
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: {
        id: taskId,
        status: "open",
        branch_id: branchId,
        dedupe_key: `room_turnover:${branchId}:${resourceId}`,
        workspace_scope: "utility",
        task_type: "room_turnover",
        entity_type: "branch_resource",
        entity_id: resourceId,
      },
      error: null,
    });

    // UPDATE affects 0 rows
    updateCasRowsOverride = [];

    // Recheck SELECT encounters database error
    mockWorkflowTasksSelect.mockResolvedValueOnce({
      data: null,
      error: { message: "database connection lost during reconciliation" },
    });

    const result = await triggerUtilityRoomTurnoverOnServiceCompletion({
      bookingId,
      actorStaffId: staffId,
    });

    // Proves zero-row UPDATE was not treated as success
    expect(result.ok).toBe(false);
    expect(result.error).toBe("database connection lost during reconciliation");
  });
});
