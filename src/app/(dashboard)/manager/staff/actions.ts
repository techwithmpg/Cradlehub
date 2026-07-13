"use server";

import { createClient } from "@/lib/supabase/server";
import { getDevBypassLayoutStaff, isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import {
  setScheduleSchema,
  createOverrideSchema,
  createBlockedTimeSchema,
} from "@/lib/validations/staff";
import { revalidatePath } from "next/cache";
import { invalidateCrmWorkspace, invalidateManagerWorkspace } from "@/lib/cache/cache-tags";
import { canonicalizeSystemRole } from "@/constants/staff";
import { canAdjustStaffSchedule, isOwner } from "@/lib/permissions";
import {
  SCHEDULE_GENERIC_SAVE_ERROR,
  createScheduleOperationId,
  logScheduleMutationError,
  scheduleActionFailureFromError,
} from "@/lib/actions/schedule-mutation-errors";
import {
  STAFF_SCHEDULE_RETURNING_COLUMNS,
  savedRowsMatchRequest,
  type SavedStaffScheduleRow,
  type StaffScheduleUpsertRow,
} from "@/lib/schedule/staff-schedule-write";
import { isOvernightTimeRange } from "@/lib/utils/time-format";

const DAY_OFF_START = "00:00";
const DAY_OFF_END = "00:01";

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

async function getManagerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      supabase,
      me: {
        id: null,
        branch_id: mock.branch_id,
        system_role: "manager",
      },
    };
  }

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!me || !canAdjustStaffSchedule(me.system_role)) return null;
  return { supabase, me };
}

export async function setStaffScheduleAction(rawInput: unknown) {
  const parsed = setScheduleSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const actorRole = canonicalizeSystemRole(ctx.me.system_role);
  const { data: targetStaff, error: targetStaffError } = await ctx.supabase
    .from("staff")
    .select("id, branch_id")
    .eq("id", parsed.data.staffId)
    .maybeSingle();

  if (targetStaffError) {
    return { success: false, error: "Could not verify staff schedule access." };
  }
  if (!targetStaff?.branch_id) {
    return { success: false, error: "Staff member not found in this branch" };
  }
  if (!isOwner(actorRole) && (ctx.me.branch_id ?? "") !== targetStaff.branch_id) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: existingRows, error: existingRowsError } = await ctx.supabase
    .from("staff_schedules")
    .select(STAFF_SCHEDULE_RETURNING_COLUMNS)
    .eq("staff_id", parsed.data.staffId);

  if (existingRowsError) {
    return { success: false, error: "Could not load the existing staff schedule." };
  }

  const unchangedRows: StaffScheduleUpsertRow[] = ((existingRows ?? []) as SavedStaffScheduleRow[])
    .filter((row) => row.day_of_week !== parsed.data.dayOfWeek)
    .map((row) => ({
      staff_id: parsed.data.staffId,
      day_of_week: row.day_of_week,
      start_time: row.start_time.slice(0, 5),
      end_time: row.end_time.slice(0, 5),
      is_active: row.is_active,
      shift_type: row.shift_type,
      window_order: row.window_order,
      ends_next_day: row.ends_next_day ?? isOvernightTimeRange(row.start_time, row.end_time),
    }));

  const replacementRow: StaffScheduleUpsertRow = parsed.data.isActive
    ? {
        staff_id: parsed.data.staffId,
        day_of_week: parsed.data.dayOfWeek,
        start_time: parsed.data.startTime,
        end_time: parsed.data.endTime,
        is_active: true,
        shift_type: parsed.data.shiftType,
        window_order: 1,
        ends_next_day: isOvernightTimeRange(parsed.data.startTime, parsed.data.endTime),
      }
    : {
        staff_id: parsed.data.staffId,
        day_of_week: parsed.data.dayOfWeek,
        start_time: DAY_OFF_START,
        end_time: DAY_OFF_END,
        is_active: false,
        shift_type: "single",
        window_order: 1,
        ends_next_day: false,
      };

  const rows = [...unchangedRows, replacementRow].sort(
    (a, b) => a.day_of_week - b.day_of_week || a.window_order - b.window_order
  );
  const operationId = createScheduleOperationId("manager-staff-schedule");
  const scheduleRpcClient = ctx.supabase as unknown as StaffScheduleMutationRpcClient;
  const { data: savedRows, error } = await scheduleRpcClient.rpc(
    "replace_staff_weekly_schedule",
    {
      p_staff_id: parsed.data.staffId,
      p_branch_id: targetStaff.branch_id,
      p_rows: rows,
    }
  );

  if (error) {
    logScheduleMutationError({
      scope: "manager-set-staff-schedule",
      operationId,
      branchId: targetStaff.branch_id,
      staffId: parsed.data.staffId,
      actorId: ctx.me.id,
      error,
    });
    const failure = scheduleActionFailureFromError(error, operationId);
    return {
      success: false,
      error: failure.error,
      code: failure.code,
      operationId: failure.operationId,
    };
  }

  if (!savedRowsMatchRequest({ requestedRows: rows, savedRows: savedRows ?? [] })) {
    console.error("[manager-set-staff-schedule] replace returned unexpected rows", {
      operationId,
      branchId: targetStaff.branch_id,
      staffId: parsed.data.staffId,
      requestedRows: rows.length,
      savedRows: savedRows?.length ?? 0,
    });
    return { success: false, error: SCHEDULE_GENERIC_SAVE_ERROR, code: "SAVE_FAILED", operationId };
  }

  revalidatePath("/manager/staff");
  revalidatePath("/manager/schedule");
  revalidatePath("/manager/staff-availability");
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/today");
  revalidatePath("/crm/setup");
  revalidatePath("/book");
  invalidateCrmWorkspace(targetStaff.branch_id);
  invalidateManagerWorkspace(targetStaff.branch_id);
  return { success: true };
}

export async function createScheduleOverrideAction(rawInput: unknown) {
  const parsed = createOverrideSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("schedule_overrides")
    .upsert(
      {
        staff_id:      parsed.data.staffId,
        override_date: parsed.data.overrideDate,
        is_day_off:    parsed.data.isDayOff,
        shift_type:    parsed.data.isDayOff ? null : parsed.data.shiftType ?? null,
        start_time:    parsed.data.startTime ?? null,
        end_time:      parsed.data.endTime   ?? null,
        reason:        parsed.data.reason    ?? null,
        created_by:    ctx.me.id ?? null,
      },
      { onConflict: "staff_id,override_date" }
    );

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  revalidatePath("/manager/schedule");
  revalidatePath("/manager/staff-availability");
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/schedule");
  invalidateCrmWorkspace(ctx.me.branch_id);
  invalidateManagerWorkspace(ctx.me.branch_id);
  return { success: true };
}

export async function createBlockedTimeAction(rawInput: unknown) {
  const parsed = createBlockedTimeSchema.safeParse(rawInput);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };

  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { error } = await ctx.supabase
    .from("blocked_times")
    .insert({
      staff_id:   parsed.data.staffId,
      block_date: parsed.data.blockDate,
      start_time: parsed.data.startTime,
      end_time:   parsed.data.endTime,
      reason:     parsed.data.reason,
      created_by: ctx.me.id ?? null,
    });

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  revalidatePath("/manager/schedule");
  revalidatePath("/manager/staff-availability");
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/schedule");
  invalidateCrmWorkspace(ctx.me.branch_id);
  invalidateManagerWorkspace(ctx.me.branch_id);
  return { success: true };
}

// ── Delete a blocked time ──────────────────────────────────────────────────
export async function deleteBlockedTimeAction(blockedTimeId: string) {
  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { data: branchStaff, error: branchStaffError } = await ctx.supabase
    .from("staff")
    .select("id")
    .eq("branch_id", ctx.me.branch_id);
  if (branchStaffError) return { success: false, error: branchStaffError.message };

  const staffIds = (branchStaff ?? []).map((s) => s.id);
  if (staffIds.length === 0) return { success: false, error: "No staff found in this branch" };

  // Only delete blocks belonging to staff in this manager's branch
  const { error } = await ctx.supabase
    .from("blocked_times")
    .delete()
    .eq("id", blockedTimeId)
    .in("staff_id", staffIds);

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  revalidatePath("/manager/schedule");
  revalidatePath("/manager/staff-availability");
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/schedule");
  invalidateCrmWorkspace(ctx.me.branch_id);
  invalidateManagerWorkspace(ctx.me.branch_id);
  return { success: true };
}

// ── Delete a schedule override ────────────────────────────────────────────
export async function deleteScheduleOverrideAction(overrideId: string) {
  const ctx = await getManagerContext();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const { data: branchStaff, error: branchStaffError } = await ctx.supabase
    .from("staff")
    .select("id")
    .eq("branch_id", ctx.me.branch_id);
  if (branchStaffError) return { success: false, error: branchStaffError.message };

  const staffIds = (branchStaff ?? []).map((s) => s.id);
  if (staffIds.length === 0) return { success: false, error: "No staff found in this branch" };

  const { error } = await ctx.supabase
    .from("schedule_overrides")
    .delete()
    .eq("id", overrideId)
    .in("staff_id", staffIds);

  if (error) return { success: false, error: error.message };
  revalidatePath("/manager/staff");
  revalidatePath("/manager/schedule");
  revalidatePath("/manager/staff-availability");
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/schedule");
  invalidateCrmWorkspace(ctx.me.branch_id);
  invalidateManagerWorkspace(ctx.me.branch_id);
  return { success: true };
}
