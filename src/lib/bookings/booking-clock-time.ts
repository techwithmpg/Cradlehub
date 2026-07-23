import { BRANCH_TIMEZONE, getBranchTime } from "@/lib/engine/slot-time";

export type ParsedBookingTime = {
  canonicalTime: string;
  displayTime: string;
  minutesIntoDay: number;
};

export type BookingTimeParseResult =
  | { ok: true; value: ParsedBookingTime }
  | { ok: false; error: string };

const TIME_ERROR = "The selected time could not be understood. Choose the time again.";

function formatDisplayTime(hours: number, minutes: number): string {
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function parseBookingTime(input: string): BookingTimeParseResult {
  const value = input.trim();
  if (!value) return { ok: false, error: TIME_ERROR };

  const twelveHour = /^(\d{1,2}):(\d{2})\s*([ap]m)$/i.exec(value);
  const twentyFourHour = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);

  let hours: number;
  let minutes: number;
  let seconds = 0;

  if (twelveHour) {
    const rawHours = Number(twelveHour[1]);
    minutes = Number(twelveHour[2]);
    const period = twelveHour[3]!.toLowerCase();

    if (!Number.isInteger(rawHours) || rawHours < 1 || rawHours > 12) {
      return { ok: false, error: TIME_ERROR };
    }
    hours = (rawHours % 12) + (period === "pm" ? 12 : 0);
  } else if (twentyFourHour) {
    hours = Number(twentyFourHour[1]);
    minutes = Number(twentyFourHour[2]);
    seconds = Number(twentyFourHour[3] ?? "0");

    if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
      return { ok: false, error: TIME_ERROR };
    }
  } else {
    return { ok: false, error: TIME_ERROR };
  }

  if (
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59 ||
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > 59
  ) {
    return { ok: false, error: TIME_ERROR };
  }

  return {
    ok: true,
    value: {
      canonicalTime: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      displayTime: formatDisplayTime(hours, minutes),
      minutesIntoDay: hours * 60 + minutes,
    },
  };
}

export function getBranchWalkInDefaults(
  now: Date = new Date(),
  intervalMinutes = 15
): { date: string; time: string } {
  const branchTime = getBranchTime(now, BRANCH_TIMEZONE);
  const interval = Math.max(1, Math.floor(intervalMinutes));
  const roundedMinutes = Math.min(
    23 * 60 + 45,
    Math.ceil(branchTime.minutesIntoDay / interval) * interval
  );
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  return {
    date: branchTime.ymd,
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`,
  };
}
