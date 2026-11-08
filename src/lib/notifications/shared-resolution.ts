import "server-only";

import { logError } from "@/lib/logger";
import { markNotificationResolved } from "@/lib/notifications/workflow-notifications-store";
import { resolveWorkflowTask } from "@/lib/notifications/workflow-task-store";

/**
 * Read/claim/dismissal is not business resolution.
 * Only call these reconcilers after the owning booking/attendance writer
 * successfully commits the corresponding authoritative state transition.
 * A notification cleanup failure must never turn a committed business write
 * into a misleading "booking failed" response.
 */
async function bestEffortReconcile(
  context: string,
  entityId: string,
  work: () => Promise<void>
): Promise<void> {
  try {
    await work();
  } catch (error) {
    logError("notification.shared_resolution_failed", { context, entityId, error });
  }
}

/** Clears the shared branch CRM confirmation request, NOT payment/staff work. */
export async function resolveConfirmedBookingRequestAlerts(input: {
  branchId: string;
  bookingIds: readonly string[];
}): Promise<void> {
  const ids = [...new Set(input.bookingIds.filter(Boolean))];
  await Promise.all(
    ids.map((bookingId) =>
      bestEffortReconcile("booking_confirmed", bookingId, () =>
        markNotificationResolved({
          branchId: input.branchId,
          targetWorkspace: "crm",
          type: "booking_created",
          entityType: "booking",
          entityId: bookingId,
        })
      )
    )
  );
}

/** Clears only actions made obsolete by the authoritative closed exception. */
export async function resolveClosedAttendanceExceptionAlerts(input: {
  branchId: string;
  exceptionId: string;
  actorStaffId: string | null;
}): Promise<void> {
  const scope = {
    branchId: input.branchId,
    entityType: "attendance_exception" as const,
    entityId: input.exceptionId,
  };
  await Promise.all([
    bestEffortReconcile("attendance_staff_question", input.exceptionId, () =>
      markNotificationResolved({
        ...scope,
        targetWorkspace: "staff",
        type: "attendance_issue_question",
      })
    ),
    bestEffortReconcile("attendance_crm_response", input.exceptionId, () =>
      markNotificationResolved({
        ...scope,
        targetWorkspace: "crm",
        type: "attendance_issue_response",
      })
    ),
    bestEffortReconcile("attendance_crm_follow_up", input.exceptionId, () =>
      resolveWorkflowTask({
        branchId: input.branchId,
        workspaceScope: "crm",
        taskType: "attendance_issue_follow_up",
        entityType: "attendance_exception",
        entityId: input.exceptionId,
        completedByStaffId: input.actorStaffId,
        dedupeKey: `attendance-follow-up:${input.exceptionId}`,
      })
    ),
    bestEffortReconcile("attendance_owner_technical_escalation", input.exceptionId, () =>
      resolveWorkflowTask({
        branchId: input.branchId,
        workspaceScope: "owner",
        assignedToRole: "owner",
        taskType: "attendance_technical_escalation",
        entityType: "attendance_exception",
        entityId: input.exceptionId,
        completedByStaffId: input.actorStaffId,
        dedupeKey: `attendance-technical:${input.exceptionId}`,
      })
    ),
  ]);
}
