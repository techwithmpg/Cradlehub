export function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns true when the slot start datetime is now or in the past.
 * timezone is optional for API compatibility; current app uses local business time.
 */
export function isPastSlot(params: {
  selectedDate: string;
  slotStartTime: string;
  now?: Date;
  timezone?: string;
}): boolean {
  const { selectedDate, slotStartTime, now = new Date() } = params;
  const [yRaw = "", mRaw = "", dRaw = ""] = selectedDate.split("-");
  const [hhRaw = "", mmRaw = "", ssRaw = "0"] = slotStartTime.split(":");
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  const ss = Number(ssRaw);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return false;

  const slotStart = new Date(y, m - 1, d, hh, mm, ss, 0);
  return slotStart.getTime() <= now.getTime();
}

export function filterPastSlotsForDate<T extends { slot_time: string }>(params: {
  selectedDate: string;
  slots: T[];
  now?: Date;
}): T[] {
  const { selectedDate, slots, now = new Date() } = params;
  const today = toLocalYmd(now);

  if (selectedDate < today) return [];
  if (selectedDate > today) return slots;

  return slots.filter(
    (slot) =>
      !isPastSlot({
        selectedDate,
        slotStartTime: slot.slot_time,
        now,
      })
  );
}

// HH:MM or HH:MM:SS → total minutes
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export function doesSlotFitWithinWorkingHours(params: {
  slotStartTime: string;
  serviceDurationMinutes: number;
  workEndTime: string;
}): boolean {
  const slotStart = timeToMinutes(params.slotStartTime);
  const slotEnd = slotStart + params.serviceDurationMinutes;
  const workEnd = timeToMinutes(params.workEndTime);
  return slotEnd <= workEnd;
}
