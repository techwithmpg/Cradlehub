import { createClient } from "@/lib/supabase/server";
import {
  dayOfWeekFromDateString,
  getScheduleGroupKeyForStaffType,
  resolveScheduleForStaffDay,
  type GroupScheduleRuleSourceRow,
  type IndividualScheduleSourceRow,
  type ResolvedStaffSchedule,
  type ScheduleOverrideSourceRow,
} from "@/lib/schedule/resolve-staff-schedule";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type StaffScheduleResolutionMember = {
  id: string;
  staff_type: string | null;
};

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function groupKeysForStaffType(staffType: string | null): string[] {
  const mapped = getScheduleGroupKeyForStaffType(staffType);
  return unique([mapped, staffType].filter((value): value is string => Boolean(value)));
}

export async function getResolvedStaffSchedulesForDate(params: {
  supabase: SupabaseClient;
  branchId: string;
  date: string;
  staff: StaffScheduleResolutionMember[];
}): Promise<Map<string, ResolvedStaffSchedule>> {
  const result = new Map<string, ResolvedStaffSchedule>();
  if (params.staff.length === 0) return result;

  const staffIds = params.staff.map((member) => member.id);
  const dayOfWeek = dayOfWeekFromDateString(params.date);
  const staffGroupKeys = new Map<string, string[]>();

  for (const member of params.staff) {
    staffGroupKeys.set(member.id, groupKeysForStaffType(member.staff_type));
  }

  const groupKeys = unique(Array.from(staffGroupKeys.values()).flat());

  const [schedulesResult, overridesResult, groupsResult] = await Promise.all([
    params.supabase
      .from("staff_schedules")
      .select("staff_id, day_of_week, shift_type, start_time, end_time, is_active")
      .in("staff_id", staffIds)
      .eq("day_of_week", dayOfWeek),
    params.supabase
      .from("schedule_overrides")
      .select("staff_id, is_day_off, shift_type, start_time, end_time")
      .in("staff_id", staffIds)
      .eq("override_date", params.date),
    groupKeys.length > 0
      ? params.supabase
          .from("staff_schedule_groups")
          .select("id, group_key")
          .eq("branch_id", params.branchId)
          .eq("is_active", true)
          .in("group_key", groupKeys)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (schedulesResult.error) {
    throw new Error(`Staff schedule query failed: ${schedulesResult.error.message}`);
  }
  if (overridesResult.error) {
    throw new Error(`Schedule override query failed: ${overridesResult.error.message}`);
  }
  if (groupsResult.error) {
    throw new Error(`Schedule group query failed: ${groupsResult.error.message}`);
  }

  const schedulesByStaff = new Map<string, IndividualScheduleSourceRow[]>();
  for (const row of schedulesResult.data ?? []) {
    const list = schedulesByStaff.get(row.staff_id) ?? [];
    list.push({
      shift_type: row.shift_type ?? "single",
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: row.is_active,
    });
    schedulesByStaff.set(row.staff_id, list);
  }

  const overridesByStaff = new Map<string, ScheduleOverrideSourceRow>();
  for (const row of overridesResult.data ?? []) {
    overridesByStaff.set(row.staff_id, {
      is_day_off: row.is_day_off,
      shift_type: row.shift_type,
      start_time: row.start_time,
      end_time: row.end_time,
    });
  }

  const groups = groupsResult.data ?? [];
  const groupIds = groups.map((group) => group.id);
  const groupKeyById = new Map(groups.map((group) => [group.id, group.group_key]));
  const rulesByGroupKey = new Map<string, GroupScheduleRuleSourceRow[]>();

  if (groupIds.length > 0) {
    const rulesResult = await params.supabase
      .from("staff_group_schedule_rules")
      .select("group_id, shift_type, start_time, end_time, is_active, is_day_off")
      .in("group_id", groupIds)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true);

    if (rulesResult.error) {
      throw new Error(`Schedule group rule query failed: ${rulesResult.error.message}`);
    }

    for (const row of rulesResult.data ?? []) {
      const groupKey = groupKeyById.get(row.group_id);
      if (!groupKey) continue;

      const list = rulesByGroupKey.get(groupKey) ?? [];
      list.push({
        shift_type: row.shift_type ?? "single",
        start_time: row.start_time,
        end_time: row.end_time,
        is_active: row.is_active,
        is_day_off: row.is_day_off,
      });
      rulesByGroupKey.set(groupKey, list);
    }
  }

  for (const member of params.staff) {
    const groupRules =
      staffGroupKeys.get(member.id)?.reduce<GroupScheduleRuleSourceRow[]>((rules, key) => {
        if (rules.length > 0) return rules;
        return rulesByGroupKey.get(key) ?? [];
      }, []) ?? [];

    result.set(
      member.id,
      resolveScheduleForStaffDay({
        override: overridesByStaff.get(member.id) ?? null,
        individualRows: schedulesByStaff.get(member.id) ?? [],
        groupRules,
      })
    );
  }

  return result;
}
