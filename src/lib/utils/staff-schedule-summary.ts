import { formatTime12h } from "./time-format";

export type ShiftType = "single" | "opening" | "closing";

type Schedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type?: string;
};

function sameTime(a: string, b: string): boolean {
  return a.slice(0, 5) === b.slice(0, 5);
}

export const SHIFT_LABELS: Record<string, string> = {
  single:  "Regular",
  opening: "Opening",
  closing: "Closing",
};

export function summarizeWeeklyHours(schedules: Schedule[]): string {
  const active = schedules.filter((s) => s.is_active);
  if (active.length === 0) return "Not scheduled";

  // Group by day_of_week so we can detect multi-shift days.
  const byDay = new Map<number, Schedule[]>();
  for (const s of active) {
    const list = byDay.get(s.day_of_week) ?? [];
    list.push(s);
    byDay.set(s.day_of_week, list);
  }

  const activeDays = byDay.size;

  // If any day has multiple shift rows, summarise simply.
  const hasMultiShift = Array.from(byDay.values()).some((rows) => rows.length > 1);
  if (hasMultiShift) {
    return `Opening / Closing (${activeDays} day${activeDays !== 1 ? "s" : ""})`;
  }

  // Single-shift-per-day path — preserve original summary logic.
  const firstPerDay = Array.from(byDay.values()).map((rows) => rows[0]!);

  // All 7 days same schedule
  if (firstPerDay.length === 7) {
    const first = firstPerDay[0]!;
    const allSame = firstPerDay.every(
      (s) =>
        sameTime(s.start_time, first.start_time) &&
        sameTime(s.end_time, first.end_time)
    );
    if (allSame) {
      return `${formatTime12h(first.start_time)} – ${formatTime12h(first.end_time)} daily`;
    }
  }

  // Weekdays Mon–Fri same
  const weekdays = firstPerDay.filter((s) => s.day_of_week >= 1 && s.day_of_week <= 5);
  const weekends = firstPerDay.filter((s) => s.day_of_week === 0 || s.day_of_week === 6);

  if (weekdays.length === 5 && weekends.length === 0) {
    const wd = weekdays[0]!;
    const allWeekdaysSame = weekdays.every(
      (s) => sameTime(s.start_time, wd.start_time) && sameTime(s.end_time, wd.end_time)
    );
    if (allWeekdaysSame) {
      return `Weekdays · ${formatTime12h(wd.start_time)} – ${formatTime12h(wd.end_time)}`;
    }
  }

  // Weekends only
  if (weekends.length > 0 && weekdays.length === 0) {
    const we = weekends[0]!;
    const allWeekendsSame = weekends.every(
      (s) => sameTime(s.start_time, we.start_time) && sameTime(s.end_time, we.end_time)
    );
    if (allWeekendsSame) {
      return `Weekends · ${formatTime12h(we.start_time)} – ${formatTime12h(we.end_time)}`;
    }
  }

  // Custom: all active days same
  if (firstPerDay.length > 0) {
    const first = firstPerDay[0]!;
    const allActiveSame = firstPerDay.every(
      (s) =>
        sameTime(s.start_time, first.start_time) &&
        sameTime(s.end_time, first.end_time)
    );
    if (allActiveSame) {
      return `${formatTime12h(first.start_time)} – ${formatTime12h(first.end_time)} (${activeDays} days)`;
    }
  }

  return `Custom hours (${activeDays} days)`;
}

export function isScheduled(schedules: Schedule[]): boolean {
  return schedules.some((s) => s.is_active);
}

/** Returns the primary/first shift_type for a staff on a given day (0-6). */
export function getPrimaryShiftForDay(
  schedules: Schedule[],
  dayOfWeek: number
): ShiftType {
  const daySchedules = schedules
    .filter((s) => s.is_active && s.day_of_week === dayOfWeek)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // If multiple shifts, return 'opening' if present, else 'closing', else 'single'.
  const shiftTypes = daySchedules.map((s) => s.shift_type ?? "single");
  if (shiftTypes.includes("opening")) return "opening";
  if (shiftTypes.includes("closing")) return "closing";
  if (shiftTypes.includes("single")) return "single";
  return "single";
}
