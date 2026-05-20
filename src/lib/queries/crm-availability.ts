import { getDailySchedule, type DailyScheduleStaffRow } from "./schedule";
import { getStaffByBranch } from "./staff";
import { isServiceStaffType } from "@/constants/staff-roles";

export type ScheduleStatus = "scheduled" | "off_today" | "no_schedule";
export type LiveStatus = "available_now" | "busy_now" | "off_today" | "no_schedule";

export type CrmAvailabilityStaffRow = {
  staff_id: string;
  staff_name: string;
  staff_type: string;
  system_role: string;
  is_driver: boolean;
  is_service_provider: boolean;
  scheduleStatus: ScheduleStatus;
  liveStatus: LiveStatus;
  work_start: string | null;
  work_end: string | null;
  active_booking: {
    id: string;
    service: string;
    customer: string;
    end_time: string;
  } | null;
  blocks: Array<{ start_time: string; end_time: string; reason: string | null }>;
};

export type CrmAvailabilitySummary = {
  total: number;
  scheduledToday: number;
  offToday: number;
  noSchedule: number;
  availableNow: number;
  busyNow: number;
  driversReady: number;
  driversTotal: number;
};

export type CrmAvailabilitySnapshot = {
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

  const [allStaff, scheduleRows] = await Promise.all([
    getStaffByBranch(params.branchId),
    getDailySchedule({ branchId: params.branchId, date: params.date }),
  ]);

  const scheduleMap = new Map<string, DailyScheduleStaffRow>(
    scheduleRows.map((row) => [row.staff_id, row])
  );

  const staffRows: CrmAvailabilityStaffRow[] = allStaff.map((member) => {
    const schedule = scheduleMap.get(member.id);
    const staffType = member.staff_type ?? "";
    const systemRole = member.system_role ?? "";
    const isDriver = systemRole === "driver" || staffType === "driver";
    const isServiceProvider = isServiceStaffType(staffType);

    let scheduleStatus: ScheduleStatus;
    if (!schedule || schedule.work_start === null) {
      scheduleStatus = "no_schedule";
    } else if (schedule.current_override?.is_day_off === true) {
      scheduleStatus = "off_today";
    } else {
      scheduleStatus = "scheduled";
    }

    let liveStatus: LiveStatus;
    let active_booking: CrmAvailabilityStaffRow["active_booking"] = null;

    if (scheduleStatus === "off_today") {
      liveStatus = "off_today";
    } else if (scheduleStatus === "no_schedule") {
      liveStatus = "no_schedule";
    } else {
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

    return {
      staff_id: member.id,
      staff_name: member.full_name,
      staff_type: staffType,
      system_role: systemRole,
      is_driver: isDriver,
      is_service_provider: isServiceProvider,
      scheduleStatus,
      liveStatus,
      work_start: schedule?.work_start ?? null,
      work_end: schedule?.work_end ?? null,
      active_booking,
      blocks:
        schedule?.blocks.map((b) => ({
          start_time: b.start_time,
          end_time: b.end_time,
          reason: b.reason,
        })) ?? [],
    };
  });

  const scheduled = staffRows.filter((s) => s.scheduleStatus === "scheduled");
  const offToday = staffRows.filter((s) => s.scheduleStatus === "off_today");
  const noSchedule = staffRows.filter((s) => s.scheduleStatus === "no_schedule");
  const availableNow = staffRows.filter((s) => s.liveStatus === "available_now");
  const busyNow = staffRows.filter((s) => s.liveStatus === "busy_now");
  const drivers = staffRows.filter((s) => s.is_driver);
  const driversReady = drivers.filter((s) => s.liveStatus === "available_now");

  return {
    date: params.date,
    asOf: now.toISOString(),
    staff: staffRows,
    summary: {
      total: staffRows.length,
      scheduledToday: scheduled.length,
      offToday: offToday.length,
      noSchedule: noSchedule.length,
      availableNow: availableNow.length,
      busyNow: busyNow.length,
      driversReady: driversReady.length,
      driversTotal: drivers.length,
    },
  };
}
