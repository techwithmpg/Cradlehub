import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import { canAdjustStaffSchedule, isOwner } from "@/lib/permissions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { uiShiftToDatabase } from "@/lib/schedule/schedule-domain";
import {
  buildStaffWeeklyWindowScheduleRows,
  buildSingleShiftWeeklyScheduleRows,
  savedRowsMatchRequest,
  type SavedStaffScheduleRow,
  type StaffScheduleUpsertRow,
  type StaffScheduleWindowDayInput,
} from "@/lib/schedule/staff-schedule-write";
import { isOperationalStaff, type OperationalStaffFlags } from "@/lib/staff/operational-staff";
import { isValidShiftRange } from "@/lib/utils/time-format";
import {
  SCHEDULE_GENERIC_SAVE_ERROR,
  classifyScheduleMutationError,
  createScheduleOperationId,
  logScheduleMutationError,
  type ScheduleMutationErrorCode,
} from "@/lib/actions/schedule-mutation-errors";

export const scheduleMutationUuidSchema = z.guid("Invalid ID");

const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

export const weeklyDaySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isActive: z.boolean(),
    startTime: timeStr,
    endTime: timeStr,
  })
  .superRefine((day, ctx) => {
    if (day.isActive && !isValidShiftRange(day.startTime, day.endTime)) {
      ctx.addIssue({
        code: "custom",
        message: "Shift must be between 1 minute and 16 hours.",
        path: ["endTime"],
      });
    }
  });

export const updateWeeklyScheduleSchema = z.object({
  branchId: scheduleMutationUuidSchema,
  staffId: scheduleMutationUuidSchema,
  days: z.array(weeklyDaySchema).length(7, "Provide all seven days."),
});

export const weeklyWindowSchema = z.object({
  id: z.string().optional(),
  shiftKind: z.enum(["opening", "regular", "closing"]),
  startTime: timeStr,
  endTime: timeStr,
  endsNextDay: z.boolean(),
  order: z.number().int().min(1).max(12),
});

export const weeklyWindowDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  mode: z.enum(["unconfigured", "working", "day_off"]),
  windows: z.array(weeklyWindowSchema).max(12),
});

export const updateWeeklyWindowScheduleSchema = z.object({
  branchId: scheduleMutationUuidSchema,
  staffId: scheduleMutationUuidSchema,
  days: z.array(weeklyWindowDaySchema).length(7, "Provide all seven days."),
});

export const scheduleOverrideSchema = z
  .object({
    branchId: scheduleMutationUuidSchema,
    staffId: scheduleMutationUuidSchema,
    overrideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    isDayOff: z.boolean(),
    shiftType: z.enum(["single", "opening", "closing"]).optional(),
    startTime: timeStr.optional(),
    endTime: timeStr.optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.isDayOff) return;
    if (!input.startTime || !input.endTime) {
      ctx.addIssue({
        code: "custom",
        message: "Start and end time are required.",
        path: ["startTime"],
      });
      return;
    }
    if (!isValidShiftRange(input.startTime, input.endTime)) {
      ctx.addIssue({
        code: "custom",
        message: "Shift must be between 1 minute and 16 hours.",
        path: ["endTime"],
      });
    }
  });

export const deleteScheduleOverrideSchema = z.object({
  branchId: scheduleMutationUuidSchema,
  staffId: scheduleMutationUuidSchema,
  overrideId: scheduleMutationUuidSchema,
});

export const blockReasonSchema = z.enum(["break", "leave", "training", "other"]);

export const blockedTimeSchema = z
  .object({
    branchId: scheduleMutationUuidSchema,
    staffId: scheduleMutationUuidSchema,
    blockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    startTime: timeStr,
    endTime: timeStr,
    reason: blockReasonSchema,
  })
  .superRefine((input, ctx) => {
    if (!isValidShiftRange(input.startTime, input.endTime)) {
      ctx.addIssue({
        code: "custom",
        message: "Block must be between 1 minute and 16 hours.",
        path: ["endTime"],
      });
    }
  });

export const deleteBlockedTimeSchema = z.object({
  branchId: scheduleMutationUuidSchema,
  staffId: scheduleMutationUuidSchema,
  blockId: scheduleMutationUuidSchema,
});

export type ScheduleMutationActor = {
  staffId: string | null;
  branchId: string | null;
  role: string;
};

export type ScheduleMutationFailure = {
  ok: false;
  code: ScheduleMutationErrorCode;
  message: string;
  operationId?: string;
};

export type WeeklyScheduleMutationResult =
  | { ok: true; rowsWritten: number; savedRows: SavedStaffScheduleRow[] }
  | ScheduleMutationFailure;

type TargetScheduleStaff = OperationalStaffFlags & {
  id: string;
  branch_id: string | null;
  staff_type: string | null;
  system_role: string | null;
};

export type ScheduleOverrideRow = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  shift_type: "single" | "opening" | "closing" | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

export type BlockedTimeRow = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: "break" | "leave" | "training" | "other";
};

export type ScheduleOverrideMutationResult =
  | { ok: true; message: string; override: ScheduleOverrideRow }
  | ScheduleMutationFailure;

export type DeleteScheduleOverrideResult =
  | { ok: true; message: string; deletedId: string }
  | ScheduleMutationFailure;

export type BlockedTimeMutationResult =
  | { ok: true; message: string; block: BlockedTimeRow }
  | ScheduleMutationFailure;

export type DeleteBlockedTimeResult =
  | { ok: true; message: string; deletedId: string }
  | ScheduleMutationFailure;

type ScheduleRpcError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

type StaffScheduleMutationRpcClient = {
  rpc(
    fn: "replace_staff_weekly_schedule",
    args: {
      p_staff_id: string;
      p_branch_id: string;
      p_rows: StaffScheduleUpsertRow[];
    }
  ): PromiseLike<{ data: SavedStaffScheduleRow[] | null; error: ScheduleRpcError | null }>;
};

const INVALID_TIME_ERROR = "Please check the start and end times.";
const PERMISSION_ERROR = "You do not have permission to update this staff schedule.";
const CROSS_BRANCH_EDIT_ERROR = "You can only edit schedules for staff in your assigned branch.";

export const SCHEDULE_OVERRIDE_RETURNING_COLUMNS =
  "id, override_date, is_day_off, shift_type, start_time, end_time, reason";
export const BLOCKED_TIME_RETURNING_COLUMNS = "id, block_date, start_time, end_time, reason";

export function revalidateSchedulePaths(branchId: string) {
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/today");
  revalidatePath("/crm/setup");
  revalidatePath("/manager/schedule");
  revalidatePath("/manager/staff-availability");
  revalidatePath("/staff-portal");
  revalidatePath("/staff-portal/schedule");
  revalidatePath("/book");
  invalidateCrmWorkspace(branchId);
  invalidateManagerWorkspace(branchId);
}

function normalizeTime(value: string | null | undefined): string | null {
  return value ? value.slice(0, 5) : null;
}

function scheduleFailure(
  code: ScheduleMutationErrorCode,
  message: string,
  operationId?: string
): ScheduleMutationFailure {
  return { ok: false, code, message, ...(operationId ? { operationId } : {}) };
}

function assertMutationAuthority(
  actor: ScheduleMutationActor,
  claimedBranchId: string
): ScheduleMutationFailure | null {
  const actorRole = canonicalizeSystemRole(actor.role);
  if (!canAdjustStaffSchedule(actorRole)) {
    return scheduleFailure("UNAUTHORIZED", PERMISSION_ERROR);
  }
  if (!isOwner(actorRole)) {
    // Compare case-insensitively — UUIDs are case-insensitive but JS !== is not.
    const actorBranch = (actor.branchId ?? "").toLowerCase();
    const targetBranch = claimedBranchId.toLowerCase();
    if (actorBranch !== targetBranch) {
      return scheduleFailure("UNAUTHORIZED", CROSS_BRANCH_EDIT_ERROR);
    }
  }
  return null;
}

async function verifyTargetStaff(
  supabase: SupabaseClient<Database>,
  staffId: string,
  branchId: string
): Promise<{ ok: true } | ScheduleMutationFailure> {
  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("id, branch_id, is_active, archived_at, merged_into_staff_id, metadata")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) {
    console.error("[crm-schedule-availability] staff verification failed", {
      branchId,
      staffId,
      code: staffError.code,
      message: staffError.message,
    });
    return scheduleFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR);
  }
  if (!staff) return scheduleFailure("NOT_FOUND", "Staff member not found.");
  if ((staff.branch_id ?? "").toLowerCase() !== branchId.toLowerCase()) {
    return scheduleFailure(
      "BRANCH_MISMATCH",
      "The schedule was not changed. Your account may not have access to this staff record."
    );
  }
  if (!isOperationalStaff(staff as OperationalStaffFlags)) {
    return scheduleFailure("NOT_FOUND", "This staff member is not schedulable.");
  }
  return { ok: true };
}

async function loadTargetScheduleStaff(
  supabase: SupabaseClient<Database>,
  staffId: string,
  branchId: string
): Promise<{ ok: true; staff: TargetScheduleStaff } | ScheduleMutationFailure> {
  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select(
      "id, branch_id, staff_type, system_role, is_active, archived_at, merged_into_staff_id, metadata"
    )
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) {
    console.error("[crm-schedule-availability] staff window verification failed", {
      branchId,
      staffId,
      code: staffError.code,
      message: staffError.message,
    });
    return scheduleFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR);
  }
  if (!staff) return scheduleFailure("NOT_FOUND", "Staff member not found.");

  const targetStaff = staff as TargetScheduleStaff;
  if ((targetStaff.branch_id ?? "").toLowerCase() !== branchId.toLowerCase()) {
    return scheduleFailure(
      "BRANCH_MISMATCH",
      "The schedule was not changed. Your account may not have access to this staff record."
    );
  }
  if (!isOperationalStaff(targetStaff)) {
    return scheduleFailure("NOT_FOUND", "This staff member is not schedulable.");
  }

  return { ok: true, staff: targetStaff };
}

function mapWindowDays(
  days: z.infer<typeof updateWeeklyWindowScheduleSchema>["days"]
): StaffScheduleWindowDayInput[] {
  return days.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    mode: day.mode,
    windows: day.windows.map((window) => ({
      shiftType: uiShiftToDatabase(window.shiftKind),
      startTime: window.startTime,
      endTime: window.endTime,
      endsNextDay: window.endsNextDay,
      order: window.order,
    })),
  }));
}

/**
 * Shared weekly single-shift replacement used by the web Server Action and
 * the desktop API. Role/branch authority is enforced here from the actor so
 * both callers get identical checks. Never consults the dev-auth bypass.
 */
export async function replaceStaffWeeklySchedule(
  supabase: SupabaseClient<Database>,
  actor: ScheduleMutationActor,
  rawInput: unknown
): Promise<WeeklyScheduleMutationResult> {
  const parsed = updateWeeklyScheduleSchema.safeParse(rawInput);
  if (!parsed.success) {
    const invalidTime = parsed.error.issues.some((issue) =>
      issue.path.some((part) => part === "startTime" || part === "endTime")
    );
    return scheduleFailure("INVALID_INPUT", invalidTime ? INVALID_TIME_ERROR : "Invalid schedule.");
  }

  const { branchId, staffId, days } = parsed.data;

  const authority = assertMutationAuthority(actor, branchId);
  if (authority) return authority;

  const targetCheck = await verifyTargetStaff(supabase, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const normalized = buildSingleShiftWeeklyScheduleRows({
    staffId,
    days,
  });
  if (!normalized.ok) {
    return scheduleFailure("INVALID_INPUT", normalized.error);
  }

  const rows: StaffScheduleUpsertRow[] = normalized.rows;

  const scheduleRpcClient = supabase as unknown as StaffScheduleMutationRpcClient;
  const operationId = createScheduleOperationId("crm-weekly-schedule");
  const { data: savedRows, error } = await scheduleRpcClient.rpc("replace_staff_weekly_schedule", {
    p_staff_id: staffId,
    p_branch_id: branchId,
    p_rows: rows,
  });

  if (error) {
    logScheduleMutationError({
      scope: "crm-schedule-availability",
      operationId,
      branchId,
      staffId,
      actorId: actor.staffId,
      error,
    });
    const classified = classifyScheduleMutationError(error);
    return scheduleFailure(classified.code, classified.error, operationId);
  }

  const normalizedSavedRows = (savedRows ?? []) as SavedStaffScheduleRow[];
  if (!savedRowsMatchRequest({ requestedRows: rows, savedRows: normalizedSavedRows })) {
    console.error("[crm-schedule-availability] upsert returned unexpected row count", {
      operationId,
      branchId,
      staffId,
      requestedRows: rows.length,
      savedRows: normalizedSavedRows.length,
    });
    return scheduleFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR, operationId);
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, rowsWritten: normalizedSavedRows.length, savedRows: normalizedSavedRows };
}

/**
 * Shared weekly multi-window replacement used by the web Server Action and
 * the desktop API. Role/branch authority is enforced here from the actor.
 */
export async function replaceStaffWeeklyWindowSchedule(
  supabase: SupabaseClient<Database>,
  actor: ScheduleMutationActor,
  rawInput: unknown
): Promise<WeeklyScheduleMutationResult> {
  const parsed = updateWeeklyWindowScheduleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return scheduleFailure("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid schedule.");
  }

  const { branchId, staffId, days } = parsed.data;

  const authority = assertMutationAuthority(actor, branchId);
  if (authority) return authority;

  const target = await loadTargetScheduleStaff(supabase, staffId, branchId);
  if (!target.ok) return target;

  const normalized = buildStaffWeeklyWindowScheduleRows({
    staffId,
    days: mapWindowDays(days),
    staff: {
      staff_type: target.staff.staff_type,
      system_role: target.staff.system_role,
    },
  });
  if (!normalized.ok) {
    return scheduleFailure("INVALID_INPUT", normalized.error);
  }

  const rows: StaffScheduleUpsertRow[] = normalized.rows;
  const scheduleRpcClient = supabase as unknown as StaffScheduleMutationRpcClient;
  const operationId = createScheduleOperationId("crm-window-schedule");
  const { data: savedRows, error } = await scheduleRpcClient.rpc("replace_staff_weekly_schedule", {
    p_staff_id: staffId,
    p_branch_id: branchId,
    p_rows: rows,
  });

  if (error) {
    logScheduleMutationError({
      scope: "crm-schedule-availability-window",
      operationId,
      branchId,
      staffId,
      actorId: actor.staffId,
      error,
    });
    const classified = classifyScheduleMutationError(error);
    return scheduleFailure(classified.code, classified.error, operationId);
  }

  const normalizedSavedRows = (savedRows ?? []) as SavedStaffScheduleRow[];
  if (!savedRowsMatchRequest({ requestedRows: rows, savedRows: normalizedSavedRows })) {
    console.error("[crm-schedule-availability] window schedule returned unexpected rows", {
      operationId,
      branchId,
      staffId,
      requestedRows: rows.length,
      savedRows: normalizedSavedRows.length,
    });
    return scheduleFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR, operationId);
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, rowsWritten: normalizedSavedRows.length, savedRows: normalizedSavedRows };
}

/**
 * Shared day-override upsert used by the web Server Action and the desktop API.
 */
export async function upsertScheduleOverride(
  supabase: SupabaseClient<Database>,
  actor: ScheduleMutationActor,
  rawInput: unknown
): Promise<ScheduleOverrideMutationResult> {
  const parsed = scheduleOverrideSchema.safeParse(rawInput);
  if (!parsed.success) {
    return scheduleFailure(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Invalid day override."
    );
  }

  const { branchId, staffId, overrideDate, isDayOff, shiftType, startTime, endTime, reason } =
    parsed.data;

  const authority = assertMutationAuthority(actor, branchId);
  if (authority) return authority;

  const targetCheck = await verifyTargetStaff(supabase, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const expectedStart = isDayOff ? null : startTime!;
  const expectedEnd = isDayOff ? null : endTime!;
  const expectedShiftType = isDayOff ? null : (shiftType ?? null);
  const { data, error } = await supabase
    .from("schedule_overrides")
    .upsert(
      {
        staff_id: staffId,
        override_date: overrideDate,
        is_day_off: isDayOff,
        shift_type: expectedShiftType,
        start_time: expectedStart,
        end_time: expectedEnd,
        reason: reason ?? null,
        created_by: actor.staffId ?? null,
      },
      { onConflict: "staff_id,override_date" }
    )
    .select(SCHEDULE_OVERRIDE_RETURNING_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("[crm-schedule-availability] override upsert failed", {
      branchId,
      staffId,
      overrideDate,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return scheduleFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR);
  }

  const saved = data as ScheduleOverrideRow | null;
  if (
    !saved ||
    saved.override_date !== overrideDate ||
    saved.is_day_off !== isDayOff ||
    saved.shift_type !== expectedShiftType ||
    normalizeTime(saved.start_time) !== expectedStart ||
    normalizeTime(saved.end_time) !== expectedEnd
  ) {
    console.error("[crm-schedule-availability] override verification failed", {
      branchId,
      staffId,
      overrideDate,
      saved,
    });
    return scheduleFailure(
      "SAVE_FAILED",
      "The schedule was not changed. Your account may not have access to this staff record."
    );
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, message: "Day override saved.", override: saved };
}

/**
 * Shared day-override delete used by the web Server Action and the desktop API.
 */
export async function deleteScheduleOverride(
  supabase: SupabaseClient<Database>,
  actor: ScheduleMutationActor,
  rawInput: unknown
): Promise<DeleteScheduleOverrideResult> {
  const parsed = deleteScheduleOverrideSchema.safeParse(rawInput);
  if (!parsed.success) {
    return scheduleFailure(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Invalid day override."
    );
  }

  const { branchId, staffId, overrideId } = parsed.data;

  const authority = assertMutationAuthority(actor, branchId);
  if (authority) return authority;

  const targetCheck = await verifyTargetStaff(supabase, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const { data, error } = await supabase
    .from("schedule_overrides")
    .delete()
    .eq("id", overrideId)
    .eq("staff_id", staffId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[crm-schedule-availability] override delete failed", {
      branchId,
      staffId,
      overrideId,
      code: error.code,
      message: error.message,
    });
    return scheduleFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR);
  }
  if (!data?.id) {
    return scheduleFailure("NOT_FOUND", "Day override was not found or could not be removed.");
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, message: "Day override removed.", deletedId: data.id as string };
}

/**
 * Shared blocked-time create used by the web Server Action and the desktop API.
 */
export async function createBlockedTime(
  supabase: SupabaseClient<Database>,
  actor: ScheduleMutationActor,
  rawInput: unknown
): Promise<BlockedTimeMutationResult> {
  const parsed = blockedTimeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return scheduleFailure(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Invalid blocked time."
    );
  }

  const { branchId, staffId, blockDate, startTime, endTime, reason } = parsed.data;

  const authority = assertMutationAuthority(actor, branchId);
  if (authority) return authority;

  const targetCheck = await verifyTargetStaff(supabase, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const { data, error } = await supabase
    .from("blocked_times")
    .insert({
      staff_id: staffId,
      block_date: blockDate,
      start_time: startTime,
      end_time: endTime,
      reason,
      created_by: actor.staffId ?? null,
    })
    .select(BLOCKED_TIME_RETURNING_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("[crm-schedule-availability] blocked time insert failed", {
      branchId,
      staffId,
      blockDate,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return scheduleFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR);
  }

  const saved = data as BlockedTimeRow | null;
  if (
    !saved ||
    saved.block_date !== blockDate ||
    normalizeTime(saved.start_time) !== startTime ||
    normalizeTime(saved.end_time) !== endTime ||
    saved.reason !== reason
  ) {
    console.error("[crm-schedule-availability] blocked time verification failed", {
      branchId,
      staffId,
      blockDate,
      saved,
    });
    return scheduleFailure(
      "SAVE_FAILED",
      "The blocked time was not changed. Your account may not have access to this staff record."
    );
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, message: "Block time saved.", block: saved };
}

/**
 * Shared blocked-time delete used by the web Server Action and the desktop API.
 */
export async function deleteBlockedTime(
  supabase: SupabaseClient<Database>,
  actor: ScheduleMutationActor,
  rawInput: unknown
): Promise<DeleteBlockedTimeResult> {
  const parsed = deleteBlockedTimeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return scheduleFailure(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Invalid blocked time."
    );
  }

  const { branchId, staffId, blockId } = parsed.data;

  const authority = assertMutationAuthority(actor, branchId);
  if (authority) return authority;

  const targetCheck = await verifyTargetStaff(supabase, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const { data, error } = await supabase
    .from("blocked_times")
    .delete()
    .eq("id", blockId)
    .eq("staff_id", staffId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[crm-schedule-availability] blocked time delete failed", {
      branchId,
      staffId,
      blockId,
      code: error.code,
      message: error.message,
    });
    return scheduleFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR);
  }
  if (!data?.id) {
    return scheduleFailure("NOT_FOUND", "Blocked time was not found or could not be removed.");
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, message: "Block time removed.", deletedId: data.id as string };
}
