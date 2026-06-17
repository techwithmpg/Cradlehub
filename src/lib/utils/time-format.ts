/**
 * Formats a 24-hour time string (HH:mm or HH:mm:ss) to 12-hour format.
 * Returns "—" for null, undefined, or unparseable values.
 *
 * Examples:
 *   "09:00:00" → "9:00 AM"
 *   "14:30:00" → "2:30 PM"
 *   "22:30"    → "10:30 PM"
 */
export function formatTime12h(time: string | null | undefined): string {
  if (!time) return "—";
  const parts = time.slice(0, 5).split(":");
  if (parts.length < 2) return "—";
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (isNaN(h) || isNaN(m)) return "—";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.slice(0, 5).split(":");
  if (parts.length < 2) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function getShiftDurationMinutes(
  start: string | null | undefined,
  end: string | null | undefined
): number | null {
  const startMinutes = timeToMinutes(start);
  let endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

export function isValidShiftRange(
  start: string | null | undefined,
  end: string | null | undefined,
  maxMinutes = 16 * 60
): boolean {
  const duration = getShiftDurationMinutes(start, end);
  return duration !== null && duration > 0 && duration <= maxMinutes;
}

export function isOvernightTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): boolean {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes;
}

/**
 * Formats a shift time range as "H:MM AM – H:MM PM".
 * When the end time is earlier than the start time (overnight shift),
 * appends " (+1)" to indicate the end falls on the next day.
 *
 * Examples:
 *   "10:00", "19:00"  → "10:00 AM – 7:00 PM"
 *   "17:00", "01:30"  → "5:00 PM – 1:30 AM (+1)"
 */
export function formatShiftTimeRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  const startLabel = formatTime12h(start);
  const endLabel   = formatTime12h(end);
  if (startLabel === "—" || endLabel === "—") return `${startLabel} – ${endLabel}`;

  return isOvernightTimeRange(start, end)
    ? `${startLabel} – ${endLabel} (+1)`
    : `${startLabel} – ${endLabel}`;
}
