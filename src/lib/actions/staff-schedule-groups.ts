"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canAdjustStaffSchedule, isOwner } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  STAFF_SCHEDULE_CONFLICT_TARGET,
  STAFF_SCHEDULE_RETURNING_COLUMNS,
  buildStaffGroupWeeklyRuleRows,
  savedGroupRuleRowsMatchRequest,
  savedRowsMatchRequest,
  type SavedStaffGroupScheduleRuleRow,
  type SavedStaffScheduleRow,
  type StaffScheduleUpsertRow,
} from "@/lib/schedule/staff-schedule-write";
import { isValidShiftRange, timeToMinutes } from "@/lib/utils/time-format";
import type { Database } from "@/types/supabase";

const uuid = z.guid("Invalid ID");
const GROUP_RULE_PERMISSION_ERROR =
  "You do not have permission to update schedule rules for this branch.";
const GROUP_RULE_SAVE_ERROR = "We could not save the schedule rules. Please try again.";
const GROUP_APPLY_TARGET_ERROR =
  "Choose at least one staff member before applying a group schedule.";

type StaffGroupScheduleRule = Database["public"]["Tables"]["staff_group_schedule_rules"]["Row"];
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type GroupRuleMutationResult = {
  success: boolean;
  error?: string;
  rule?: StaffGroupScheduleRule;
};

type SaveGroupRulesResult =
  | { success: true; rules: SavedStaffGroupScheduleRuleRow[] }
  | { success: false; error: string };

type GroupApplyPreviewRow = {
  staffId: string;
  staffName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

async function authorizeGroupRuleMutation(
  supabase: ServerSupabaseClient,
  groupId: string
): Promise<{ authorized: true } | { authorized: false; error: string }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("[staff-group-schedule-rules] user lookup failed", userError);
    return { authorized: false, error: GROUP_RULE_SAVE_ERROR };
  }
  if (!user) return { authorized: false, error: GROUP_RULE_PERMISSION_ERROR };

  const { data: actor, error: actorError } = await supabase
    .from("staff")
    .select("id, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (actorError) {
    console.error("[staff-group-schedule-rules] actor lookup failed", actorError);
    return { authorized: false, error: GROUP_RULE_SAVE_ERROR };
  }
  if (!actor || !canAdjustStaffSchedule(actor.system_role)) {
    return { authorized: false, error: GROUP_RULE_PERMISSION_ERROR };
  }

  const { data: group, error: groupError } = await supabase
    .from("staff_schedule_groups")
    .select("id, branch_id")
    .eq("id", groupId)
    .eq("is_active", true)
    .maybeSingle();

  if (groupError) {
    console.error("[staff-group-schedule-rules] group lookup failed", groupError);
    return { authorized: false, error: GROUP_RULE_SAVE_ERROR };
  }
  if (!group || (!isOwner(actor.system_role) && actor.branch_id !== group.branch_id)) {
    return { authorized: false, error: GROUP_RULE_PERMISSION_ERROR };
  }

  return { authorized: true };
}

function getSafeMutationError(error: { code?: string; message: string }): string {
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) {
    return GROUP_RULE_PERMISSION_ERROR;
  }
  return GROUP_RULE_SAVE_ERROR;
}

function revalidateGroupRulePaths() {
  revalidatePath("/crm/schedule");
  revalidatePath("/crm/staff-availability");
  revalidatePath("/crm/availability");
}

const upsertGroupRuleSchema = z.object({
  groupId: uuid,
  dayOfWeek: z.number().int().min(0).max(6),
  shiftType: z.enum(["single", "opening", "closing"]).default("single"),
  startTime: z.union([z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"), z.null()]).optional(),
  endTime: z.union([z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"), z.null()]).optional(),
  isDayOff: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type UpsertGroupRuleInput = z.infer<typeof upsertGroupRuleSchema>;

export async function upsertStaffGroupScheduleRuleAction(
  input: UpsertGroupRuleInput
): Promise<GroupRuleMutationResult> {
  try {
    const parsed = upsertGroupRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const access = await authorizeGroupRuleMutation(supabase, parsed.data.groupId);
    if (!access.authorized) return { success: false, error: access.error };

    const { data: rule, error } = await supabase
      .from("staff_group_schedule_rules")
      .upsert(
        {
          group_id: parsed.data.groupId,
          day_of_week: parsed.data.dayOfWeek,
          shift_type: parsed.data.shiftType,
          start_time: parsed.data.isDayOff ? null : parsed.data.startTime ?? null,
          end_time: parsed.data.isDayOff ? null : parsed.data.endTime ?? null,
          is_day_off: parsed.data.isDayOff,
          is_active: parsed.data.isActive,
        },
        { onConflict: "group_id,day_of_week,shift_type" }
      )
      .select("*")
      .single();

    if (error) {
      console.error("[upsertStaffGroupScheduleRuleAction] failed", error);
      return { success: false, error: getSafeMutationError(error) };
    }

    revalidateGroupRulePaths();
    return { success: true, rule };
  } catch (err) {
    console.error("[upsertStaffGroupScheduleRuleAction] exception", err);
    return { success: false, error: GROUP_RULE_SAVE_ERROR };
  }
}

const deleteGroupRuleSchema = z.object({
  groupId: uuid,
  dayOfWeek: z.number().int().min(0).max(6),
  shiftType: z.enum(["single", "opening", "closing"]).default("single"),
});

export type DeleteGroupRuleInput = z.infer<typeof deleteGroupRuleSchema>;

export async function deleteStaffGroupScheduleRuleAction(
  input: DeleteGroupRuleInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = deleteGroupRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const access = await authorizeGroupRuleMutation(supabase, parsed.data.groupId);
    if (!access.authorized) return { success: false, error: access.error };

    const { error } = await supabase
      .from("staff_group_schedule_rules")
      .delete()
      .eq("group_id", parsed.data.groupId)
      .eq("day_of_week", parsed.data.dayOfWeek)
      .eq("shift_type", parsed.data.shiftType)
      .select("id");

    if (error) {
      console.error("[deleteStaffGroupScheduleRuleAction] failed", error);
      return { success: false, error: getSafeMutationError(error) };
    }

    revalidateGroupRulePaths();
    return { success: true };
  } catch (err) {
    console.error("[deleteStaffGroupScheduleRuleAction] exception", err);
    return { success: false, error: GROUP_RULE_SAVE_ERROR };
  }
}

const groupDayPatternSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opening: z.boolean(),
  closing: z.boolean(),
  regular: z.boolean(),
  dayOff: z.boolean(),
  splitShift: z.boolean().optional().default(false),
});

const groupShiftTimesSchema = z.object({
  opening: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  }),
  closing: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  }),
  regular: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  }),
});

const saveGroupRulesSchema = z.object({
  groupId: uuid,
  days: z.array(groupDayPatternSchema).length(7, "Provide all seven days."),
  times: groupShiftTimesSchema,
});

export type SaveGroupRulesInput = z.infer<typeof saveGroupRulesSchema>;

export async function saveStaffGroupScheduleRulesAction(
  input: SaveGroupRulesInput
): Promise<SaveGroupRulesResult> {
  try {
    const parsed = saveGroupRulesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const access = await authorizeGroupRuleMutation(supabase, parsed.data.groupId);
    if (!access.authorized) return { success: false, error: access.error };

    const normalized = buildStaffGroupWeeklyRuleRows({
      groupId: parsed.data.groupId,
      days: parsed.data.days,
      times: parsed.data.times,
    });
    if (!normalized.ok) return { success: false, error: normalized.error };

    const { data: savedRows, error } = await supabase
      .from("staff_group_schedule_rules")
      .upsert(normalized.rows, { onConflict: "group_id,day_of_week,shift_type" })
      .select("*");

    if (error) {
      console.error("[saveStaffGroupScheduleRulesAction] failed", error);
      return { success: false, error: getSafeMutationError(error) };
    }

    const normalizedSavedRows = (savedRows ?? []) as SavedStaffGroupScheduleRuleRow[];
    if (
      !savedGroupRuleRowsMatchRequest({
        requestedRows: normalized.rows,
        savedRows: normalizedSavedRows,
      })
    ) {
      console.error("[saveStaffGroupScheduleRulesAction] verification failed", {
        groupId: parsed.data.groupId,
        requestedRows: normalized.rows.length,
        savedRows: normalizedSavedRows.length,
      });
      return { success: false, error: GROUP_RULE_SAVE_ERROR };
    }

    revalidateGroupRulePaths();
    return { success: true, rules: normalizedSavedRows };
  } catch (err) {
    console.error("[saveStaffGroupScheduleRulesAction] exception", err);
    return { success: false, error: GROUP_RULE_SAVE_ERROR };
  }
}

const applyGroupSchema = z.object({
  groupId: uuid,
  staffIds: z.array(uuid).optional(),
  mode: z.enum(["preview", "apply"]).default("preview"),
});

export type ApplyGroupInput = z.infer<typeof applyGroupSchema>;

const APPLY_SHIFT_TYPES = ["single", "opening", "closing"] as const;
type ApplyShiftType = (typeof APPLY_SHIFT_TYPES)[number];

function normalizeTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

function activeWorkingRulesForDay(rules: StaffGroupScheduleRule[]): StaffGroupScheduleRule[] {
  return rules.filter((rule) => rule.is_day_off !== true);
}

function activeRuleForShift(
  rules: StaffGroupScheduleRule[],
  shiftType: ApplyShiftType
): StaffGroupScheduleRule | undefined {
  return rules.find((rule) => rule.shift_type === shiftType);
}

function ruleRangesOverlap(first: StaffGroupScheduleRule, second: StaffGroupScheduleRule): boolean {
  const firstStart = timeToMinutes(first.start_time);
  let firstEnd = timeToMinutes(first.end_time);
  const secondStart = timeToMinutes(second.start_time);
  let secondEnd = timeToMinutes(second.end_time);
  if (
    firstStart === null ||
    firstEnd === null ||
    secondStart === null ||
    secondEnd === null
  ) {
    return true;
  }

  if (firstEnd <= firstStart) firstEnd += 24 * 60;
  if (secondEnd <= secondStart) secondEnd += 24 * 60;

  return firstStart < secondEnd && secondStart < firstEnd;
}

function validateGroupRulesForApply(rules: StaffGroupScheduleRule[]): string | null {
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
    const dayRules = rules.filter((rule) => rule.day_of_week === dayOfWeek);
    const workingRules = activeWorkingRulesForDay(dayRules);
    const hasDayOffRule = dayRules.some((rule) => rule.is_day_off === true);

    if (hasDayOffRule && workingRules.length > 0) {
      return "A group day cannot be both day off and scheduled.";
    }

    for (const rule of workingRules) {
      if (!isValidShiftRange(rule.start_time, rule.end_time)) {
        return "One or more group rules has an invalid time range.";
      }
    }

    for (let index = 0; index < workingRules.length; index++) {
      for (let other = index + 1; other < workingRules.length; other++) {
        const first = workingRules[index]!;
        const second = workingRules[other]!;
        if (ruleRangesOverlap(first, second)) {
          return "Group split shifts cannot overlap. Adjust the group times before applying them.";
        }
      }
    }
  }

  return null;
}

function buildStaffRowsFromGroupRules(params: {
  staffIds: string[];
  rules: StaffGroupScheduleRule[];
}): StaffScheduleUpsertRow[] {
  const rows: StaffScheduleUpsertRow[] = [];

  for (const staffId of params.staffIds) {
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const dayRules = params.rules.filter((rule) => rule.day_of_week === dayOfWeek);
      const workingRules = activeWorkingRulesForDay(dayRules);
      const fallbackStart = normalizeTime(workingRules[0]?.start_time ?? null) ?? "09:00";
      const fallbackEnd = normalizeTime(workingRules[0]?.end_time ?? null) ?? "18:00";

      for (const shiftType of APPLY_SHIFT_TYPES) {
        const rule = activeRuleForShift(workingRules, shiftType);
        rows.push({
          staff_id: staffId,
          day_of_week: dayOfWeek,
          shift_type: shiftType,
          start_time: normalizeTime(rule?.start_time ?? null) ?? fallbackStart,
          end_time: normalizeTime(rule?.end_time ?? null) ?? fallbackEnd,
          is_active: Boolean(rule),
        });
      }
    }
  }

  return rows;
}

function buildGroupApplyPreview(params: {
  staffRows: Array<{ id: string; full_name: string }>;
  staffIds: string[];
  rules: StaffGroupScheduleRule[];
}): GroupApplyPreviewRow[] {
  const nameMap = new Map(params.staffRows.map((staff) => [staff.id, staff.full_name]));
  const workingRules = params.rules.filter((rule) => rule.is_day_off !== true);

  return workingRules.flatMap((rule) =>
    params.staffIds.map((staffId) => ({
      staffId,
      staffName: nameMap.get(staffId) ?? staffId,
      dayOfWeek: rule.day_of_week,
      startTime: normalizeTime(rule.start_time) ?? "09:00",
      endTime: normalizeTime(rule.end_time) ?? "18:00",
    }))
  );
}

export async function applyGroupScheduleToStaffAction(
  input: ApplyGroupInput
): Promise<{ success: boolean; error?: string; affected?: number; preview?: GroupApplyPreviewRow[] }> {
  try {
    const parsed = applyGroupSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const staffIds = Array.from(new Set(parsed.data.staffIds ?? []));
    if (staffIds.length === 0) {
      return { success: false, error: GROUP_APPLY_TARGET_ERROR };
    }

    const supabase = await createClient();
    const access = await authorizeGroupRuleMutation(supabase, parsed.data.groupId);
    if (!access.authorized) return { success: false, error: access.error };

    const admin = createAdminClient();

    // Resolve group info
    const { data: group, error: groupError } = await admin
      .from("staff_schedule_groups")
      .select("branch_id, group_key")
      .eq("id", parsed.data.groupId)
      .single();

    if (groupError || !group) {
      return { success: false, error: groupError?.message ?? "Group not found" };
    }

    // Fetch active group rules, including explicit day-off markers.
    const { data: rules, error: rulesError } = await admin
      .from("staff_group_schedule_rules")
      .select("*")
      .eq("group_id", parsed.data.groupId)
      .eq("is_active", true);

    if (rulesError) {
      return { success: false, error: rulesError.message };
    }

    if (!rules || rules.length === 0) {
      return { success: false, error: "No active group rules to apply" };
    }

    const groupRules = rules as StaffGroupScheduleRule[];
    const groupRuleError = validateGroupRulesForApply(groupRules);
    if (groupRuleError) {
      return { success: false, error: groupRuleError };
    }

    const { data: staffRows, error: staffError } = await admin
      .from("staff")
      .select("id, full_name")
      .eq("branch_id", group.branch_id)
      .eq("is_active", true)
      .in("id", staffIds);

    if (staffError) {
      return { success: false, error: staffError.message };
    }

    if ((staffRows ?? []).length !== staffIds.length) {
      return {
        success: false,
        error: "One or more selected staff members are not active in this branch.",
      };
    }

    if (parsed.data.mode === "preview") {
      const preview = buildGroupApplyPreview({
        staffRows: (staffRows ?? []) as Array<{ id: string; full_name: string }>,
        staffIds,
        rules: groupRules,
      });

      return { success: true, affected: preview.length, preview: preview.slice(0, 50) };
    }

    const upserts = buildStaffRowsFromGroupRules({ staffIds, rules: groupRules });

    const { data: savedRows, error: upsertError } = await admin
      .from("staff_schedules")
      .upsert(upserts, { onConflict: STAFF_SCHEDULE_CONFLICT_TARGET })
      .select(STAFF_SCHEDULE_RETURNING_COLUMNS);

    if (upsertError) {
      console.error("[applyGroupScheduleToStaffAction] upsert failed", upsertError);
      return { success: false, error: upsertError.message };
    }

    const normalizedSavedRows = (savedRows ?? []) as SavedStaffScheduleRow[];
    if (!savedRowsMatchRequest({ requestedRows: upserts, savedRows: normalizedSavedRows })) {
      console.error("[applyGroupScheduleToStaffAction] verification failed", {
        groupId: parsed.data.groupId,
        staffIds,
        requestedRows: upserts.length,
        savedRows: normalizedSavedRows.length,
      });
      return { success: false, error: "The group schedule was not fully applied." };
    }

    revalidatePath("/crm/staff-availability");
    revalidatePath("/crm/schedule");
    revalidatePath("/crm/availability");
    return { success: true, affected: upserts.length };
  } catch (err) {
    console.error("[applyGroupScheduleToStaffAction] exception", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
