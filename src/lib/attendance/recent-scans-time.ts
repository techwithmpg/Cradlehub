import { addDaysToYmd } from "@/lib/engine/slot-time";

export function attendanceDateBoundaryIso(
  date: string,
  timezone: string,
  dayOffset = 0
): string {
  const shiftedDate = addDaysToYmd(date, dayOffset);
  const [year, month, day] = shiftedDate.split("-").map(Number);
  const desiredWallTime = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let utcGuess = desiredWallTime;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(utcGuess));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const actualWallTime = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second")
    );
    const correction = desiredWallTime - actualWallTime;
    utcGuess += correction;
    if (correction === 0) break;
  }

  return new Date(utcGuess).toISOString();
}
