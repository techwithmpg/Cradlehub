export type ScheduleMutationErrorCode =
  | "UNAUTHORIZED"
  | "BRANCH_MISMATCH"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "INVALID_SHIFT_TYPE"
  | "INVALID_OVERNIGHT_WINDOW"
  | "OVERLAPPING_WINDOWS"
  | "DATABASE_CONSTRAINT"
  | "RLS_DENIED"
  | "MIGRATION_REQUIRED"
  | "SAVE_FAILED";

export type ScheduleMutationErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export type ScheduleActionFailure = {
  ok: false;
  code: ScheduleMutationErrorCode;
  error: string;
  operationId?: string;
};

export const SCHEDULE_GENERIC_SAVE_ERROR =
  "We could not update this schedule. Please try again.";

const SCHEDULE_MIGRATION_REQUIRED_MESSAGE =
  "Schedule saving is temporarily unavailable because the database schedule migration is missing. Apply the schedule update integration migration and try again.";

const SCHEDULE_CONSTRAINT_OUT_OF_DATE_MESSAGE =
  "Schedule saving is blocked by an outdated database schedule constraint. Apply the schedule update integration migration and try again.";

const SCHEDULE_RLS_DENIED_MESSAGE =
  "Schedule saving was denied by schedule permissions. Confirm this staff member is in your branch and try again.";

function lowerErrorText(error: ScheduleMutationErrorLike): string {
  return [error.message, error.details, error.hint]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();
}

export function createScheduleOperationId(prefix = "schedule"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function classifyScheduleMutationError(error: ScheduleMutationErrorLike): {
  code: ScheduleMutationErrorCode;
  error: string;
  dbCode?: string;
} {
  const dbCode = error.code;
  const text = lowerErrorText(error);

  if (
    dbCode === "PGRST202" ||
    dbCode === "42883" ||
    (text.includes("replace_staff_weekly_schedule") &&
      (text.includes("could not find") || text.includes("does not exist")))
  ) {
    return { code: "MIGRATION_REQUIRED", error: SCHEDULE_MIGRATION_REQUIRED_MESSAGE, dbCode };
  }

  if (
    text.includes("staff_schedules_staff_day_shift_unique") ||
    text.includes("on conflict") && text.includes("staff_id,day_of_week,shift_type")
  ) {
    return { code: "MIGRATION_REQUIRED", error: SCHEDULE_CONSTRAINT_OUT_OF_DATE_MESSAGE, dbCode };
  }

  if (
    dbCode === "42501" ||
    text.includes("row-level security") ||
    text.includes("permission denied") ||
    text.includes("not have permission")
  ) {
    return { code: "RLS_DENIED", error: SCHEDULE_RLS_DENIED_MESSAGE, dbCode };
  }

  if (
    dbCode === "23P01" ||
    text.includes("overlap") ||
    text.includes("cannot repeat a weekday/window")
  ) {
    return {
      code: "OVERLAPPING_WINDOWS",
      error: "Schedule windows overlap. Adjust the times so each weekday window is separate.",
      dbCode,
    };
  }

  if (text.includes("ends next day") || text.includes("overnight") || text.includes("crosses midnight")) {
    return {
      code: "INVALID_OVERNIGHT_WINDOW",
      error: "Check the overnight setting for windows that cross midnight.",
      dbCode,
    };
  }

  if (text.includes("opening and closing")) {
    return {
      code: "INVALID_SHIFT_TYPE",
      error: "Opening and Closing shifts are only available for therapists and CRM staff.",
      dbCode,
    };
  }

  if (dbCode === "23505" || dbCode === "23514" || text.includes("constraint")) {
    return {
      code: "DATABASE_CONSTRAINT",
      error: "The schedule did not meet the database schedule rules. Review the windows and try again.",
      dbCode,
    };
  }

  return { code: "SAVE_FAILED", error: SCHEDULE_GENERIC_SAVE_ERROR, dbCode };
}

export function scheduleActionFailureFromError(
  error: ScheduleMutationErrorLike,
  operationId: string
): ScheduleActionFailure {
  const classified = classifyScheduleMutationError(error);
  return {
    ok: false,
    code: classified.code,
    error: classified.error,
    operationId,
  };
}

export function genericScheduleActionFailure(
  code: ScheduleMutationErrorCode,
  error: string,
  operationId?: string
): ScheduleActionFailure {
  return { ok: false, code, error, operationId };
}

export function logScheduleMutationError(params: {
  scope: string;
  operationId: string;
  branchId?: string | null;
  staffId?: string | null;
  actorId?: string | null;
  error: ScheduleMutationErrorLike;
}) {
  const classified = classifyScheduleMutationError(params.error);
  console.error(`[${params.scope}] schedule mutation failed`, {
    operationId: params.operationId,
    branchId: params.branchId ?? null,
    staffId: params.staffId ?? null,
    actorId: params.actorId ?? null,
    safeCode: classified.code,
    dbCode: params.error.code ?? null,
    dbMessage: params.error.message ?? null,
    at: new Date().toISOString(),
  });
}
