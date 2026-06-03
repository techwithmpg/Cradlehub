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

  const toMins = (t: string) => {
    const p = t.slice(0, 5).split(":");
    return parseInt(p[0] ?? "0", 10) * 60 + parseInt(p[1] ?? "0", 10);
  };
  const isOvernight = start && end && toMins(end) <= toMins(start);
  return isOvernight
    ? `${startLabel} – ${endLabel} (+1)`
    : `${startLabel} – ${endLabel}`;
}
