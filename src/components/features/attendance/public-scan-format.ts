const DEFAULT_ATTENDANCE_TIME_ZONE = "Asia/Manila";

export function formatAttendanceTime(value?: string, timeZone = DEFAULT_ATTENDANCE_TIME_ZONE): string {
  if (!value) return "--:--";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

export function formatAttendanceDate(value?: string, timeZone = DEFAULT_ATTENDANCE_TIME_ZONE): string {
  if (!value) return "Today";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Today";

  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
}

export function formatShiftLabel(value?: string): string {
  if (!value) return "Scheduled Shift";

  const normalized = value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return /shift$/i.test(normalized) ? normalized : `${normalized} Shift`;
}

export function formatWorkedMinutes(minutes?: number): string {
  if (!minutes || minutes <= 0) return "0m";

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}
