import { summarizeWeeklyHours } from "@/lib/utils/staff-schedule-summary";
import type {
  EditAvailabilityStaffItem,
  WeeklyAvailabilityRow,
} from "./edit-availability-types";

export const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function normalizeTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "09:00";
}

export function buildWeeklyRows(
  item: EditAvailabilityStaffItem
): WeeklyAvailabilityRow[] {
  return WEEK_DAYS.map((_, dayOfWeek) => {
    const daySchedules = item.schedules.filter(
      (schedule) => schedule.day_of_week === dayOfWeek
    );
    const activeSchedules = daySchedules
      .filter((schedule) => schedule.is_active)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const regularSchedule =
      daySchedules.find((schedule) => (schedule.shift_type ?? "single") === "single") ??
      activeSchedules[0] ??
      daySchedules[0];
    const earliestActive = activeSchedules[0];
    const latestActive = activeSchedules.at(-1);

    return {
      dayOfWeek,
      isActive: activeSchedules.length > 0,
      startTime: normalizeTime(earliestActive?.start_time ?? regularSchedule?.start_time),
      endTime: normalizeTime(latestActive?.end_time ?? regularSchedule?.end_time ?? "18:00"),
    };
  });
}

export function getWeeklySummary(item: EditAvailabilityStaffItem): string {
  return summarizeWeeklyHours(item.schedules);
}

export function getStatusLabel(item: EditAvailabilityStaffItem): string {
  if (!item.staff.is_active) return "Inactive";
  return item.schedules.some((schedule) => schedule.is_active)
    ? "Scheduled"
    : "Not scheduled";
}

export function countWeeklyChanges(
  baseline: WeeklyAvailabilityRow[],
  draft: WeeklyAvailabilityRow[]
): number {
  return draft.reduce((count, row, index) => {
    const original = baseline[index];
    if (!original) return count + 1;
    return original.isActive !== row.isActive ||
      original.startTime !== row.startTime ||
      original.endTime !== row.endTime
      ? count + 1
      : count;
  }, 0);
}
