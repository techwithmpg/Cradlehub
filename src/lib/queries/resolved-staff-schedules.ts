import { createClient } from "@/lib/supabase/server";
import {
  dayOfWeekFromDateString,
  resolveScheduleForStaffDay,
  type IndividualScheduleSourceRow,
  type ResolvedStaffSchedule,
  type ScheduleOverrideSourceRow,
} from "@/lib/schedule/resolve-staff-schedule";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type StaffScheduleResolutionMember = {
  id: string;
  staff_type: string | null;
  system_role?: string | null;
  operational?: boolean;
};

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

  const [schedulesResult, overridesResult] = await Promise.all([
    params.supabase
      .from("staff_schedules")
      .select("id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order, ends_next_day")
      .in("staff_id", staffIds)
      .eq("day_of_week", dayOfWeek),
    params.supabase
      .from("schedule_overrides")
      .select("id, staff_id, is_day_off, shift_type, start_time, end_time, ends_next_day")
      .in("staff_id", staffIds)
      .eq("override_date", params.date),
  ]);

  if (schedulesResult.error) {
    throw new Error(`Staff schedule query failed: ${schedulesResult.error.message}`);
  }
  if (overridesResult.error) {
    throw new Error(`Schedule override query failed: ${overridesResult.error.message}`);
  }

  const schedulesByStaff = new Map<string, IndividualScheduleSourceRow[]>();
  for (const row of schedulesResult.data ?? []) {
    const list = schedulesByStaff.get(row.staff_id) ?? [];
    list.push({
      id: row.id,
      shift_type: row.shift_type ?? "single",
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: row.is_active,
      window_order: row.window_order ?? null,
      ends_next_day: row.ends_next_day ?? null,
    });
    schedulesByStaff.set(row.staff_id, list);
  }

  const overridesByStaff = new Map<string, ScheduleOverrideSourceRow>();
  for (const row of overridesResult.data ?? []) {
    overridesByStaff.set(row.staff_id, {
      id: row.id,
      is_day_off: row.is_day_off,
      shift_type: row.shift_type,
      start_time: row.start_time,
      end_time: row.end_time,
      ends_next_day: row.ends_next_day ?? null,
    });
  }

  for (const member of params.staff) {
    result.set(
      member.id,
      resolveScheduleForStaffDay({
        override: overridesByStaff.get(member.id) ?? null,
        individualRows: schedulesByStaff.get(member.id) ?? [],
        staff: {
          staff_type: member.staff_type,
          system_role: member.system_role ?? null,
        },
        operational: member.operational ?? true,
      })
    );
  }

  return result;
}
