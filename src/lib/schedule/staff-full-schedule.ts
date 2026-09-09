import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type OneOrMany<T> = T | T[] | null;

type StaffProfileRow = {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  staff_type: string | null;
  system_role: string | null;
  branch_id: string | null;
  branches: OneOrMany<{ name: string }>;
};

type ScheduleRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type: string | null;
  window_order: number | null;
  ends_next_day: boolean | null;
};

type OverrideRow = {
  id: string;
  override_date: string;
  is_day_off: boolean;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type BlockedTimeRow = {
  id: string;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
};

type BookingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string | null;
  services: OneOrMany<{ name: string }>;
  customers: OneOrMany<{ full_name: string }>;
};

export type StaffFullScheduleData = {
  staff: {
    id: string;
    full_name: string;
    nickname: string | null;
    avatar_url: string | null;
    staff_type: string | null;
    system_role: string | null;
    branch_name: string | null;
  };
  schedules: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
    shift_type: "opening" | "closing" | "single";
    window_order: number | null;
    ends_next_day: boolean | null;
  }>;
  custom_overrides: Array<{
    id: string;
    date: string;
    shift_type: "opening" | "closing" | "single" | "day_off";
    start_time: string | null;
    end_time: string | null;
    reason: string | null;
  }>;
  blocked_times: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    reason: string | null;
  }>;
  bookings: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    service_name: string;
    customer_name: string | null;
    status: string | null;
  }>;
};

type StaffFullScheduleInput = {
  supabase: SupabaseClient<Database>;
  branchId: string;
  staffId: string;
  startDate: string;
  endDate: string;
};

function first<T>(value: OneOrMany<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeShiftType(value: string | null | undefined): "opening" | "closing" | "single" {
  if (value === "opening" || value === "closing") return value;
  return "single";
}

/**
 * Canonical full-schedule reader shared by hosted web and desktop.
 *
 * The caller owns authentication/authorization and supplies the appropriate
 * Supabase client:
 * - hosted web may pass its already-authorized server client
 * - desktop MUST pass the bearer-auth user-scoped client so RLS remains active
 *
 * branchId is always applied to the target staff lookup.
 */
export async function getStaffFullSchedule({
  supabase,
  branchId,
  staffId,
  startDate,
  endDate,
}: StaffFullScheduleInput): Promise<StaffFullScheduleData | null> {
  const { data: staffData, error: staffError } = await supabase
    .from("staff")
    .select(
      "id, full_name, nickname, avatar_url, staff_type, system_role, branch_id, branches(name)"
    )
    .eq("id", staffId)
    .eq("branch_id", branchId)
    .maybeSingle();

  if (staffError) {
    throw new Error(staffError.message);
  }

  const staff = staffData as StaffProfileRow | null;

  if (!staff) {
    return null;
  }

  const [schedulesResult, overridesResult, blockedResult, bookingsResult] = await Promise.all([
    supabase
      .from("staff_schedules")
      .select(
        "id, day_of_week, start_time, end_time, is_active, shift_type, window_order, ends_next_day"
      )
      .eq("staff_id", staffId)
      .order("day_of_week")
      .order("window_order"),
    supabase
      .from("schedule_overrides")
      .select("id, override_date, is_day_off, shift_type, start_time, end_time, reason")
      .eq("staff_id", staffId)
      .gte("override_date", startDate)
      .lte("override_date", endDate)
      .order("override_date"),
    supabase
      .from("blocked_times")
      .select("id, block_date, start_time, end_time, reason")
      .eq("staff_id", staffId)
      .gte("block_date", startDate)
      .lte("block_date", endDate)
      .order("block_date")
      .order("start_time"),
    supabase
      .from("bookings")
      .select(
        "id, booking_date, start_time, end_time, status, services(name), customers(full_name)"
      )
      .eq("staff_id", staffId)
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .not("status", "in", '("cancelled","no_show")')
      .order("booking_date")
      .order("start_time"),
  ]);

  const firstError =
    schedulesResult.error ??
    overridesResult.error ??
    blockedResult.error ??
    bookingsResult.error ??
    null;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const branch = first(staff.branches);

  const schedules = ((schedulesResult.data ?? []) as ScheduleRow[]).map((row) => ({
    id: row.id,
    day_of_week: row.day_of_week,
    start_time: row.start_time,
    end_time: row.end_time,
    is_active: row.is_active,
    shift_type: normalizeShiftType(row.shift_type),
    window_order: row.window_order,
    ends_next_day: row.ends_next_day,
  }));

  const custom_overrides = ((overridesResult.data ?? []) as OverrideRow[]).map((row) => ({
    id: row.id,
    date: row.override_date,
    shift_type: row.is_day_off ? ("day_off" as const) : normalizeShiftType(row.shift_type),
    start_time: row.start_time,
    end_time: row.end_time,
    reason: row.reason,
  }));

  const blocked_times = ((blockedResult.data ?? []) as BlockedTimeRow[]).map((row) => ({
    id: row.id,
    date: row.block_date,
    start_time: row.start_time,
    end_time: row.end_time,
    reason: row.reason,
  }));

  const bookings = ((bookingsResult.data ?? []) as BookingRow[]).map((row) => ({
    id: row.id,
    date: row.booking_date,
    start_time: row.start_time,
    end_time: row.end_time,
    service_name: first(row.services)?.name ?? "Appointment",
    customer_name: first(row.customers)?.full_name ?? null,
    status: row.status,
  }));

  return {
    staff: {
      id: staff.id,
      full_name: staff.full_name,
      nickname: staff.nickname,
      avatar_url: staff.avatar_url,
      staff_type: staff.staff_type,
      system_role: staff.system_role,
      branch_name: branch?.name ?? null,
    },
    schedules,
    custom_overrides,
    blocked_times,
    bookings,
  };
}
