import { createClient } from "@/lib/supabase/server";
import { getResolvedStaffSchedulesForDate } from "@/lib/queries/resolved-staff-schedules";
import {
  getScheduleWindowSpan,
  type ResolvedStaffScheduleSource,
  type ResolvedStaffScheduleWindow,
} from "@/lib/schedule/resolve-staff-schedule";
import { getStaffAdminName } from "@/lib/staff/display-name";

export type DailyScheduleBooking = {
  id: string;
  start_time: string;
  end_time: string;
  service: string;
  customer: string;
  status: string;
  type: string | null;
  resource_id: string | null;
  resource_name: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  amount_paid?: number | null;
};

export type DailyScheduleBlock = {
  id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
};

export type DailyScheduleOverride = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

export type DailyScheduleStaffRow = {
  staff_id: string;
  staff_name: string;
  staff_tier: string | null;
  work_start: string | null;
  work_end: string | null;
  current_override: DailyScheduleOverride | null;
  schedule_source: ResolvedStaffScheduleSource;
  schedule_is_day_off: boolean;
  schedule_windows: ResolvedStaffScheduleWindow[];
  bookings: DailyScheduleBooking[];
  blocks: DailyScheduleBlock[];
};

type ScheduleStaffMetaRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  staff_type: string | null;
};

async function loadStaffMetaMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffIds: string[]
): Promise<Map<string, ScheduleStaffMetaRow>> {
  if (staffIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, nickname, staff_type")
    .in("id", staffIds);

  if (error) {
    throw new Error(`Staff metadata query failed: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as ScheduleStaffMetaRow[]).map((staff) => [
      staff.id,
      staff,
    ])
  );
}

export async function getDailySchedule(params: {
  branchId: string;
  date: string;
}): Promise<DailyScheduleStaffRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_daily_schedule", {
    p_branch_id: params.branchId,
    p_date: params.date,
  });

  if (error) {
    throw new Error(`Failed to load daily schedule: ${error.message}`);
  }

  const rows = data ?? [];
  const staffIds = Array.from(
    new Set(rows.map((row) => row.staff_id).filter((id): id is string => Boolean(id)))
  );
  const staffMetaMap = await loadStaffMetaMap(supabase, staffIds);
  const [blocksResult, overridesResult] = staffIds.length > 0
    ? await Promise.all([
        supabase
          .from("blocked_times")
          .select("id, staff_id, block_date, start_time, end_time, reason")
          .eq("block_date", params.date)
          .in("staff_id", staffIds),
        supabase
          .from("schedule_overrides")
          .select("id, staff_id, override_date, is_day_off, shift_type, start_time, end_time, reason")
          .eq("override_date", params.date)
          .in("staff_id", staffIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (blocksResult.error) {
    throw new Error(`Blocked-times query failed: ${blocksResult.error.message}`);
  }

  if (overridesResult.error) {
    throw new Error(`Schedule-overrides query failed: ${overridesResult.error.message}`);
  }

  const blocksByStaff = new Map<string, DailyScheduleBlock[]>();
  for (const block of blocksResult.data ?? []) {
    const list = blocksByStaff.get(block.staff_id) ?? [];
    list.push({
      id: block.id,
      start_time: block.start_time,
      end_time: block.end_time,
      reason: block.reason,
    });
    blocksByStaff.set(block.staff_id, list);
  }

  const overridesByStaff = new Map<string, DailyScheduleOverride>();
  for (const override of overridesResult.data ?? []) {
    overridesByStaff.set(override.staff_id, {
      id: override.id,
      override_date: override.override_date,
      is_day_off: override.is_day_off,
      shift_type: override.shift_type,
      start_time: override.start_time,
      end_time: override.end_time,
      reason: override.reason,
    });
  }

  const resolvedSchedules = await getResolvedStaffSchedulesForDate({
    supabase,
    branchId: params.branchId,
    date: params.date,
    staff: staffIds.map((id) => ({
      id,
      staff_type: staffMetaMap.get(id)?.staff_type ?? null,
    })),
  });

  return rows.map((r) => {
    const resolved = resolvedSchedules.get(r.staff_id);
    const span = resolved ? getScheduleWindowSpan(resolved.windows) : null;

    return {
      staff_id: r.staff_id,
      staff_name: staffMetaMap.has(r.staff_id)
        ? getStaffAdminName(staffMetaMap.get(r.staff_id)!)
        : r.staff_name,
      staff_tier: r.staff_tier,
      work_start: span?.startTime ?? null,
      work_end: span?.endTime ?? null,
      current_override: overridesByStaff.get(r.staff_id) ?? null,
      schedule_source: resolved?.source ?? "none",
      schedule_is_day_off: resolved?.isDayOff ?? false,
      schedule_windows: resolved?.windows ?? [],
      bookings: (r.bookings as DailyScheduleBooking[] | null) ?? [],
      blocks:
        blocksByStaff.get(r.staff_id) ??
        ((r.blocks as Array<Omit<DailyScheduleBlock, "id">> | null) ?? []).map((block, index) => ({
          id: `rpc-block-${r.staff_id}-${params.date}-${index}`,
          ...block,
        })),
    };
  });
}
