export const STAFF_SCHEDULE_EXCEPTION_REASON_CODES = [
  "selected_staff_off_day",
  "selected_staff_missing_schedule",
  "selected_staff_outside_shift",
  "selected_staff_blocked",
  "selected_staff_on_leave",
  "selected_staff_booking_overlap",
  "selected_staff_schedule_override",
] as const;

export type StaffScheduleExceptionReasonCode =
  (typeof STAFF_SCHEDULE_EXCEPTION_REASON_CODES)[number];

export type StaffScheduleExceptionResolution =
  | "kept_selected_staff"
  | "reassigned_staff"
  | "rescheduled_booking"
  | "marked_resolved";

export type StaffScheduleException = {
  status: "open" | "resolved";
  reasonCode: StaffScheduleExceptionReasonCode;
  reasonLabel: string;
  selectedStaffId: string;
  selectedStaffName: string;
  customerName: string;
  branchId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  resolution?: StaffScheduleExceptionResolution;
  resolvedAt?: string;
  resolvedByStaffId?: string | null;
  previousStaffId?: string | null;
  newStaffId?: string | null;
};

const REASON_LABELS: Record<StaffScheduleExceptionReasonCode, string> = {
  selected_staff_off_day: "Selected staff off day",
  selected_staff_missing_schedule: "Staff schedule not configured",
  selected_staff_outside_shift: "Outside scheduled shift",
  selected_staff_blocked: "Selected staff blocked period",
  selected_staff_on_leave: "Selected staff leave",
  selected_staff_booking_overlap: "Selected staff booking overlap",
  selected_staff_schedule_override: "Selected staff schedule override",
};

type PersistedStaffScheduleException = {
  version: 1;
  status: "open" | "resolved";
  reason_code: StaffScheduleExceptionReasonCode;
  reason_label: string;
  selected_staff_id: string;
  selected_staff_name: string;
  customer_name: string;
  branch_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  resolution?: StaffScheduleExceptionResolution;
  resolved_at?: string;
  resolved_by_staff_id?: string | null;
  previous_staff_id?: string | null;
  new_staff_id?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReasonCode(value: unknown): value is StaffScheduleExceptionReasonCode {
  return (
    typeof value === "string" &&
    STAFF_SCHEDULE_EXCEPTION_REASON_CODES.includes(
      value as StaffScheduleExceptionReasonCode
    )
  );
}

function persistedException(value: unknown): PersistedStaffScheduleException | null {
  if (!isRecord(value)) return null;
  if (value.status !== "open" && value.status !== "resolved") return null;
  if (!isReasonCode(value.reason_code)) return null;

  const requiredStrings = [
    "reason_label",
    "selected_staff_id",
    "selected_staff_name",
    "customer_name",
    "branch_id",
    "booking_date",
    "start_time",
    "end_time",
    "created_at",
  ] as const;
  if (requiredStrings.some((key) => typeof value[key] !== "string")) return null;

  return value as PersistedStaffScheduleException;
}

function toPublicException(
  value: PersistedStaffScheduleException
): StaffScheduleException {
  return {
    status: value.status,
    reasonCode: value.reason_code,
    reasonLabel: value.reason_label,
    selectedStaffId: value.selected_staff_id,
    selectedStaffName: value.selected_staff_name,
    customerName: value.customer_name,
    branchId: value.branch_id,
    bookingDate: value.booking_date,
    startTime: value.start_time,
    endTime: value.end_time,
    createdAt: value.created_at,
    ...(value.resolution ? { resolution: value.resolution } : {}),
    ...(value.resolved_at ? { resolvedAt: value.resolved_at } : {}),
    ...(value.resolved_by_staff_id !== undefined
      ? { resolvedByStaffId: value.resolved_by_staff_id }
      : {}),
    ...(value.previous_staff_id !== undefined
      ? { previousStaffId: value.previous_staff_id }
      : {}),
    ...(value.new_staff_id !== undefined ? { newStaffId: value.new_staff_id } : {}),
  };
}

export function getStaffScheduleExceptionReasonLabel(
  reasonCode: StaffScheduleExceptionReasonCode
): string {
  return REASON_LABELS[reasonCode];
}

export function getStaffScheduleExceptionMessage(
  reasonCode: StaffScheduleExceptionReasonCode,
  staffName: string
): string {
  if (reasonCode === "selected_staff_off_day") {
    return `The customer selected ${staffName}, but ${staffName} is not scheduled for this booking date.`;
  }
  if (reasonCode === "selected_staff_missing_schedule") {
    return `The customer selected ${staffName}, but no individual schedule is configured for this booking date.`;
  }
  if (reasonCode === "selected_staff_outside_shift") {
    return `The customer selected ${staffName}, but the booking extends beyond the scheduled shift.`;
  }
  if (reasonCode === "selected_staff_blocked") {
    return `The customer selected ${staffName}, but the booking overlaps a blocked period.`;
  }
  if (reasonCode === "selected_staff_on_leave") {
    return `The customer selected ${staffName}, but the booking overlaps approved leave.`;
  }
  if (reasonCode === "selected_staff_booking_overlap") {
    return `The customer selected ${staffName}, but another booking overlaps this time.`;
  }
  return `The customer selected ${staffName}, but a date-specific schedule override needs review.`;
}

export function createOpenStaffScheduleException(
  metadata: Record<string, unknown>,
  params: {
    reasonCode: StaffScheduleExceptionReasonCode;
    selectedStaffId: string;
    selectedStaffName: string;
    customerName: string;
    branchId: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    createdAt: string;
  }
): Record<string, unknown> {
  const current = persistedException(metadata.staff_schedule_exception);
  if (
    current?.status === "open" &&
    current.reason_code === params.reasonCode &&
    current.selected_staff_id === params.selectedStaffId
  ) {
    return metadata;
  }

  const exception: PersistedStaffScheduleException = {
    version: 1,
    status: "open",
    reason_code: params.reasonCode,
    reason_label: getStaffScheduleExceptionReasonLabel(params.reasonCode),
    selected_staff_id: params.selectedStaffId,
    selected_staff_name: params.selectedStaffName,
    customer_name: params.customerName,
    branch_id: params.branchId,
    booking_date: params.bookingDate,
    start_time: params.startTime,
    end_time: params.endTime,
    created_at: params.createdAt,
  };

  return {
    ...metadata,
    staff_assignment_review_required: true,
    staff_schedule_exception: exception,
  };
}

export function readStaffScheduleException(
  metadata: Record<string, unknown> | null | undefined
): StaffScheduleException | null {
  const value = persistedException(metadata?.staff_schedule_exception);
  return value ? toPublicException(value) : null;
}

export function getOpenStaffScheduleException(
  metadata: Record<string, unknown> | null | undefined
): StaffScheduleException | null {
  const exception = readStaffScheduleException(metadata);
  return exception?.status === "open" ? exception : null;
}

export function resolveStaffScheduleExceptionMetadata(
  metadata: Record<string, unknown>,
  params: {
    resolution: StaffScheduleExceptionResolution;
    resolvedAt: string;
    resolvedByStaffId: string | null;
    previousStaffId?: string | null;
    newStaffId?: string | null;
  }
): Record<string, unknown> {
  const current = persistedException(metadata.staff_schedule_exception);
  if (!current || current.status !== "open") return metadata;

  const resolved: PersistedStaffScheduleException = {
    ...current,
    status: "resolved",
    resolution: params.resolution,
    resolved_at: params.resolvedAt,
    resolved_by_staff_id: params.resolvedByStaffId,
    ...(params.previousStaffId !== undefined
      ? { previous_staff_id: params.previousStaffId }
      : {}),
    ...(params.newStaffId !== undefined ? { new_staff_id: params.newStaffId } : {}),
  };
  const history = Array.isArray(metadata.staff_schedule_exception_history)
    ? metadata.staff_schedule_exception_history
    : [];

  return {
    ...metadata,
    staff_assignment_review_required: false,
    staff_schedule_exception: resolved,
    staff_schedule_exception_history: [...history, resolved],
  };
}
