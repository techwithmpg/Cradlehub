import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));

import { createOrUpdateWorkflowTask } from "@/lib/notifications/workflow-task-store";

beforeEach(() => vi.clearAllMocks());

describe("workflow task lifecycle preservation", () => {
  it("does not reopen a claimed task when the signal is repeated", async () => {
    const lookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "task-1" } }),
    };
    const update = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };
    const from = vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update);
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(createOrUpdateWorkflowTask({
      branchId: "11111111-1111-4111-8111-111111111111",
      workspaceScope: "crm",
      taskType: "attendance.review",
      title: "Review missing clock-out",
      entityType: "attendance_exception",
      entityId: "22222222-2222-4222-8222-222222222222",
    })).resolves.toBe(true);

    const refreshed = update.update.mock.calls[0]![0];
    for (const field of ["status", "assigned_to_staff_id", "completed_at", "completed_by_staff_id"]) {
      expect(refreshed).not.toHaveProperty(field);
    }
    expect(update.in).toHaveBeenCalledWith("status", ["open", "in_progress"]);
  });
});
