/**
 * Pure date helpers for Week Mode.
 * No side effects. All functions are deterministic.
 */

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
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

/**
 * Get the Monday of the week containing the given date.
 * Input/output format: "YYYY-MM-DD"
 */
export function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0]!;
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
  const start = new Date(monday + "T00:00:00");
  const end = new Date(sunday + "T00:00:00");

  const startMonth = start.toLocaleDateString("en-PH", { month: "short" });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString("en-PH", { month: "short" });
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

/**
 * Format a single date for card display: "Mon" + "May 19"
 */
export function formatDayCard(dateStr: string): { dayName: string; dateLabel: string } {
  const d = new Date(dateStr + "T00:00:00");
  const dayName = d.toLocaleDateString("en-PH", { weekday: "short" });
  const dateLabel = d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  return { dayName, dateLabel };
}

/**
 * Format a date for the preview title: "Tuesday, May 20, 2026"
 */
export function formatPreviewTitle(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-PH", {
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
  const today = new Date().toISOString().split("T")[0]!;
  return dateStr === today;
}
