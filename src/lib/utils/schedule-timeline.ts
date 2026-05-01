export const TIMELINE_START_HOUR = 8;
export const TIMELINE_END_HOUR = 21;
export const SLOT_MINUTES = 30;
export const SLOT_WIDTH_PX = 96;
export const STAFF_CELL_WIDTH_PX = 200;
export const ROW_HEIGHT_PX = 84;
export const HEADER_HEIGHT_PX = 44;

export type TimeRange = {
  startTime: string;
  endTime: string;
};

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":") .map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function getDurationMinutes(range: TimeRange): number {
  return timeToMinutes(range.endTime) - timeToMinutes(range.startTime);
}

export function getTimelineTotalMinutes(): number {
  return (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
}

export function getTimelineTotalWidthPx(): number {
  const totalMinutes = getTimelineTotalMinutes();
  return (totalMinutes / SLOT_MINUTES) * SLOT_WIDTH_PX;
}

export function getTimelineOffsetPx(time: string): number {
  const mins = timeToMinutes(time);
  const startMins = TIMELINE_START_HOUR * 60;
  const offsetMins = Math.max(0, mins - startMins);
  return (offsetMins / SLOT_MINUTES) * SLOT_WIDTH_PX;
}

export function getTimelineWidthPx(startTime: string, endTime: string): number {
  const duration = getDurationMinutes({ startTime, endTime });
  return (duration / SLOT_MINUTES) * SLOT_WIDTH_PX;
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
  const [h, m] = time.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const displayHour = (h ?? 0) > 12 ? (h ?? 0) - 12 : (h ?? 0) === 0 ? 12 : (h ?? 0);
  return `${displayHour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

export function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = TIMELINE_START_HOUR; h < TIMELINE_END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  slots.push(`${String(TIMELINE_END_HOUR).padStart(2, "0")}:00`);
  return slots;
}

export function getCurrentTimePx(): number | null {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  if (hours < TIMELINE_START_HOUR || hours > TIMELINE_END_HOUR) return null;
  const totalMins = hours * 60 + minutes;
  const startMins = TIMELINE_START_HOUR * 60;
  return ((totalMins - startMins) / SLOT_MINUTES) * SLOT_WIDTH_PX;
}

export function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return dateStr === today;
}
