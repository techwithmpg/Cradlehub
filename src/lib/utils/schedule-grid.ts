export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 21;
export const SLOT_MINUTES = 30;
export const SLOT_HEIGHT = 48;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((v) => Number(v));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToSlotIndex(minutes: number): number {
  return (minutes - GRID_START_HOUR * 60) / SLOT_MINUTES;
}

export function getEventTopOffset(startTime: string): number {
  const minutes = timeToMinutes(startTime);
  const slotIndex = minutesToSlotIndex(minutes);
  return slotIndex * SLOT_HEIGHT;
}

export function getEventHeight(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const durationMinutes = endMinutes - startMinutes;
  return (durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT;
}

export function formatScheduleTime(time: string): string {
  const [h, m] = time.split(":").map((v) => Number(v));
  const hour = h ?? 0;
  const minute = m ?? 0;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

export function isWithinWorkHours(
  time: string,
  workStart: string | null,
  workEnd: string | null
): boolean {
  if (!workStart || !workEnd) return false;
  const minutes = timeToMinutes(time);
  return minutes >= timeToMinutes(workStart) && minutes < timeToMinutes(workEnd);
}
