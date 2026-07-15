import { timeToMinutes } from "@/lib/utils/time-format";

const DAY_MINUTES = 24 * 60;

export type ScheduleCoverageWindow = {
  startTime: string;
  endTime: string;
  endsNextDay?: boolean | null;
};

export type ScheduleCoverageRange = {
  start: number;
  end: number;
};

export function getScheduleWindowAbsoluteRange(
  window: ScheduleCoverageWindow
): ScheduleCoverageRange | null {
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (start === null || end === null || start === end) return null;

  const crossesMidnight = window.endsNextDay ?? end <= start;
  const absoluteEnd = crossesMidnight ? end + DAY_MINUTES : end;
  if (absoluteEnd <= start) return null;
  return { start, end: absoluteEnd };
}

export function mergeScheduleCoverageRanges(
  windows: ScheduleCoverageWindow[]
): ScheduleCoverageRange[] {
  const sorted = windows
    .map(getScheduleWindowAbsoluteRange)
    .filter((range): range is ScheduleCoverageRange => range !== null)
    .sort((first, second) => first.start - second.start || first.end - second.end);

  const merged: ScheduleCoverageRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      continue;
    }
    previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

export function getUniqueScheduleCoverageMinutes(windows: ScheduleCoverageWindow[]): number {
  return mergeScheduleCoverageRanges(windows).reduce(
    (total, range) => total + range.end - range.start,
    0
  );
}

export function doesDurationFitWithinScheduleWindows(params: {
  slotStartTime: string;
  durationMinutes: number;
  windows: ScheduleCoverageWindow[];
}): boolean {
  const rawStart = timeToMinutes(params.slotStartTime);
  if (rawStart === null || params.durationMinutes <= 0) return false;

  const ranges = mergeScheduleCoverageRanges(params.windows);
  return [rawStart, rawStart + DAY_MINUTES].some((slotStart) => {
    const slotEnd = slotStart + params.durationMinutes;
    return ranges.some((range) => slotStart >= range.start && slotEnd <= range.end);
  });
}
