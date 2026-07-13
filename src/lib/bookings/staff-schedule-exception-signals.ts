import "server-only";

import {
  getStaffScheduleExceptionMessage,
  type StaffScheduleException,
} from "@/lib/bookings/staff-schedule-exception";
import {
  createNotification,
  resolveNotificationsForEntity,
} from "@/lib/notifications/create";
import {
  createOrUpdateWorkflowTask,
  resolveWorkflowTask,
} from "@/lib/notifications/workflow-task-store";

export const STAFF_SCHEDULE_EXCEPTION_TASK_TYPE =
  "staff_schedule_exception";

export function staffScheduleExceptionDedupeKey(params: {
  bookingId: string;
  staffId: string;
  reasonCode: string;
}): string {
  return `booking:${params.bookingId}:staff_schedule_exception:${params.staffId}:${params.reasonCode}`;
}

export async function createStaffScheduleExceptionSignals(params: {
  bookingId: string;
  exception: StaffScheduleException;
}): Promise<void> {
  const { bookingId, exception } = params;
  const dedupeKey = staffScheduleExceptionDedupeKey({
    bookingId,
    staffId: exception.selectedStaffId,
    reasonCode: exception.reasonCode,
  });
  const body = getStaffScheduleExceptionMessage(
    exception.reasonCode,
    exception.selectedStaffName
  );
  const metadata = {
    booking_id: bookingId,
    customer_name: exception.customerName,
    staff_id: exception.selectedStaffId,
    staff_name: exception.selectedStaffName,
    branch_id: exception.branchId,
    booking_date: exception.bookingDate,
    start_time: exception.startTime,
    end_time: exception.endTime,
    reason_code: exception.reasonCode,
    reason_label: exception.reasonLabel,
    resolution_state: "open",
  };

  await Promise.all([
    createNotification({
      branchId: exception.branchId,
      targetWorkspace: "crm",
      targetRole: "crm",
      type: "staff_schedule_exception",
      title: "Staff schedule exception",
      body,
      entityType: "booking",
      entityId: bookingId,
      actionHref: `/crm/bookings?bookingId=${bookingId}`,
      priority: "high",
      requiresAction: true,
      dedupeKey,
      metadata,
    }),
    createOrUpdateWorkflowTask({
      branchId: exception.branchId,
      workspaceScope: "crm",
      assignedToRole: "crm",
      taskType: STAFF_SCHEDULE_EXCEPTION_TASK_TYPE,
      title: "Staff schedule exception",
      body,
      entityType: "booking",
      entityId: bookingId,
      actionHref: `/crm/bookings?bookingId=${bookingId}`,
      priority: "high",
      dedupeKey,
      metadata,
    }),
  ]);
}

export async function resolveStaffScheduleExceptionSignals(params: {
  bookingId: string;
  branchId: string;
  staffId: string;
  reasonCode: string;
  completedByStaffId: string | null;
}): Promise<void> {
  const dedupeKey = staffScheduleExceptionDedupeKey(params);
  await Promise.all([
    resolveNotificationsForEntity(
      "booking",
      params.bookingId,
      "crm",
      "staff_schedule_exception"
    ),
    resolveWorkflowTask({
      branchId: params.branchId,
      workspaceScope: "crm",
      assignedToRole: "crm",
      taskType: STAFF_SCHEDULE_EXCEPTION_TASK_TYPE,
      entityType: "booking",
      entityId: params.bookingId,
      completedByStaffId: params.completedByStaffId,
      dedupeKey,
    }),
  ]);
}
