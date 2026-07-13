import { createClient } from "@/lib/supabase/server";
import { getResolvedStaffSchedulesForDate } from "@/lib/queries/resolved-staff-schedules";
import {
  getScheduleWindowSpan,
  type ResolvedStaffScheduleConflictCode,
  type ResolvedStaffScheduleSource,
  type ResolvedStaffScheduleState,
  type ResolvedStaffScheduleStatus,
  type ResolvedStaffScheduleWindow,
} from "@/lib/schedule/resolve-staff-schedule";
import { getStaffAdminName } from "@/lib/staff/display-name";
import {
  isOperationalStaff,
  type OperationalStaffFlags,
} from "@/lib/staff/operational-staff";

type OneOrMany<T> = T | T[] | null;
type JsonRecord = Record<string, unknown>;

export type DailyScheduleBooking = {
  id: string;
  start_time: string;
  end_time: string;
  service_id?: string | null;
  service: string;
  service_metadata?: JsonRecord | null;
  customer: string;
  status: string;
  type: string | null;
  delivery_type?: string | null;
  resource_id: string | null;
  resource_name: string | null;
  resource_type?: string | null;
  resource_capacity?: number | null;
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

export type DailyScheduleAttendancePresence = {
  state: "not_expected" | "not_checked_in" | "checked_in" | "checked_out";
  checkin_id: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  status: string | null;
};

export type DailyScheduleStaffRow = {
  staff_id: string;
  staff_name: string;
  staff_tier: string | null;
  work_start: string | null;
  work_end: string | null;
  current_override: DailyScheduleOverride | null;
  schedule_source: ResolvedStaffScheduleSource;
  schedule_status: ResolvedStaffScheduleStatus;
  schedule_state?: ResolvedStaffScheduleState;
  schedule_is_day_off: boolean;
  schedule_windows: ResolvedStaffScheduleWindow[];
  schedule_conflict_code: ResolvedStaffScheduleConflictCode | null;
  schedule_conflict_reason: string | null;
  bookings: DailyScheduleBooking[];
  blocks: DailyScheduleBlock[];
  attendance_presence?: DailyScheduleAttendancePresence;
};

type ScheduleStaffMetaRow = OperationalStaffFlags & {
  id: string;
  full_name: string;
  nickname: string | null;
  tier: string | null;
  staff_type: string | null;
  system_role: string | null;
  branch_id: string | null;
};

type BookingQueryRow = {
  id: string;
  staff_id: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  type: string | null;
  resource_id: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  amount_paid?: number | string | null;
  service_id?: string | null;
  delivery_type?: string | null;
  services?: OneOrMany<{ name: string | null; metadata?: JsonRecord | null }>;
  customers?: OneOrMany<{ full_name: string | null }>;
  resource?: OneOrMany<{
    name: string | null;
    type?: string | null;
    capacity?: number | string | null;
  }>;
};

type BlockedTimeQueryRow = {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
};

type OverrideQueryRow = {
  id: string;
  staff_id: string;
  override_date: string;
  is_day_off: boolean;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type CheckinQueryRow = {
  id: string;
  staff_id: string;
  status: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  attendance_business_date?: string | null;
  shift_date?: string | null;
  shift_instance_key?: string | null;
};

async function loadOperationalStaff(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string
): Promise<ScheduleStaffMetaRow[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, nickname, tier, staff_type, system_role, branch_id, is_active, archived_at, merged_into_staff_id, metadata")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("tier")
    .order("full_name");

  if (error) {
    throw new Error(`Staff roster query failed: ${error.message}`);
  }

  return ((data ?? []) as ScheduleStaffMetaRow[]).filter((staff) =>
    isOperationalStaff(staff)
  );
}

function firstRelation<T>(relation: OneOrMany<T> | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function toAmountPaid(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toMetadata(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function buildBookingsByStaff(rows: BookingQueryRow[]): Map<string, DailyScheduleBooking[]> {
  const bookingsByStaff = new Map<string, DailyScheduleBooking[]>();

  for (const row of rows) {
    if (!row.staff_id || !row.start_time || !row.end_time) continue;
    const service = firstRelation(row.services);
    const customer = firstRelation(row.customers);
    const resource = firstRelation(row.resource);
    const list = bookingsByStaff.get(row.staff_id) ?? [];
    list.push({
      id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      service_id: row.service_id ?? null,
      service: service?.name ?? "Service",
      service_metadata: toMetadata(service?.metadata),
      customer: customer?.full_name ?? "Guest client",
      status: row.status ?? "pending",
      type: row.type,
      delivery_type: row.delivery_type ?? null,
      resource_id: row.resource_id,
      resource_name: resource?.name ?? null,
      resource_type: resource?.type ?? null,
      resource_capacity: toNumber(resource?.capacity),
      payment_method: row.payment_method ?? null,
      payment_status: row.payment_status ?? null,
      amount_paid: toAmountPaid(row.amount_paid),
    });
    bookingsByStaff.set(row.staff_id, list);
  }

  return bookingsByStaff;
}

function buildBlocksByStaff(rows: BlockedTimeQueryRow[]): Map<string, DailyScheduleBlock[]> {
  const blocksByStaff = new Map<string, DailyScheduleBlock[]>();

  for (const block of rows) {
    const list = blocksByStaff.get(block.staff_id) ?? [];
    list.push({
      id: block.id,
      start_time: block.start_time,
      end_time: block.end_time,
      reason: block.reason,
    });
    blocksByStaff.set(block.staff_id, list);
  }

  return blocksByStaff;
}

function buildOverridesByStaff(rows: OverrideQueryRow[]): Map<string, DailyScheduleOverride> {
  const overridesByStaff = new Map<string, DailyScheduleOverride>();

  for (const override of rows) {
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

  return overridesByStaff;
}

function buildCheckinsByStaff(rows: CheckinQueryRow[]): Map<string, CheckinQueryRow[]> {
  const checkinsByStaff = new Map<string, CheckinQueryRow[]>();

  for (const checkin of rows) {
    const list = checkinsByStaff.get(checkin.staff_id) ?? [];
    list.push(checkin);
    checkinsByStaff.set(checkin.staff_id, list);
  }

  return checkinsByStaff;
}

function getAttendancePresence(params: {
  checkins: CheckinQueryRow[];
  expectedToWork: boolean;
}): DailyScheduleAttendancePresence {
  const sorted = [...params.checkins].sort((a, b) =>
    (b.checked_in_at ?? b.checked_out_at ?? "").localeCompare(
      a.checked_in_at ?? a.checked_out_at ?? ""
    )
  );
  const active = sorted.find((checkin) => checkin.checked_in_at && !checkin.checked_out_at);
  if (active) {
    return {
      state: "checked_in",
      checkin_id: active.id,
      checked_in_at: active.checked_in_at,
      checked_out_at: active.checked_out_at,
      status: active.status,
    };
  }

  const checkedOut = sorted.find((checkin) => checkin.checked_out_at);
  if (checkedOut) {
    return {
      state: "checked_out",
      checkin_id: checkedOut.id,
      checked_in_at: checkedOut.checked_in_at,
      checked_out_at: checkedOut.checked_out_at,
      status: checkedOut.status,
    };
  }

  return {
    state: params.expectedToWork ? "not_checked_in" : "not_expected",
    checkin_id: null,
    checked_in_at: null,
    checked_out_at: null,
    status: null,
  };
}

export async function getDailySchedule(params: {
  branchId: string;
  date: string;
}): Promise<DailyScheduleStaffRow[]> {
  const supabase = await createClient();
  const staffRows = await loadOperationalStaff(supabase, params.branchId);
  const staffIds = staffRows.map((staff) => staff.id);

  if (staffIds.length === 0) return [];

  const [bookingsResult, blocksResult, overridesResult, checkinsResult] = await Promise.all([
      supabase
      .from("bookings")
      .select("id, staff_id, start_time, end_time, status, type, delivery_type, resource_id, service_id, payment_method, payment_status, amount_paid, services(name, metadata), customers(full_name), resource:branch_resources!bookings_resource_id_fkey(name, type, capacity)")
      .eq("branch_id", params.branchId)
      .eq("booking_date", params.date)
      .in("staff_id", staffIds),
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
    supabase
      .from("staff_shift_checkins")
      .select("id, staff_id, status, checked_in_at, checked_out_at, attendance_business_date, shift_date, shift_instance_key")
      .eq("branch_id", params.branchId)
      .in("staff_id", staffIds)
      .or(`attendance_business_date.eq.${params.date},shift_date.eq.${params.date}`),
  ]);

  if (bookingsResult.error) {
    throw new Error(`Bookings query failed: ${bookingsResult.error.message}`);
  }

  if (blocksResult.error) {
    throw new Error(`Blocked-times query failed: ${blocksResult.error.message}`);
  }

  if (overridesResult.error) {
    throw new Error(`Schedule-overrides query failed: ${overridesResult.error.message}`);
  }

  if (checkinsResult.error) {
    throw new Error(`Staff check-ins query failed: ${checkinsResult.error.message}`);
  }

  const bookingsByStaff = buildBookingsByStaff((bookingsResult.data ?? []) as BookingQueryRow[]);
  const blocksByStaff = buildBlocksByStaff((blocksResult.data ?? []) as BlockedTimeQueryRow[]);
  const overridesByStaff = buildOverridesByStaff((overridesResult.data ?? []) as OverrideQueryRow[]);
  const checkinsByStaff = buildCheckinsByStaff((checkinsResult.data ?? []) as CheckinQueryRow[]);

  const resolvedSchedules = await getResolvedStaffSchedulesForDate({
    supabase,
    branchId: params.branchId,
    date: params.date,
    staff: staffRows.map((staff) => ({
      id: staff.id,
      staff_type: staff.staff_type,
      system_role: staff.system_role,
      operational: true,
    })),
  });

  return staffRows.map((staff) => {
    const resolved = resolvedSchedules.get(staff.id);
    const span = resolved ? getScheduleWindowSpan(resolved.windows) : null;
    const checkins = checkinsByStaff.get(staff.id) ?? [];

    return {
      staff_id: staff.id,
      staff_name: getStaffAdminName(staff),
      staff_tier: staff.tier,
      work_start: span?.startTime ?? null,
      work_end: span?.endTime ?? null,
      current_override: overridesByStaff.get(staff.id) ?? null,
      schedule_source: resolved?.source ?? "none",
      schedule_status: resolved?.status ?? "missing",
      schedule_state: resolved?.state ?? "NO_SCHEDULE_CONFIGURED",
      schedule_is_day_off: resolved?.isDayOff ?? false,
      schedule_windows: resolved?.windows ?? [],
      schedule_conflict_code: resolved?.conflictCode ?? null,
      schedule_conflict_reason: resolved?.conflictReason ?? null,
      bookings: bookingsByStaff.get(staff.id) ?? [],
      blocks: blocksByStaff.get(staff.id) ?? [],
      attendance_presence: getAttendancePresence({
        checkins,
        expectedToWork: resolved?.isWorking ?? false,
      }),
    };
  });
}
