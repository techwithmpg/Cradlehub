type Schedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shortTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const displayHour = (h ?? 0) > 12 ? (h ?? 0) - 12 : (h ?? 0) === 0 ? 12 : (h ?? 0);
  return `${displayHour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function sameTime(a: string, b: string): boolean {
  return a.slice(0, 5) === b.slice(0, 5);
}

export function summarizeWeeklyHours(schedules: Schedule[]): string {
  const active = schedules.filter((s) => s.is_active);
  if (active.length === 0) return "Not scheduled";

  // Check if all 7 days have the same schedule
  const first = active[0]!;
  const allSame =
    active.length === 7 &&
    active.every(
      (s) =>
        sameTime(s.start_time, first.start_time) &&
        sameTime(s.end_time, first.end_time)
    );

  if (allSame) {
    return `${shortTime(first.start_time)} – ${shortTime(first.end_time)} daily`;
  }

  // Check weekdays (Mon-Fri = 1-5) same, weekends off
  const weekdays = active.filter((s) => s.day_of_week >= 1 && s.day_of_week <= 5);
  const weekends = active.filter((s) => s.day_of_week === 0 || s.day_of_week === 6);

  if (weekdays.length === 5 && weekends.length === 0) {
    const wd = weekdays[0]!;
    const allWeekdaysSame = weekdays.every(
      (s) => sameTime(s.start_time, wd.start_time) && sameTime(s.end_time, wd.end_time)
    );
    if (allWeekdaysSame) {
      return `Weekdays · ${shortTime(wd.start_time)} – ${shortTime(wd.end_time)}`;
    }
  }

  // Check weekends only
  if (weekends.length > 0 && weekdays.length === 0) {
    const we = weekends[0]!;
    const allWeekendsSame = weekends.every(
      (s) => sameTime(s.start_time, we.start_time) && sameTime(s.end_time, we.end_time)
    );
    if (allWeekendsSame) {
      return `Weekends · ${shortTime(we.start_time)} – ${shortTime(we.end_time)}`;
    }
  }

  // Custom: list active days
  const firstS = active[0]!;
  const allActiveSame = active.every(
    (s) =>
      sameTime(s.start_time, firstS.start_time) &&
      sameTime(s.end_time, firstS.end_time)
  );

  if (allActiveSame) {
    return `${shortTime(firstS.start_time)} – ${shortTime(firstS.end_time)} (${active.length} days)`;
  }

  return `Custom hours (${active.length} days)`;
}

export function isScheduled(schedules: Schedule[]): boolean {
  return schedules.some((s) => s.is_active);
}
