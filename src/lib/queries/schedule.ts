import { createClient } from "@/lib/supabase/server";
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
  bookings: DailyScheduleBooking[];
  blocks: DailyScheduleBlock[];
};

type ScheduleStaffNameRow = {
  id: string;
  full_name: string;
  nickname: string | null;
};

async function loadStaffNameMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffIds: string[]
): Promise<Map<string, string>> {
  if (staffIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, nickname")
    .in("id", staffIds);

  if (error) return new Map();

  return new Map(
    ((data ?? []) as ScheduleStaffNameRow[]).map((staff) => [
      staff.id,
      getStaffAdminName(staff),
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
  const staffNameMap = await loadStaffNameMap(supabase, staffIds);
  const [blocksResult, overridesResult] = staffIds.length > 0
    ? await Promise.all([
        supabase
          .from("blocked_times")
          .select("id, staff_id, block_date, start_time, end_time, reason")
          .eq("block_date", params.date)
          .in("staff_id", staffIds),
        supabase
          .from("schedule_overrides")
          .select("id, staff_id, override_date, is_day_off, start_time, end_time, reason")
          .eq("override_date", params.date)
          .in("staff_id", staffIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const blocksByStaff = new Map<string, DailyScheduleBlock[]>();
  if (!blocksResult.error) {
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
  }

  const overridesByStaff = new Map<string, DailyScheduleOverride>();
  if (!overridesResult.error) {
    for (const override of overridesResult.data ?? []) {
      overridesByStaff.set(override.staff_id, {
        id: override.id,
        override_date: override.override_date,
        is_day_off: override.is_day_off,
        start_time: override.start_time,
        end_time: override.end_time,
        reason: override.reason,
      });
    }
  }

  return rows.map((r) => ({
    staff_id: r.staff_id,
    staff_name: staffNameMap.get(r.staff_id) ?? r.staff_name,
    staff_tier: r.staff_tier,
    work_start: r.work_start,
    work_end: r.work_end,
    current_override: overridesByStaff.get(r.staff_id) ?? null,
    bookings: (r.bookings as DailyScheduleBooking[] | null) ?? [],
    blocks:
      blocksByStaff.get(r.staff_id) ??
      ((r.blocks as Array<Omit<DailyScheduleBlock, "id">> | null) ?? []).map((block, index) => ({
        id: `rpc-block-${r.staff_id}-${params.date}-${index}`,
        ...block,
      })),
  }));
}
