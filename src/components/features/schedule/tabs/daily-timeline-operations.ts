import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-types";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { timeToMinutes } from "@/lib/utils/schedule-timeline";
import { BRANCH_TIMEZONE, getBranchTime } from "@/lib/engine/slot-time";

export type StaffGroupKey =
  | "all"
  | "therapist"
  | "front_desk"
  | "salon"
  | "aesthetician"
  | "utility"
  | "driver"
  | "managerial"
  | "other";

export type ShiftGroupKey = "opening" | "regular" | "closing" | "off";
export type TimelineStatusFilter = "all" | "available" | "busy" | "scheduled" | "off";
export type ScheduleDisplayState = "valid" | "day_off" | "not_configured" | "needs_review";

export type TimelineFilters = {
  query: string;
  shift: "all" | ShiftGroupKey;
  status: TimelineStatusFilter;
};

export const STAFF_GROUPS: Array<{
  key: StaffGroupKey;
  label: string;
  staffTypes: string[];
}> = [
  { key: "all", label: "All Staff", staffTypes: [] },
  { key: "therapist", label: "Therapists", staffTypes: ["therapist"] },
  { key: "front_desk", label: "CRM / Front Desk", staffTypes: ["csr"] },
  { key: "salon", label: "Salon", staffTypes: ["nail_tech", "salon_head"] },
  { key: "aesthetician", label: "Aestheticians", staffTypes: ["aesthetician", "facialist"] },
  { key: "utility", label: "Utility", staffTypes: ["utility"] },
  { key: "driver", label: "Drivers", staffTypes: ["driver"] },
  { key: "managerial", label: "Managers", staffTypes: ["managerial"] },
  { key: "other", label: "Other", staffTypes: [] },
];

export function buildStaffTypeMap(items: StaffScheduleItem[]): Map<string, string | null> {
  return new Map(items.map((item) => [item.staff.id, item.staff.staff_type]));
}

export function getStaffGroupKey(staffType: string | null | undefined): StaffGroupKey {
  const match = STAFF_GROUPS.find(
    (group) => group.key !== "all" && group.key !== "other" && group.staffTypes.includes(staffType ?? "")
  );
  return match?.key ?? "other";
}

export function getStaffTypeLabel(staffType: string | null | undefined): string {
  if (!staffType) return "Staff member";
  if (staffType === "csr") {
    return "CRM / Front Desk";
  }
  return staffType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getShiftGroup(row: DailyScheduleStaffRow): ShiftGroupKey {
  if (getScheduleDisplayState(row) !== "valid") return "off";
  if (row.schedule_windows.some((window) => window.shiftType === "opening")) return "opening";
  if (row.schedule_windows.some((window) => window.shiftType === "closing")) return "closing";
  return "regular";
}

export function getScheduleDisplayState(row: DailyScheduleStaffRow): ScheduleDisplayState {
  if (row.schedule_status === "conflict") return "needs_review";
  if (row.schedule_is_day_off || row.schedule_status === "day_off") return "day_off";
  if (row.schedule_status === "missing" || row.schedule_source === "none") return "not_configured";
  if (row.schedule_windows.length === 0) return "not_configured";
  return "valid";
}

export function getScheduleDisplayLabel(row: DailyScheduleStaffRow): string {
  const state = getScheduleDisplayState(row);
  if (state === "day_off") return "Day Off";
  if (state === "not_configured") return "Not Configured";
  if (state === "needs_review") return "Needs Review";
  return "Scheduled";
}

export function rowMatchesShiftFilter(
  row: DailyScheduleStaffRow,
  filter: TimelineFilters["shift"]
): boolean {
  if (filter === "all") return true;
  const displayState = getScheduleDisplayState(row);
  if (filter === "off") return displayState !== "valid";
  if (displayState !== "valid") return false;
  if (filter === "regular") {
    return row.schedule_windows.some((window) => window.shiftType === "single");
  }
  return row.schedule_windows.some((window) => window.shiftType === filter);
}

function overlapsNow(start: string, end: string, minutes: number, endsNextDay = false): boolean {
  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);
  let currentMinutes = minutes;
  if (endsNextDay || endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
    if (currentMinutes < startMinutes) currentMinutes += 24 * 60;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function getTimelineStatus(
  row: DailyScheduleStaffRow,
  date: string,
  now: Date | null = new Date()
): Exclude<TimelineStatusFilter, "all"> {
  if (getShiftGroup(row) === "off") return "off";
  if (!now) return "scheduled";
  const branchNow = getBranchTime(now, BRANCH_TIMEZONE);
  if (date !== branchNow.ymd) return "scheduled";

  const minutes = Math.floor(branchNow.minutesIntoDay);
  const onShift = row.schedule_windows.some((window) =>
    overlapsNow(window.startTime, window.endTime, minutes, window.endsNextDay === true)
  );
  if (!onShift) return "scheduled";

  const blocked = row.blocks.some((block) => overlapsNow(block.start_time, block.end_time, minutes));
  const booked = row.bookings.some(
    (booking) =>
      booking.status !== "cancelled" &&
      booking.status !== "no_show" &&
      overlapsNow(booking.start_time, booking.end_time, minutes)
  );
  return blocked || booked ? "busy" : "available";
}

export function filterTimelineRows(params: {
  rows: DailyScheduleStaffRow[];
  staffTypeById: Map<string, string | null>;
  group: StaffGroupKey;
  filters: TimelineFilters;
  date: string;
  now?: Date | null;
}): DailyScheduleStaffRow[] {
  const query = params.filters.query.trim().toLowerCase();
  return params.rows.filter((row) => {
    const staffType = params.staffTypeById.get(row.staff_id) ?? null;
    const groupMatches = params.group === "all" || getStaffGroupKey(staffType) === params.group;
    const queryMatches = !query || row.staff_name.toLowerCase().includes(query);
    const shiftMatches = rowMatchesShiftFilter(row, params.filters.shift);
    const status = getTimelineStatus(row, params.date, params.now);
    const statusMatches = params.filters.status === "all" || status === params.filters.status;
    return groupMatches && queryMatches && shiftMatches && statusMatches;
  });
}
