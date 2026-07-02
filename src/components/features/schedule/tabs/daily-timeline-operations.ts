import type { StaffScheduleItem } from "@/components/features/staff-schedule/staff-schedule-list";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";
import { timeToMinutes } from "@/lib/utils/schedule-timeline";

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
  if (row.schedule_is_day_off || row.schedule_windows.length === 0) return "off";
  if (row.schedule_windows.some((window) => window.shiftType === "opening")) return "opening";
  if (row.schedule_windows.some((window) => window.shiftType === "closing")) return "closing";
  return "regular";
}

function overlapsNow(start: string, end: string, minutes: number): boolean {
  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return minutes >= startMinutes && minutes < endMinutes;
}

export function getTimelineStatus(
  row: DailyScheduleStaffRow,
  date: string,
  now: Date | null = new Date()
): Exclude<TimelineStatusFilter, "all"> {
  if (getShiftGroup(row) === "off") return "off";
  if (!now) return "scheduled";
  if (date !== now.toISOString().split("T")[0]) return "scheduled";

  const minutes = now.getHours() * 60 + now.getMinutes();
  const onShift = row.schedule_windows.some((window) =>
    overlapsNow(window.startTime, window.endTime, minutes)
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
    const shiftMatches = params.filters.shift === "all" || getShiftGroup(row) === params.filters.shift;
    const status = getTimelineStatus(row, params.date, params.now);
    const statusMatches = params.filters.status === "all" || status === params.filters.status;
    return groupMatches && queryMatches && shiftMatches && statusMatches;
  });
}
