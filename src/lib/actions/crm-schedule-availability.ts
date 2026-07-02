"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { canAdjustStaffSchedule, isOwner } from "@/lib/permissions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { createClient } from "@/lib/supabase/server";
import {
  STAFF_SCHEDULE_CONFLICT_TARGET,
  STAFF_SCHEDULE_RETURNING_COLUMNS,
  savedRowsMatchRequest,
  type SavedStaffScheduleRow,
  type StaffScheduleUpsertRow,
} from "@/lib/schedule/staff-schedule-write";
import { isValidShiftRange } from "@/lib/utils/time-format";

const uuid = z.guid("Invalid ID");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

const weeklyDaySchema = z
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

const updateWeeklyScheduleSchema = z.object({
  branchId: uuid,
  staffId: uuid,
  days: z.array(weeklyDaySchema).length(7, "Provide all seven days."),
});

const scheduleOverrideSchema = z
  .object({
    branchId: uuid,
    staffId: uuid,
    overrideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    isDayOff: z.boolean(),
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

const deleteScheduleOverrideSchema = z.object({
  branchId: uuid,
  staffId: uuid,
  overrideId: uuid,
});

const blockReasonSchema = z.enum(["break", "leave", "training", "other"]);

const blockedTimeSchema = z
  .object({
    branchId: uuid,
    staffId: uuid,
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

const deleteBlockedTimeSchema = z.object({
  branchId: uuid,
  staffId: uuid,
  blockId: uuid,
});

type ScheduleActionResult =
  | { ok: true; rowsWritten: number; savedRows: SavedStaffScheduleRow[] }
  | { ok: false; error: string };

type ScheduleMutationErrorCode =
  | "UNAUTHORIZED"
  | "BRANCH_MISMATCH"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "SAVE_FAILED";

type ScheduleMutationFailure = {
  ok: false;
  code: ScheduleMutationErrorCode;
  message: string;
};

type ScheduleOverrideRow = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type BlockedTimeRow = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: "break" | "leave" | "training" | "other";
};

type ScheduleOverrideResult =
  | { ok: true; message: string; override: ScheduleOverrideRow }
  | ScheduleMutationFailure;

type DeleteScheduleOverrideResult =
  | { ok: true; message: string; deletedId: string }
  | ScheduleMutationFailure;

type BlockedTimeResult =
  | { ok: true; message: string; block: BlockedTimeRow }
  | ScheduleMutationFailure;

type DeleteBlockedTimeResult =
  | { ok: true; message: string; deletedId: string }
  | ScheduleMutationFailure;

type ScheduleEditContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actorId: string | null;
  actorBranchId: string | null;
  actorRole: string;
};

type ScheduleEditFailure = { error: string };

const GENERIC_SCHEDULE_SAVE_ERROR = "We could not update this schedule. Please try again.";
const INVALID_TIME_ERROR = "Please check the start and end times.";
const PERMISSION_ERROR = "You do not have permission to update this staff schedule.";

const SCHEDULE_OVERRIDE_RETURNING_COLUMNS =
  "id, override_date, is_day_off, start_time, end_time, reason";
const BLOCKED_TIME_RETURNING_COLUMNS =
  "id, block_date, start_time, end_time, reason";

async function getScheduleEditContext(
  branchId: string
): Promise<ScheduleEditContext | ScheduleEditFailure> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to edit schedules." };

  if (isDevAuthBypassEnabled()) {
    return { supabase, actorId: null, actorBranchId: branchId, actorRole: "owner" };
  }

  const { data: me, error } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return { error: `Session error: ${error.message}` };
  }
  if (!me) {
    return { error: "No active staff record is linked to your account. Contact your manager." };
  }
  const actorRole = canonicalizeSystemRole(me.system_role);
  if (!canAdjustStaffSchedule(actorRole)) {
    return { error: `Your role (${me.system_role}) does not have permission to edit schedules.` };
  }
  if (!isOwner(actorRole)) {
    // Compare case-insensitively — UUIDs are case-insensitive but JS !== is not.
    const actorBranch = (me.branch_id ?? "").toLowerCase();
    const targetBranch = branchId.toLowerCase();
    if (actorBranch !== targetBranch) {
      return { error: "You can only edit schedules for staff in your assigned branch." };
    }
  }

  return { supabase, actorId: me.id, actorBranchId: me.branch_id, actorRole };
}

function revalidateSchedulePaths(branchId: string) {
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/staff-availability");
  revalidatePath("/crm/availability");
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
  message: string
): ScheduleMutationFailure {
  return { ok: false, code, message };
}

async function verifyTargetStaff(
  ctx: ScheduleEditContext,
  staffId: string,
  branchId: string
): Promise<{ ok: true } | ScheduleMutationFailure> {
  const { data: staff, error: staffError } = await ctx.supabase
    .from("staff")
    .select("id, branch_id, is_active")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) {
    console.error("[crm-schedule-availability] staff verification failed", {
      branchId,
      staffId,
      code: staffError.code,
      message: staffError.message,
    });
    return scheduleFailure("SAVE_FAILED", GENERIC_SCHEDULE_SAVE_ERROR);
  }
  if (!staff) return scheduleFailure("NOT_FOUND", "Staff member not found.");
  if ((staff.branch_id ?? "").toLowerCase() !== branchId.toLowerCase()) {
    return scheduleFailure(
      "BRANCH_MISMATCH",
      "The schedule was not changed. Your account may not have access to this staff record."
    );
  }
  if (!staff.is_active) {
    return scheduleFailure("NOT_FOUND", "This staff member is inactive.");
  }
  return { ok: true };
}

export async function updateCrmStaffWeeklyAvailabilityAction(
  rawInput: unknown
): Promise<ScheduleActionResult> {
  const parsed = updateWeeklyScheduleSchema.safeParse(rawInput);
  if (!parsed.success) {
    const invalidTime = parsed.error.issues.some((issue) =>
      issue.path.some((part) => part === "startTime" || part === "endTime")
    );
    return { ok: false, error: invalidTime ? INVALID_TIME_ERROR : "Invalid schedule." };
  }

  const { branchId, staffId, days } = parsed.data;
  const ctxResult = await getScheduleEditContext(branchId);
  if ("error" in ctxResult) return { ok: false, error: PERMISSION_ERROR };
  const ctx = ctxResult;

  const targetCheck = await verifyTargetStaff(ctx, staffId, branchId);
  if (!targetCheck.ok) return { ok: false, error: targetCheck.message };

  const rows: StaffScheduleUpsertRow[] = days.map((day) => ({
    staff_id: staffId,
    day_of_week: day.dayOfWeek,
    start_time: day.startTime,
    end_time: day.endTime,
    is_active: day.isActive,
    shift_type: "single",
  }));

  const { data: savedRows, error } = await ctx.supabase
    .from("staff_schedules")
    .upsert(rows, { onConflict: STAFF_SCHEDULE_CONFLICT_TARGET })
    .select(STAFF_SCHEDULE_RETURNING_COLUMNS);

  if (error) {
    console.error("[crm-schedule-availability] upsert failed", {
      branchId,
      staffId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return {
      ok: false,
      error: GENERIC_SCHEDULE_SAVE_ERROR,
    };
  }

  const normalizedSavedRows = (savedRows ?? []) as SavedStaffScheduleRow[];
  if (!savedRowsMatchRequest({ requestedRows: rows, savedRows: normalizedSavedRows })) {
    console.error("[crm-schedule-availability] upsert returned unexpected row count", {
      branchId,
      staffId,
      requestedRows: rows.length,
      savedRows: normalizedSavedRows.length,
    });
    return { ok: false, error: GENERIC_SCHEDULE_SAVE_ERROR };
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, rowsWritten: normalizedSavedRows.length, savedRows: normalizedSavedRows };
}

export async function upsertCrmScheduleOverrideAction(
  rawInput: unknown
): Promise<ScheduleOverrideResult> {
  const parsed = scheduleOverrideSchema.safeParse(rawInput);
  if (!parsed.success) {
    return scheduleFailure(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Invalid day override."
    );
  }

  const { branchId, staffId, overrideDate, isDayOff, startTime, endTime, reason } =
    parsed.data;
  const ctxResult = await getScheduleEditContext(branchId);
  if ("error" in ctxResult) {
    return scheduleFailure("UNAUTHORIZED", PERMISSION_ERROR);
  }
  const ctx = ctxResult;

  const targetCheck = await verifyTargetStaff(ctx, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const expectedStart = isDayOff ? null : startTime!;
  const expectedEnd = isDayOff ? null : endTime!;
  const { data, error } = await ctx.supabase
    .from("schedule_overrides")
    .upsert(
      {
        staff_id: staffId,
        override_date: overrideDate,
        is_day_off: isDayOff,
        start_time: expectedStart,
        end_time: expectedEnd,
        reason: reason ?? null,
        created_by: ctx.actorId ?? null,
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
    return scheduleFailure("SAVE_FAILED", GENERIC_SCHEDULE_SAVE_ERROR);
  }

  const saved = data as ScheduleOverrideRow | null;
  if (
    !saved ||
    saved.override_date !== overrideDate ||
    saved.is_day_off !== isDayOff ||
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

export async function deleteCrmScheduleOverrideAction(
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
  const ctxResult = await getScheduleEditContext(branchId);
  if ("error" in ctxResult) {
    return scheduleFailure("UNAUTHORIZED", PERMISSION_ERROR);
  }
  const ctx = ctxResult;

  const targetCheck = await verifyTargetStaff(ctx, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const { data, error } = await ctx.supabase
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
    return scheduleFailure("SAVE_FAILED", GENERIC_SCHEDULE_SAVE_ERROR);
  }
  if (!data?.id) {
    return scheduleFailure("NOT_FOUND", "Day override was not found or could not be removed.");
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, message: "Day override removed.", deletedId: data.id as string };
}

export async function createCrmBlockedTimeAction(
  rawInput: unknown
): Promise<BlockedTimeResult> {
  const parsed = blockedTimeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return scheduleFailure(
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Invalid blocked time."
    );
  }

  const { branchId, staffId, blockDate, startTime, endTime, reason } = parsed.data;
  const ctxResult = await getScheduleEditContext(branchId);
  if ("error" in ctxResult) {
    return scheduleFailure("UNAUTHORIZED", PERMISSION_ERROR);
  }
  const ctx = ctxResult;

  const targetCheck = await verifyTargetStaff(ctx, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const { data, error } = await ctx.supabase
    .from("blocked_times")
    .insert({
      staff_id: staffId,
      block_date: blockDate,
      start_time: startTime,
      end_time: endTime,
      reason,
      created_by: ctx.actorId ?? null,
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
    return scheduleFailure("SAVE_FAILED", GENERIC_SCHEDULE_SAVE_ERROR);
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

export async function deleteCrmBlockedTimeAction(
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
  const ctxResult = await getScheduleEditContext(branchId);
  if ("error" in ctxResult) {
    return scheduleFailure("UNAUTHORIZED", PERMISSION_ERROR);
  }
  const ctx = ctxResult;

  const targetCheck = await verifyTargetStaff(ctx, staffId, branchId);
  if (!targetCheck.ok) return targetCheck;

  const { data, error } = await ctx.supabase
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
    return scheduleFailure("SAVE_FAILED", GENERIC_SCHEDULE_SAVE_ERROR);
  }
  if (!data?.id) {
    return scheduleFailure("NOT_FOUND", "Blocked time was not found or could not be removed.");
  }

  revalidateSchedulePaths(branchId);
  return { ok: true, message: "Block time removed.", deletedId: data.id as string };
}
