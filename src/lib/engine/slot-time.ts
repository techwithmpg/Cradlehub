/**
 * IANA timezone for the branch. Used to compare slot times against the current
 * branch-local time rather than the server's local timezone (which is typically
 * UTC in cloud deployments).
 *
 * Kept here as the canonical constant so availability.ts, the server actions,
 * and future per-branch timezone lookups all share a single source of truth.
 */
export const BRANCH_TIMEZONE = "Asia/Manila";

export function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns the current date (YYYY-MM-DD) and minutes-into-day expressed in the
 * given IANA timezone using the platform's Intl API (Node 12+ / all modern
 * browsers). Falls back to server local time if the timezone is invalid.
 *
 * This is the correct way to compare slot times against "now" when the server
 * runs in UTC but the branch business operates in a different timezone.
 */
function getBranchTime(
  now: Date,
  timezone: string
): { ymd: string; minutesIntoDay: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "00";

    // Some locales return "24" for midnight with hour12:false — normalise it.
    const h = parseInt(get("hour"), 10) % 24;
    const m = parseInt(get("minute"), 10);
    const s = parseInt(get("second"), 10);
    const year = get("year");
    const month = get("month");
    const day = get("day");

    return {
      ymd: `${year}-${month}-${day}`,
      minutesIntoDay: h * 60 + m + s / 60,
    };
  } catch {
    // Fallback: use server local time if the timezone string is invalid.
    return {
      ymd: toLocalYmd(now),
      minutesIntoDay:
        now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60,
    };
  }
}

/**
 * Returns true when the slot start datetime is now or in the past.
 *
 * Pass `timezone` (e.g. "Asia/Manila") so the comparison uses branch-local
 * time rather than the server's OS timezone. Without it the legacy path
 * (server local time via Date constructor) is used — preserved for existing
 * tests that fix the clock via `new Date(y, m, d, hh, mm)`.
 */
export function isPastSlot(params: {
  selectedDate: string;
  slotStartTime: string;
  now?: Date;
  timezone?: string;
}): boolean {
  const { selectedDate, slotStartTime, now = new Date(), timezone } = params;

  if (timezone) {
    const { ymd: branchYmd, minutesIntoDay: nowMinutes } = getBranchTime(
      now,
      timezone
    );
    // Past date in branch timezone → always past.
    if (selectedDate < branchYmd) return true;
    // Future date in branch timezone → never past.
    if (selectedDate > branchYmd) return false;
    // Same day: compare slot start minutes against current branch minutes.
    const slotMinutes = timeToMinutes(slotStartTime);
    return slotMinutes <= nowMinutes;
  }

  // ── Legacy path (no timezone provided) ──────────────────────────────────
  // Builds the slot start datetime using the server's local timezone.
  // Kept for backward compatibility with existing tests that pass a fixed
  // `new Date(y, m-1, d, hh, mm)` as `now`.
  const [yRaw = "", mRaw = "", dRaw = ""] = selectedDate.split("-");
  const [hhRaw = "", mmRaw = "", ssRaw = "0"] = slotStartTime.split(":");
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  const ss = Number(ssRaw);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
    return false;
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss))
    return false;

  const slotStart = new Date(y, m - 1, d, hh, mm, ss, 0);
  return slotStart.getTime() <= now.getTime();
}

/**
 * Filters a slot list for a given selected date:
 *  - Past date  → returns []
 *  - Future date → returns slots unchanged
 *  - Today       → removes slots whose start time has already passed
 *
 * Pass `timezone` (IANA, e.g. "Asia/Manila") so "today" and "past" are
 * evaluated in branch-local time. Without it, the server's OS timezone is
 * used (legacy behaviour, still correct when server and branch share a TZ).
 */
export function filterPastSlotsForDate<T extends { slot_time: string }>(params: {
  selectedDate: string;
  slots: T[];
  now?: Date;
  timezone?: string;
}): T[] {
  const { selectedDate, slots, now = new Date(), timezone } = params;

  if (timezone) {
    const { ymd: branchYmd } = getBranchTime(now, timezone);
    if (selectedDate < branchYmd) return [];
    if (selectedDate > branchYmd) return slots;
    return slots.filter(
      (slot) =>
        !isPastSlot({
          selectedDate,
          slotStartTime: slot.slot_time,
          now,
          timezone,
        })
    );
  }

  // ── Legacy path ──────────────────────────────────────────────────────────
  const today = toLocalYmd(now);
  if (selectedDate < today) return [];
  if (selectedDate > today) return slots;
  return slots.filter(
    (slot) =>
      !isPastSlot({ selectedDate, slotStartTime: slot.slot_time, now })
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
