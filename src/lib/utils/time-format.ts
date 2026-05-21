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
