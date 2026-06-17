"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { isOwner } from "@/lib/permissions";
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

type ScheduleActionResult =
  | { ok: true; rowsWritten: number; savedRows: SavedStaffScheduleRow[] }
  | { ok: false; error: string };

type ScheduleEditContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actorBranchId: string | null;
  actorRole: string;
};

type ScheduleEditFailure = { error: string };

const GENERIC_SCHEDULE_SAVE_ERROR = "We could not update this schedule. Please try again.";
const INVALID_TIME_ERROR = "Please check the start and end times.";
const PERMISSION_ERROR = "You do not have permission to update this staff schedule.";

const SCHEDULE_EDIT_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
  "csr_staff",
  "csr",
]);

async function getScheduleEditContext(
  branchId: string
): Promise<ScheduleEditContext | ScheduleEditFailure> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to edit schedules." };

  if (isDevAuthBypassEnabled()) {
    return { supabase, actorBranchId: branchId, actorRole: "owner" };
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
  if (!SCHEDULE_EDIT_ROLES.has(me.system_role)) {
    return { error: `Your role (${me.system_role}) does not have permission to edit schedules.` };
  }
  if (!isOwner(me.system_role)) {
    // Compare case-insensitively — UUIDs are case-insensitive but JS !== is not.
    const actorBranch = (me.branch_id ?? "").toLowerCase();
    const targetBranch = branchId.toLowerCase();
    if (actorBranch !== targetBranch) {
      return { error: "You can only edit schedules for staff in your assigned branch." };
    }
  }

  return { supabase, actorBranchId: me.branch_id, actorRole: me.system_role };
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

  const { data: staff, error: staffError } = await ctx.supabase
    .from("staff")
    .select("id, branch_id")
    .eq("id", staffId)
    .maybeSingle();

  if (staffError) {
    console.error("[crm-schedule-availability] staff verification failed", {
      branchId,
      staffId,
      code: staffError.code,
      message: staffError.message,
    });
    return { ok: false, error: GENERIC_SCHEDULE_SAVE_ERROR };
  }
  if (!staff) return { ok: false, error: "Staff member not found." };
  if ((staff.branch_id ?? "").toLowerCase() !== branchId.toLowerCase()) {
    return { ok: false, error: PERMISSION_ERROR };
  }

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
