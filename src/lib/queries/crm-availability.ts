import { createClient } from "@/lib/supabase/server";
import { getDailySchedule, type DailyScheduleStaffRow } from "./schedule";
import { getStaffByBranch } from "./staff";
import { isServiceStaffType } from "@/constants/staff-roles";
import { MVP_CHECKIN_PAUSED } from "@/lib/config/mvp-flags";

export type ScheduleStatus = "scheduled" | "off_today" | "no_schedule";

export type PresenceStatus =
  | "checked_in"
  | "not_checked_in"
  | "checked_out"
  | "off_today"
  | "no_schedule";

export type LiveStatus =
  | "available_now"
  | "busy_now"
  | "not_checked_in"
  | "checked_out"
  | "off_today"
  | "no_schedule";

export type ShiftType = "single" | "opening" | "closing";

export type StaffShiftEntry = {
  shift_type: ShiftType;
  start_time: string;
  end_time: string;
};

export type CheckinEntry = {
  id: string;
  shift_type: string;
  checked_in_at: string;
  checked_out_at: string | null;
  status: string;
};

export type CrmAvailabilityStaffRow = {
  staff_id: string;
  staff_name: string;
  staff_type: string;
  system_role: string;
  is_driver: boolean;
  is_service_provider: boolean;
  scheduleStatus: ScheduleStatus;
  liveStatus: LiveStatus;
  presenceStatus: PresenceStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  checkInId: string | null;
  work_start: string | null;
  work_end: string | null;
  shifts: StaffShiftEntry[];
  active_booking: {
    id: string;
    service: string;
    customer: string;
    end_time: string;
  } | null;
  blocks: Array<{ start_time: string; end_time: string; reason: string | null }>;
  needsAttention: boolean;
};

export type CrmAvailabilitySummary = {
  total: number;
  scheduledToday: number;
  checkedIn: number;
  notCheckedIn: number;
  availableNow: number;
  busyNow: number;
  checkedOut: number;
  offToday: number;
  noSchedule: number;
  driversReady: number;
  driversTotal: number;
  needsAttention: number;
  /** Service staff (therapists, nail techs, etc.) with no weekly schedule — affects online booking. */
  serviceStaffNoSchedule: number;
  /** Upcoming bookings waiting for CRM payment confirmation or action. */
  pendingOnlineBookings: number;
};

export type CrmAvailabilitySnapshot = {
  branchId: string;
  date: string;
  asOf: string;
  staff: CrmAvailabilityStaffRow[];
  summary: CrmAvailabilitySummary;
};

function toTimeString(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function isInWorkWindow(nowTime: string, workStart: string, workEnd: string): boolean {
  return nowTime >= workStart && nowTime <= workEnd;
}

export async function getCrmAvailabilitySnapshot(params: {
  branchId: string;
  date: string;
  now?: Date;
}): Promise<CrmAvailabilitySnapshot> {
  const now = params.now ?? new Date();
  const nowTime = toTimeString(now);

  // day_of_week matching staff_schedules.day_of_week (0=Sun)
  const dateObj = new Date(params.date + "T00:00:00");
  const dayOfWeek = dateObj.getDay();

  const supabase = await createClient();

  // Five parallel queries
  const [allStaff, scheduleRows, shiftsResult, checkinsResult, pendingBookingsResult] = await Promise.all([
    getStaffByBranch(params.branchId),
    getDailySchedule({ branchId: params.branchId, date: params.date }),
    supabase
      .from("staff_schedules")
      .select("staff_id, shift_type, start_time, end_time")
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true),
    supabase
      .from("staff_shift_checkins")
      .select("id, staff_id, shift_type, checked_in_at, checked_out_at, status")
      .eq("branch_id", params.branchId)
      .eq("shift_date", params.date)
      .neq("status", "voided"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", params.branchId)
      .in("status", ["pending_payment", "pending_crm_confirmation", "pending"])
      .gte("booking_date", params.date),
  ]);

  const scheduleMap = new Map<string, DailyScheduleStaffRow>(
    scheduleRows.map((row) => [row.staff_id, row])
  );

  // shift map: staff_id → StaffShiftEntry[]
  const shiftMap = new Map<string, StaffShiftEntry[]>();
  for (const row of shiftsResult.data ?? []) {
    const list = shiftMap.get(row.staff_id) ?? [];
    list.push({
      shift_type: (row.shift_type ?? "single") as ShiftType,
      start_time: row.start_time,
      end_time: row.end_time,
    });
    shiftMap.set(row.staff_id, list);
  }

  // checkin map: staff_id → most recent non-voided check-in for today
  // Prefer checked_in over checked_out when multiple exist.
  const checkinMap = new Map<string, CheckinEntry>();
  for (const row of checkinsResult.data ?? []) {
    const existing = checkinMap.get(row.staff_id);
    // Prefer active (checked_in) over checked_out
    if (!existing || (row.status === "checked_in" && existing.status !== "checked_in")) {
      checkinMap.set(row.staff_id, {
        id: row.id,
        shift_type: row.shift_type,
        checked_in_at: row.checked_in_at,
        checked_out_at: row.checked_out_at,
        status: row.status,
      });
    }
  }

  const staffRows: CrmAvailabilityStaffRow[] = allStaff.map((member) => {
    const schedule = scheduleMap.get(member.id);
    const staffType = member.staff_type ?? "";
    const systemRole = member.system_role ?? "";
    const isDriver = systemRole === "driver" || staffType === "driver";
    const isServiceProvider = isServiceStaffType(staffType);
    const shifts = shiftMap.get(member.id) ?? [];
    const checkin = checkinMap.get(member.id) ?? null;

    // ── Schedule status ──────────────────────────────────────────────────────
    let scheduleStatus: ScheduleStatus;
    if (!schedule || schedule.work_start === null) {
      scheduleStatus = "no_schedule";
    } else if (schedule.current_override?.is_day_off === true) {
      scheduleStatus = "off_today";
    } else {
      scheduleStatus = "scheduled";
    }

    // ── Presence status (check-in truth) ────────────────────────────────────
    // When MVP_CHECKIN_PAUSED: all scheduled staff are treated as present.
    // Actual check-in data is preserved in checkedInAt/Out/checkInId for future use.
    let presenceStatus: PresenceStatus;
    if (scheduleStatus === "off_today") {
      presenceStatus = "off_today";
    } else if (scheduleStatus === "no_schedule") {
      presenceStatus = "no_schedule";
    } else if (MVP_CHECKIN_PAUSED) {
      presenceStatus = "checked_in";
    } else if (!checkin) {
      presenceStatus = "not_checked_in";
    } else if (checkin.status === "checked_out") {
      presenceStatus = "checked_out";
    } else {
      presenceStatus = "checked_in";
    }

    // ── Live status (what CRM sees) ──────────────────────────────────────────
    let liveStatus: LiveStatus;
    let active_booking: CrmAvailabilityStaffRow["active_booking"] = null;

    if (scheduleStatus === "off_today") {
      liveStatus = "off_today";
    } else if (scheduleStatus === "no_schedule") {
      liveStatus = "no_schedule";
    } else if (presenceStatus === "not_checked_in") {
      liveStatus = "not_checked_in";
    } else if (presenceStatus === "checked_out") {
      liveStatus = "checked_out";
    } else {
      // presenceStatus === "checked_in" — check for active bookings
      const bookings = schedule?.bookings ?? [];
      const inProgress = bookings.find((b) => b.status === "in_progress");
      const confirmed = bookings.find(
        (b) =>
          b.status === "confirmed" &&
          schedule?.work_start &&
          isInWorkWindow(nowTime, b.start_time.slice(0, 8), b.end_time.slice(0, 8))
      );
      const activeBkg = inProgress ?? confirmed ?? null;

      if (activeBkg) {
        liveStatus = "busy_now";
        active_booking = {
          id: activeBkg.id,
          service: activeBkg.service,
          customer: activeBkg.customer,
          end_time: activeBkg.end_time,
        };
      } else {
        liveStatus = "available_now";
      }
    }

    const needsAttention = scheduleStatus === "no_schedule";

    return {
      staff_id: member.id,
      staff_name: member.full_name,
      staff_type: staffType,
      system_role: systemRole,
      is_driver: isDriver,
      is_service_provider: isServiceProvider,
      scheduleStatus,
      liveStatus,
      presenceStatus,
      checkedInAt: checkin?.checked_in_at ?? null,
      checkedOutAt: checkin?.checked_out_at ?? null,
      checkInId: checkin?.id ?? null,
      work_start: schedule?.work_start ?? null,
      work_end: schedule?.work_end ?? null,
      shifts,
      active_booking,
      blocks:
        schedule?.blocks.map((b) => ({
          start_time: b.start_time,
          end_time: b.end_time,
          reason: b.reason,
        })) ?? [],
      needsAttention,
    };
  });

  const scheduled             = staffRows.filter((s) => s.scheduleStatus === "scheduled");
  const checkedIn             = staffRows.filter((s) => s.presenceStatus === "checked_in");
  const notCheckedIn          = staffRows.filter((s) => s.presenceStatus === "not_checked_in");
  const availableNow          = staffRows.filter((s) => s.liveStatus === "available_now");
  const busyNow               = staffRows.filter((s) => s.liveStatus === "busy_now");
  const checkedOut            = staffRows.filter((s) => s.presenceStatus === "checked_out");
  const offToday              = staffRows.filter((s) => s.scheduleStatus === "off_today");
  const noSchedule            = staffRows.filter((s) => s.scheduleStatus === "no_schedule");
  const drivers               = staffRows.filter((s) => s.is_driver);
  // Drivers ready = checked in + not busy
  const driversReady          = drivers.filter((s) => s.presenceStatus === "checked_in" && s.liveStatus !== "busy_now");
  const attention             = staffRows.filter((s) => s.needsAttention);
  // Service providers (therapists, nail techs, etc.) with no schedule — affects online booking
  const serviceStaffNoSched   = staffRows.filter((s) => s.scheduleStatus === "no_schedule" && s.is_service_provider);

  return {
    branchId: params.branchId,
    date: params.date,
    asOf: now.toISOString(),
    staff: staffRows,
    summary: {
      total: staffRows.length,
      scheduledToday: scheduled.length,
      checkedIn: checkedIn.length,
      notCheckedIn: notCheckedIn.length,
      availableNow: availableNow.length,
      busyNow: busyNow.length,
      checkedOut: checkedOut.length,
      offToday: offToday.length,
      noSchedule: noSchedule.length,
      driversReady: driversReady.length,
      driversTotal: drivers.length,
      needsAttention: attention.length,
      serviceStaffNoSchedule: serviceStaffNoSched.length,
      pendingOnlineBookings: pendingBookingsResult.count ?? 0,
    },
  };
}
