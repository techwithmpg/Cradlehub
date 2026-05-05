import { createClient } from "@/lib/supabase/server";

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
};

export type DailyScheduleBlock = {
  start_time: string;
  end_time: string;
  reason: string | null;
};

export type DailyScheduleStaffRow = {
  staff_id: string;
  staff_name: string;
  staff_tier: string | null;
  work_start: string | null;
  work_end: string | null;
  bookings: DailyScheduleBooking[];
  blocks: DailyScheduleBlock[];
};

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

  return rows.map((r) => ({
    staff_id: r.staff_id,
    staff_name: r.staff_name,
    staff_tier: r.staff_tier,
    work_start: r.work_start,
    work_end: r.work_end,
    bookings: (r.bookings as DailyScheduleBooking[] | null) ?? [],
    blocks: (r.blocks as DailyScheduleBlock[] | null) ?? [],
  }));
}
