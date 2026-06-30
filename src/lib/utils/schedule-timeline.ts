import type { ScheduleDensity } from "@/components/features/schedule/schedule-density";
import type { DailyScheduleStaffRow } from "@/lib/queries/schedule";

export const DEFAULT_TIMELINE_START_HOUR = 8;
export const DEFAULT_TIMELINE_END_HOUR = 23;
export const TIMELINE_START_HOUR = DEFAULT_TIMELINE_START_HOUR;
export const TIMELINE_END_HOUR = DEFAULT_TIMELINE_END_HOUR;
export const SLOT_MINUTES = 30;
export const SLOT_WIDTH_PX = 96;
export const STAFF_CELL_WIDTH_PX = 200;
export const STAFF_CELL_WIDTH_FIT_PX = 220;
export const STAFF_CELL_WIDTH_EXPANDED_PX = 240;
export const EXPANDED_HOUR_WIDTH_PX = 96;
export const ROW_HEIGHT_PX = 84;
export const HEADER_HEIGHT_PX = 44;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// ── Density-aware helpers ────────────────────────────────────────────────────

export function getRowHeightPx(density: ScheduleDensity = "compact"): number {
  switch (density) {
    case "comfortable": return 76;
    case "compact": return 56;
    case "ultra-compact": return 42;
    default: return 56;
  }
}

export function getHeaderHeightPx(density: ScheduleDensity = "compact"): number {
  switch (density) {
    case "comfortable": return 48;
    case "compact": return 40;
    case "ultra-compact": return 32;
    default: return 40;
  }
}

export type TimeRange = {
  startTime: string;
  endTime: string;
};

export type TimelineDisplayMode = "fit" | "expanded";

export type TimelineRange = {
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  totalMinutes: number;
  hourCount: number;
};

export type TimelineHourMark = {
  minutes: number;
  label: string;
  isBoundary: boolean;
};

export type TimelineLaneEvent = {
  id: string;
  start_time: string;
  end_time: string;
};

export type TimelineLaneAssignment = {
  lane: number;
  laneCount: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseScheduleTime(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hourPart, minutePart = "0"] = time.split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return clamp(hours * MINUTES_PER_HOUR + minutes, 0, MINUTES_PER_DAY);
}

function minutesToTime(minutes: number): string {
  const clamped = clamp(Math.round(minutes), 0, MINUTES_PER_DAY);
  const hours = Math.floor(clamped / MINUTES_PER_HOUR);
  const mins = clamped % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function createTimelineRange(startMinutes: number, endMinutes: number): TimelineRange {
  const safeStart = clamp(Math.floor(startMinutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR, 0, MINUTES_PER_DAY - MINUTES_PER_HOUR);
  let safeEnd = clamp(Math.ceil(endMinutes / SLOT_MINUTES) * SLOT_MINUTES, safeStart + SLOT_MINUTES, MINUTES_PER_DAY);

  if (safeEnd <= safeStart) {
    safeEnd = Math.min(safeStart + SLOT_MINUTES, MINUTES_PER_DAY);
  }

  const totalMinutes = safeEnd - safeStart;
  return {
    startMinutes: safeStart,
    endMinutes: safeEnd,
    startTime: minutesToTime(safeStart),
    endTime: minutesToTime(safeEnd),
    totalMinutes,
    hourCount: Math.max(1, Math.ceil(totalMinutes / MINUTES_PER_HOUR)),
  };
}

export function getDefaultTimelineRange(): TimelineRange {
  return createTimelineRange(
    DEFAULT_TIMELINE_START_HOUR * MINUTES_PER_HOUR,
    DEFAULT_TIMELINE_END_HOUR * MINUTES_PER_HOUR
  );
}

export function timeToMinutes(time: string): number {
  return parseScheduleTime(time) ?? 0;
}

export function getDurationMinutes(range: TimeRange): number {
  return timeToMinutes(range.endTime) - timeToMinutes(range.startTime);
}

export function buildTimelineRange(staffRows: DailyScheduleStaffRow[]): TimelineRange {
  const points: number[] = [];

  const addRange = (startTime: string | null | undefined, endTime: string | null | undefined) => {
    const start = parseScheduleTime(startTime);
    const end = parseScheduleTime(endTime);
    if (start === null || end === null || end <= start) return;
    points.push(start, end);
  };

  for (const staff of staffRows) {
    addRange(staff.work_start, staff.work_end);

    if (staff.current_override && !staff.current_override.is_day_off) {
      addRange(staff.current_override.start_time, staff.current_override.end_time);
    }

    for (const booking of staff.bookings) {
      addRange(booking.start_time, booking.end_time);
    }

    for (const block of staff.blocks) {
      addRange(block.start_time, block.end_time);
    }
  }

  if (points.length === 0) {
    return getDefaultTimelineRange();
  }

  return createTimelineRange(Math.min(...points), Math.max(...points));
}

export function formatMinutesAsScheduleTime(minutes: number): string {
  const clamped = clamp(Math.round(minutes), 0, MINUTES_PER_DAY);
  const dayMinute = clamped === MINUTES_PER_DAY ? 0 : clamped;
  const hours = Math.floor(dayMinute / MINUTES_PER_HOUR);
  const mins = dayMinute % MINUTES_PER_HOUR;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(mins).padStart(2, "0")} ${period}`;
}

export function getTimelineHourMarks(range: TimelineRange): TimelineHourMark[] {
  const marks: TimelineHourMark[] = [];

  for (let minutes = range.startMinutes; minutes <= range.endMinutes; minutes += MINUTES_PER_HOUR) {
    marks.push({
      minutes,
      label: formatMinutesAsScheduleTime(minutes),
      isBoundary: minutes === range.startMinutes || minutes === range.endMinutes,
    });
  }

  const lastMark = marks[marks.length - 1];
  if (!lastMark || lastMark.minutes !== range.endMinutes) {
    marks.push({
      minutes: range.endMinutes,
      label: formatMinutesAsScheduleTime(range.endMinutes),
      isBoundary: true,
    });
  }

  return marks;
}

export function getTimelineOffsetPercent(time: string, range: TimelineRange): number {
  const minutes = parseScheduleTime(time);
  if (minutes === null || range.totalMinutes <= 0) return 0;
  return clamp(((minutes - range.startMinutes) / range.totalMinutes) * 100, 0, 100);
}

export function getTimelineWidthPercent(startTime: string, endTime: string, range: TimelineRange): number {
  const start = parseScheduleTime(startTime);
  const end = parseScheduleTime(endTime);
  if (start === null || end === null || range.totalMinutes <= 0) return 0;
  const clampedStart = clamp(start, range.startMinutes, range.endMinutes);
  const clampedEnd = clamp(end, range.startMinutes, range.endMinutes);
  return Math.max(0, ((clampedEnd - clampedStart) / range.totalMinutes) * 100);
}

export function getTimelineBlockPercent(
  startTime: string,
  endTime: string,
  range: TimelineRange
): { leftPercent: number; widthPercent: number } {
  return {
    leftPercent: getTimelineOffsetPercent(startTime, range),
    widthPercent: getTimelineWidthPercent(startTime, endTime, range),
  };
}

export function assignTimelineLanes<T extends TimelineLaneEvent>(
  events: T[]
): Map<string, TimelineLaneAssignment> {
  const sorted = [...events].sort((a, b) => {
    const startDiff = timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
    if (startDiff !== 0) return startDiff;
    return timeToMinutes(b.end_time) - timeToMinutes(a.end_time);
  });
  const active: Array<{ id: string; end: number; lane: number }> = [];
  const assignments = new Map<string, TimelineLaneAssignment>();
  let maxLane = 0;

  for (const event of sorted) {
    const start = timeToMinutes(event.start_time);
    const end = Math.max(start + 1, timeToMinutes(event.end_time));

    for (let index = active.length - 1; index >= 0; index--) {
      if (active[index]!.end <= start) {
        active.splice(index, 1);
      }
    }

    const used = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (used.has(lane)) lane++;

    active.push({ id: event.id, end, lane });
    maxLane = Math.max(maxLane, lane + 1);
    for (const item of active) {
      assignments.set(item.id, {
        lane: item.lane,
        laneCount: Math.max(maxLane, active.length),
      });
    }
  }

  for (const assignment of assignments.values()) {
    assignment.laneCount = maxLane;
  }

  return assignments;
}

export function getCurrentTimePercent(range: TimelineRange): number | null {
  const now = new Date();
  const totalMins = now.getHours() * MINUTES_PER_HOUR + now.getMinutes();
  if (totalMins < range.startMinutes || totalMins > range.endMinutes) return null;
  return clamp(((totalMins - range.startMinutes) / range.totalMinutes) * 100, 0, 100);
}

export function getTimelineTotalMinutes(range: TimelineRange = getDefaultTimelineRange()): number {
  return range.totalMinutes;
}

export function getTimelineTotalWidthPx(range: TimelineRange = getDefaultTimelineRange()): number {
  const totalMinutes = getTimelineTotalMinutes(range);
  return (totalMinutes / SLOT_MINUTES) * SLOT_WIDTH_PX;
}

export function getTimelineOffsetPx(time: string, range: TimelineRange = getDefaultTimelineRange()): number {
  const mins = timeToMinutes(time);
  const startMins = range.startMinutes;
  const offsetMins = Math.max(0, mins - startMins);
  return (offsetMins / SLOT_MINUTES) * SLOT_WIDTH_PX;
}

export function getTimelineWidthPx(startTime: string, endTime: string, range: TimelineRange = getDefaultTimelineRange()): number {
  const widthPercent = getTimelineWidthPercent(startTime, endTime, range);
  return (widthPercent / 100) * getTimelineTotalWidthPx(range);
}

export function isOutsideWorkingHours(params: {
  time: string;
  workStart: string | null;
  workEnd: string | null;
}): boolean {
  const { time, workStart, workEnd } = params;
  if (!workStart || !workEnd) return true;
  const t = timeToMinutes(time);
  return t < timeToMinutes(workStart) || t >= timeToMinutes(workEnd);
}

export function formatScheduleTime(time: string): string {
  return formatMinutesAsScheduleTime(timeToMinutes(time));
}

export function getTimeSlots(range: TimelineRange = getDefaultTimelineRange()): string[] {
  const slots: string[] = [];
  for (let mins = range.startMinutes; mins < range.endMinutes; mins += SLOT_MINUTES) {
    slots.push(minutesToTime(mins));
  }
  slots.push(range.endTime);
  return slots;
}

export function getCurrentTimePx(range: TimelineRange = getDefaultTimelineRange()): number | null {
  const percent = getCurrentTimePercent(range);
  if (percent === null) return null;
  return (percent / 100) * getTimelineTotalWidthPx(range);
}

export function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
}
