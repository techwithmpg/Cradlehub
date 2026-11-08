import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  markNotificationResolved: vi.fn(),
  resolveWorkflowTask: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("@/lib/notifications/workflow-notifications-store", () => ({
  markNotificationResolved: mocks.markNotificationResolved,
}));
vi.mock("@/lib/notifications/workflow-task-store", () => ({
  resolveWorkflowTask: mocks.resolveWorkflowTask,
}));
vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
}));

import {
  resolveClosedAttendanceExceptionAlerts,
  resolveConfirmedBookingRequestAlerts,
} from "@/lib/notifications/shared-resolution";

const branchId = "11111111-1111-4111-8111-111111111111";
const bookingA = "22222222-2222-4222-8222-222222222222";
const bookingB = "33333333-3333-4333-8333-333333333333";
const exceptionId = "44444444-4444-4444-8444-444444444444";
const actorStaffId = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markNotificationResolved.mockResolvedValue(undefined);
  mocks.resolveWorkflowTask.mockResolvedValue(undefined);
});

describe("N2 shared notification resolution", () => {
  it("closes only CRM booking_created review notices for confirmed order lines", async () => {
    await resolveConfirmedBookingRequestAlerts({
      branchId,
      bookingIds: [bookingA, bookingB, bookingA],
    });
    expect(mocks.markNotificationResolved).toHaveBeenCalledTimes(2);
    expect(mocks.markNotificationResolved).toHaveBeenCalledWith({
      branchId,
      targetWorkspace: "crm",
      type: "booking_created",
      entityType: "booking",
      entityId: bookingA,
    });
    expect(mocks.markNotificationResolved).toHaveBeenCalledWith({
      branchId,
      targetWorkspace: "crm",
      type: "booking_created",
      entityType: "booking",
      entityId: bookingB,
    });
    // Confirming an order does NOT finish payment or staff's assigned service.
    expect(mocks.resolveWorkflowTask).not.toHaveBeenCalled();
    for (const [selector] of mocks.markNotificationResolved.mock.calls) {
      expect(selector.type).not.toBe("payment_pending");
      expect(selector.targetWorkspace).not.toBe("staff");
    }
  });

  it("closes exactly the staff question, CRM response and linked CRM/Owner tasks when Attendance closes", async () => {
    await resolveClosedAttendanceExceptionAlerts({
      branchId, exceptionId, actorStaffId,
    });
    expect(mocks.markNotificationResolved).toHaveBeenCalledTimes(2);
    expect(mocks.markNotificationResolved).toHaveBeenCalledWith({
      branchId,
      entityType: "attendance_exception",
      entityId: exceptionId,
      targetWorkspace: "staff",
      type: "attendance_issue_question",
    });
    expect(mocks.markNotificationResolved).toHaveBeenCalledWith({
      branchId,
      entityType: "attendance_exception",
      entityId: exceptionId,
      targetWorkspace: "crm",
      type: "attendance_issue_response",
    });
    expect(mocks.resolveWorkflowTask).toHaveBeenCalledTimes(2);
    expect(mocks.resolveWorkflowTask).toHaveBeenCalledWith(expect.objectContaining({
      branchId,
      workspaceScope: "crm",
      dedupeKey: `attendance-follow-up:${exceptionId}`,
      completedByStaffId: actorStaffId,
    }));
    expect(mocks.resolveWorkflowTask).toHaveBeenCalledWith(expect.objectContaining({
      branchId,
      workspaceScope: "owner",
      dedupeKey: `attendance-technical:${exceptionId}`,
      completedByStaffId: actorStaffId,
    }));
    for (const [task] of mocks.resolveWorkflowTask.mock.calls) {
      expect(task.taskType).not.toBe("attendance_prevention_follow_up");
    }
  });

  it("logs a failed cleanup without reporting that the committed business operation failed", async () => {
    mocks.markNotificationResolved.mockRejectedValueOnce(new Error("temporary notification DB error"));
    await expect(resolveConfirmedBookingRequestAlerts({
      branchId, bookingIds: [bookingA],
    })).resolves.toBeUndefined();
    expect(mocks.logError).toHaveBeenCalledWith(
      "notification.shared_resolution_failed",
      expect.objectContaining({ context: "booking_confirmed", entityId: bookingA })
    );
  });
});
