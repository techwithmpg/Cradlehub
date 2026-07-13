"use server";

import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace } from "@/lib/cache/cache-tags";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAdjustStaffSchedule, isOwner } from "@/lib/permissions";
import { isOperationalStaff, type OperationalStaffFlags } from "@/lib/staff/operational-staff";
import {
  buildStaffWeeklyScheduleRows,
  savedRowsMatchRequest,
  type SavedStaffScheduleRow,
  type StaffScheduleUpsertRow,
} from "@/lib/schedule/staff-schedule-write";
import {
  SCHEDULE_GENERIC_SAVE_ERROR,
  classifyScheduleMutationError,
  createScheduleOperationId,
  genericScheduleActionFailure,
  logScheduleMutationError,
  scheduleActionFailureFromError,
  type ScheduleActionFailure,
} from "@/lib/actions/schedule-mutation-errors";

// ── Permission ─────────────────────────────────────────────────────────────────

const SCHEDULE_PERMISSION_DENIED_MESSAGE =
  "You do not have permission to update this staff schedule.";
const INVALID_TIME_ERROR = "Please check the start and end times.";

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

async function requireScheduleAccess(branchId: string) {
  // Session client — used only for auth checks (respects RLS).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    // Dev bypass has no real auth session, so it uses the admin client.
    const admin = createAdminClient();
    return { admin, scheduleClient: admin, userId: "dev-bypass" };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me) return null;
  const role = canonicalizeSystemRole(me.system_role);
  if (!canAdjustStaffSchedule(role)) return null;
  // Non-owner must be on the same branch (branch-scoped access for CRM/CSR).
  if (!isOwner(role) && (me.branch_id ?? "").toLowerCase() !== branchId.toLowerCase()) {
    return null;
  }

  return { admin: createAdminClient(), scheduleClient: supabase, userId: me.id as string };
}

// ── Input schema ──────────────────────────────────────────────────────────────

const uuid = z.guid("Invalid ID");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM");

// ── Overnight-shift time helpers ─────────────────────────────────────────────

/** Converts "HH:MM" to total minutes from midnight (0–1439). */
function parseTimeToMinutes(time: string): number {
  const parts = time.split(":");
  return parseInt(parts[0] ?? "0", 10) * 60 + parseInt(parts[1] ?? "0", 10);
}

/**
 * Returns the duration in minutes between two HH:MM times.
 * If endTime <= startTime (crosses midnight), 24 hours are added to endTime
 * so that e.g. "17:00"–"01:30" = 8h 30m, not a negative/zero value.
 */
function getShiftDurationMinutes(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  let end = parseTimeToMinutes(endTime);
  if (end <= start) end += 24 * 60; // overnight adjustment
  return end - start;
}

/** Returns true if any day in the pattern enables this shift (and is not a day-off). */
function isShiftEnabled(
  days: Array<{ opening: boolean; closing: boolean; regular: boolean; dayOff: boolean }>,
  shift: "opening" | "closing" | "regular"
): boolean {
  return days.some((d) => !d.dayOff && d[shift]);
}

// ── Save Staff Weekly Schedule Action ─────────────────────────────────────────

const dayPatternInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opening: z.boolean(),
  closing: z.boolean(),
  regular: z.boolean(),
  dayOff: z.boolean(),
  splitShift: z.boolean().optional().default(false),
});

const shiftTimesInputSchema = z.object({
  opening: z.object({ start: timeStr, end: timeStr }),
  closing: z.object({ start: timeStr, end: timeStr }),
  regular: z.object({ start: timeStr, end: timeStr }),
});

const saveStaffWeeklyScheduleSchema = z
  .object({
    staffId: uuid,
    branchId: uuid,
    days: z
      .array(dayPatternInputSchema)
      .refine((a) => a.length === 7, "Must provide all 7 days (0–6)"),
    times: shiftTimesInputSchema,
  })
  // Opening: only validate when at least one day uses it; allow overnight spans.
  .refine(
    (d) => {
      if (!isShiftEnabled(d.days, "opening")) return true;
      const dur = getShiftDurationMinutes(d.times.opening.start, d.times.opening.end);
      return dur > 0 && dur <= 16 * 60;
    },
    {
      message: "Opening shift times are invalid (must span 1 min – 16 h)",
      path: ["times", "opening", "end"],
    }
  )
  // Closing: same rules — overnight OK (e.g. 17:00 → 01:30 = 8 h 30 m).
  .refine(
    (d) => {
      if (!isShiftEnabled(d.days, "closing")) return true;
      const dur = getShiftDurationMinutes(d.times.closing.start, d.times.closing.end);
      return dur > 0 && dur <= 16 * 60;
    },
    {
      message: "Closing shift times are invalid (must span 1 min – 16 h)",
      path: ["times", "closing", "end"],
    }
  )
  // Regular: same rules.
  .refine(
    (d) => {
      if (!isShiftEnabled(d.days, "regular")) return true;
      const dur = getShiftDurationMinutes(d.times.regular.start, d.times.regular.end);
      return dur > 0 && dur <= 16 * 60;
    },
    {
      message: "Regular shift times are invalid (must span 1 min – 16 h)",
      path: ["times", "regular", "end"],
    }
  );

export type SaveStaffWeeklyScheduleResult =
  | { ok: true; rowsWritten: number; savedRows: SavedStaffScheduleRow[] }
  | ScheduleActionFailure;

function scheduleValidationFailure(error: string): ScheduleActionFailure {
  const classified = classifyScheduleMutationError({ message: error });
  return genericScheduleActionFailure(
    classified.code === "SAVE_FAILED" ? "INVALID_INPUT" : classified.code,
    error
  );
}

/**
 * Saves a staff member's full weekly schedule.
 *
 * Writes the normalized individual pattern through replace_staff_weekly_schedule:
 *   - one active row per saved working window
 *   - one inactive day-off marker for configured days off
 */
export async function saveStaffWeeklyScheduleAction(
  rawInput: unknown
): Promise<SaveStaffWeeklyScheduleResult> {
  const parsed = saveStaffWeeklyScheduleSchema.safeParse(rawInput);
  if (!parsed.success) {
    const invalidTime = parsed.error.issues.some((issue) =>
      issue.path.some((part) => part === "times" || part === "start" || part === "end")
    );
    return genericScheduleActionFailure(
      "INVALID_INPUT",
      invalidTime ? INVALID_TIME_ERROR : "Invalid input"
    );
  }

  const { staffId, branchId, days, times } = parsed.data;

  const ctx = await requireScheduleAccess(branchId);
  if (!ctx) {
    return genericScheduleActionFailure("UNAUTHORIZED", SCHEDULE_PERMISSION_DENIED_MESSAGE);
  }

  // Verify staff belongs to this branch
  const { data: staffRecord, error: verifyErr } = await ctx.scheduleClient
    .from("staff")
    .select("id, staff_type, system_role, is_active, archived_at, merged_into_staff_id, metadata")
    .eq("id", staffId)
    .eq("branch_id", branchId)
    .maybeSingle();

  if (verifyErr) {
    console.error("[save-staff-weekly-schedule] staff verification failed", {
      branchId,
      staffId,
      code: verifyErr.code,
      message: verifyErr.message,
    });
    return genericScheduleActionFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR);
  }
  if (!staffRecord) {
    return genericScheduleActionFailure("NOT_FOUND", "Staff member not found in this branch");
  }
  if (!isOperationalStaff(staffRecord as OperationalStaffFlags)) {
    return genericScheduleActionFailure("NOT_FOUND", "This staff member is not schedulable.");
  }

  const normalized = buildStaffWeeklyScheduleRows({
    staffId,
    days,
    times,
    staff: {
      staff_type: staffRecord.staff_type ?? null,
      system_role: staffRecord.system_role ?? null,
    },
  });
  if (!normalized.ok) {
    return scheduleValidationFailure(normalized.error);
  }

  const rows: StaffScheduleUpsertRow[] = normalized.rows;

  const scheduleRpcClient =
    ctx.scheduleClient as unknown as StaffScheduleMutationRpcClient;
  const operationId = createScheduleOperationId("schedule-setup-weekly");
  const { data: savedRows, error: upsertErr } = await scheduleRpcClient.rpc(
    "replace_staff_weekly_schedule",
    {
      p_staff_id: staffId,
      p_branch_id: branchId,
      p_rows: rows,
    }
  );

  if (upsertErr) {
    logScheduleMutationError({
      scope: "save-staff-weekly-schedule",
      operationId,
      branchId,
      staffId,
      actorId: ctx.userId,
      error: upsertErr,
    });
    return scheduleActionFailureFromError(upsertErr, operationId);
  }

  const normalizedSavedRows = (savedRows ?? []) as SavedStaffScheduleRow[];
  if (!savedRowsMatchRequest({ requestedRows: rows, savedRows: normalizedSavedRows })) {
    console.error("[save-staff-weekly-schedule] upsert returned unexpected row count", {
      operationId,
      branchId,
      staffId,
      requestedRows: rows.length,
      savedRows: normalizedSavedRows.length,
    });
    return genericScheduleActionFailure("SAVE_FAILED", SCHEDULE_GENERIC_SAVE_ERROR, operationId);
  }

  revalidatePath("/crm/schedule");
  revalidatePath("/crm/today");
  revalidatePath("/crm/setup");
  revalidatePath("/book");
  invalidateCrmWorkspace(branchId);

  return { ok: true, rowsWritten: normalizedSavedRows.length, savedRows: normalizedSavedRows };
}
