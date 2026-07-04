/**
 * Pure date helpers for Week Mode.
 * No side effects. All functions are deterministic.
 */
import {
  addDaysToYmd,
  formatBranchYmd,
  getBranchBusinessDate,
  getMondayOfWeekYmd,
} from "@/lib/engine/slot-time";

export type WeekRange = {
  monday: string;
  sunday: string;
  days: string[]; // 7 ISO dates: monday..sunday
};

/**
 * Shift a date string by N days.
 * Input/output format: "YYYY-MM-DD"
 */
export function shiftDate(dateStr: string, days: number): string {
  return addDaysToYmd(dateStr, days);
}

/**
 * Get the Monday of the week containing the given date.
 * Input/output format: "YYYY-MM-DD"
 */
export function getMonday(dateStr: string): string {
  return getMondayOfWeekYmd(dateStr);
}

/**
 * Get the full Mon-Sun range for the week containing the given date.
 */
export function getWeekRange(dateStr: string): WeekRange {
  const monday = getMonday(dateStr);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(shiftDate(monday, i));
  }
  return {
    monday,
    sunday: days[6]!,
    days,
  };
}

/**
 * Format a week range for display: "May 19 – May 25, 2026"
 */
export function formatWeekRange(monday: string, sunday: string): string {
  const startMonth = formatBranchYmd(monday, { month: "short" });
  const startDay = Number(monday.slice(8, 10));
  const endMonth = formatBranchYmd(sunday, { month: "short" });
  const endDay = Number(sunday.slice(8, 10));
  const year = Number(sunday.slice(0, 4));

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

/**
 * Format a single date for card display: "Mon" + "May 19"
 */
export function formatDayCard(dateStr: string): { dayName: string; dateLabel: string } {
  const dayName = formatBranchYmd(dateStr, { weekday: "short" });
  const dateLabel = formatBranchYmd(dateStr, { month: "short", day: "numeric" });
  return { dayName, dateLabel };
}

/**
 * Format a date for the preview title: "Tuesday, May 20, 2026"
 */
export function formatPreviewTitle(dateStr: string): string {
  return formatBranchYmd(dateStr, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Check if a date string is today.
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getBranchBusinessDate();
}
