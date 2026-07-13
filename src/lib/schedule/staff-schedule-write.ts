import type { StaffScheduleShiftType } from "@/lib/schedule/resolve-staff-schedule";
import {
  canUseScheduleShiftType,
  type ScheduleShiftEligibilityStaff,
} from "@/lib/schedule/shift-eligibility";
import { isValidShiftRange, timeToMinutes } from "@/lib/utils/time-format";

export const STAFF_SCHEDULE_CONFLICT_TARGET = "staff_id,day_of_week,window_order";
export const MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY = 12;

export const STAFF_SCHEDULE_RETURNING_COLUMNS =
  "id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order, ends_next_day";

export type StaffScheduleUpsertRow = {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type: StaffScheduleShiftType;
  window_order: number;
  ends_next_day: boolean;
};

export type SavedStaffScheduleRow = StaffScheduleUpsertRow & {
  id: string;
};

export type StaffScheduleDayInput = {
  dayOfWeek: number;
  opening: boolean;
  closing: boolean;
  regular: boolean;
  dayOff: boolean;
  splitShift?: boolean;
};

export type StaffScheduleShiftTimes = {
  opening: { start: string; end: string };
  closing: { start: string; end: string };
  regular: { start: string; end: string };
};

export type StaffScheduleValidationResult =
  | { ok: true; rows: StaffScheduleUpsertRow[] }
  | { ok: false; error: string };

export type StaffSingleShiftWeeklyDayInput = {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
};

export type StaffScheduleWindowInput = {
  shiftType: StaffScheduleShiftType;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  order: number;
};

export type StaffScheduleWindowDayInput = {
  dayOfWeek: number;
  mode: "unconfigured" | "working" | "day_off";
  windows: StaffScheduleWindowInput[];
};

const SHIFT_FIELDS = ["opening", "closing", "regular"] as const;
type ShiftField = (typeof SHIFT_FIELDS)[number];

const DAY_OFF_START = "00:00";
const DAY_OFF_END = "00:01";

function shiftTypeForField(field: ShiftField): StaffScheduleShiftType {
  return field === "regular" ? "single" : field;
}

function activeShiftFields(day: StaffScheduleDayInput): ShiftField[] {
  return SHIFT_FIELDS.filter((field) => day[field]);
}

function endsNextDay(startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start !== null && end !== null && end <= start;
}

function absoluteRange(startTime: string, endTime: string): { start: number; end: number } | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || start === end) return null;

  return {
    start,
    end: end <= start ? end + 24 * 60 : end,
  };
}

function explicitAbsoluteRange(window: StaffScheduleWindowInput):
  | { ok: true; start: number; end: number }
  | { ok: false; error: string } {
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (start === null || end === null || start === end) {
    return { ok: false, error: "Schedule windows need valid non-zero start and end times." };
  }

  const absoluteEnd = window.endsNextDay ? end + 24 * 60 : end;
  if (!window.endsNextDay && end <= start) {
    return { ok: false, error: "Enable Ends next day when a window crosses midnight." };
  }
  if (absoluteEnd <= start) {
    return { ok: false, error: "Schedule windows need valid non-zero start and end times." };
  }
  if (absoluteEnd - start > 16 * 60) {
    return { ok: false, error: "Shift times must span 1 minute to 16 hours." };
  }

  return { ok: true, start, end: absoluteEnd };
}

function timeRangesOverlap(
  first: { start: string; end: string },
  second: { start: string; end: string }
): boolean {
  const firstRange = absoluteRange(first.start, first.end);
  const secondRange = absoluteRange(second.start, second.end);
  if (!firstRange || !secondRange) return true;

  return firstRange.start < secondRange.end && secondRange.start < firstRange.end;
}

function compareShiftEntries(
  a: { field: ShiftField; range: { start: string; end: string } },
  b: { field: ShiftField; range: { start: string; end: string } }
): number {
  const startDiff = (timeToMinutes(a.range.start) ?? 0) - (timeToMinutes(b.range.start) ?? 0);
  if (startDiff !== 0) return startDiff;
  return SHIFT_FIELDS.indexOf(a.field) - SHIFT_FIELDS.indexOf(b.field);
}

function activeShiftEntries(activeFields: ShiftField[], times: StaffScheduleShiftTimes) {
  return activeFields
    .map((field) => ({ field, range: times[field], shiftType: shiftTypeForField(field) }))
    .sort(compareShiftEntries);
}

function validateShiftEligibility(params: {
  activeFields: ShiftField[];
  staff?: ScheduleShiftEligibilityStaff;
}): string | null {
  for (const field of params.activeFields) {
    const shiftType = shiftTypeForField(field);
    if (params.staff && !canUseScheduleShiftType(params.staff, shiftType)) {
      return "Opening and Closing shifts are only available for therapists and CRM staff.";
    }
  }

  return null;
}

function validateActiveShiftTimes(
  activeFields: ShiftField[],
  times: StaffScheduleShiftTimes
): string | null {
  for (const field of activeFields) {
    const range = times[field];
    if (!isValidShiftRange(range.start, range.end)) {
      return "Shift times must span 1 minute to 16 hours.";
    }
  }

  for (let index = 0; index < activeFields.length; index++) {
    for (let other = index + 1; other < activeFields.length; other++) {
      const first = activeFields[index]!;
      const second = activeFields[other]!;
      if (timeRangesOverlap(times[first], times[second])) {
        return "Split shifts cannot overlap. Adjust the times or keep one shift active.";
      }
    }
  }

  return null;
}

function validateWeeklyScheduleDays(params: {
  days: StaffScheduleDayInput[];
  times: StaffScheduleShiftTimes;
  staff?: ScheduleShiftEligibilityStaff;
}):
  | { ok: true; days: Array<{ day: StaffScheduleDayInput; activeFields: ShiftField[] }> }
  | { ok: false; error: string } {
  if (params.days.length !== 7) {
    return { ok: false, error: "Must provide all 7 schedule days." };
  }

  const seenDays = new Set<number>();
  const normalizedDays: Array<{ day: StaffScheduleDayInput; activeFields: ShiftField[] }> = [];

  for (const day of params.days) {
    if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
      return { ok: false, error: "Schedule day must be between Sunday and Saturday." };
    }
    if (seenDays.has(day.dayOfWeek)) {
      return { ok: false, error: "Each weekday can only be submitted once." };
    }
    seenDays.add(day.dayOfWeek);

    const activeFields = activeShiftFields(day);
    const splitShift = day.splitShift === true;

    if (day.dayOff && activeFields.length > 0) {
      return { ok: false, error: "Day off cannot be combined with active shifts." };
    }

    if (!day.dayOff && activeFields.length === 0) {
      return { ok: false, error: "Choose a shift or mark the day off." };
    }

    if (!day.dayOff && activeFields.length > 1 && !splitShift) {
      return {
        ok: false,
        error: "Choose one shift or enable Split Shift for multiple windows.",
      };
    }

    if (splitShift && activeFields.length < 2) {
      return { ok: false, error: "Split Shift needs at least two active shift windows." };
    }

    const eligibilityError = validateShiftEligibility({
      activeFields,
      staff: params.staff,
    });
    if (eligibilityError) return { ok: false, error: eligibilityError };

    const timeError = validateActiveShiftTimes(activeFields, params.times);
    if (timeError) return { ok: false, error: timeError };

    normalizedDays.push({ day, activeFields });
  }

  if (seenDays.size !== 7) {
    return { ok: false, error: "Must provide all 7 schedule days." };
  }

  return { ok: true, days: normalizedDays };
}

export function buildStaffWeeklyScheduleRows(params: {
  staffId: string;
  days: StaffScheduleDayInput[];
  times: StaffScheduleShiftTimes;
  staff?: ScheduleShiftEligibilityStaff;
}): StaffScheduleValidationResult {
  const validation = validateWeeklyScheduleDays({
    days: params.days,
    times: params.times,
    staff: params.staff,
  });
  if (!validation.ok) return validation;

  const rows: StaffScheduleUpsertRow[] = [];

  for (const { day, activeFields } of validation.days) {
    if (day.dayOff) {
      rows.push({
        staff_id: params.staffId,
        day_of_week: day.dayOfWeek,
        start_time: DAY_OFF_START,
        end_time: DAY_OFF_END,
        is_active: false,
        shift_type: "single",
        window_order: 1,
        ends_next_day: false,
      });
      continue;
    }

    activeShiftEntries(activeFields, params.times).forEach((entry, index) => {
      rows.push({
        staff_id: params.staffId,
        day_of_week: day.dayOfWeek,
        start_time: entry.range.start,
        end_time: entry.range.end,
        is_active: true,
        shift_type: entry.shiftType,
        window_order: index + 1,
        ends_next_day: endsNextDay(entry.range.start, entry.range.end),
      });
    });
  }

  return { ok: true, rows };
}

export function buildSingleShiftWeeklyScheduleRows(params: {
  staffId: string;
  days: StaffSingleShiftWeeklyDayInput[];
}): StaffScheduleValidationResult {
  if (params.days.length !== 7) {
    return { ok: false, error: "Must provide all 7 schedule days." };
  }

  const seenDays = new Set<number>();
  const rows: StaffScheduleUpsertRow[] = [];

  for (const day of params.days) {
    if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
      return { ok: false, error: "Schedule day must be between Sunday and Saturday." };
    }
    if (seenDays.has(day.dayOfWeek)) {
      return { ok: false, error: "Each weekday can only be submitted once." };
    }
    seenDays.add(day.dayOfWeek);

    if (day.isActive && !isValidShiftRange(day.startTime, day.endTime)) {
      return { ok: false, error: "Shift times must span 1 minute to 16 hours." };
    }

    rows.push({
      staff_id: params.staffId,
      day_of_week: day.dayOfWeek,
      start_time: day.isActive ? day.startTime : DAY_OFF_START,
      end_time: day.isActive ? day.endTime : DAY_OFF_END,
      is_active: day.isActive,
      shift_type: "single",
      window_order: 1,
      ends_next_day: day.isActive ? endsNextDay(day.startTime, day.endTime) : false,
    });
  }

  if (seenDays.size !== 7) {
    return { ok: false, error: "Must provide all 7 schedule days." };
  }

  return { ok: true, rows };
}

export function buildStaffWeeklyWindowScheduleRows(params: {
  staffId: string;
  days: StaffScheduleWindowDayInput[];
  staff?: ScheduleShiftEligibilityStaff;
}): StaffScheduleValidationResult {
  if (params.days.length !== 7) {
    return { ok: false, error: "Must provide all 7 schedule days." };
  }

  const seenDays = new Set<number>();
  const rows: StaffScheduleUpsertRow[] = [];

  for (const day of params.days) {
    if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
      return { ok: false, error: "Schedule day must be between Sunday and Saturday." };
    }
    if (seenDays.has(day.dayOfWeek)) {
      return { ok: false, error: "Each weekday can only be submitted once." };
    }
    seenDays.add(day.dayOfWeek);

    if (day.mode === "unconfigured") {
      if (day.windows.length > 0) {
        return { ok: false, error: "Not configured days cannot contain working windows." };
      }
      continue;
    }

    if (day.mode === "day_off") {
      if (day.windows.length > 0) {
        return { ok: false, error: "Day off cannot be combined with active shifts." };
      }
      rows.push({
        staff_id: params.staffId,
        day_of_week: day.dayOfWeek,
        start_time: DAY_OFF_START,
        end_time: DAY_OFF_END,
        is_active: false,
        shift_type: "single",
        window_order: 1,
        ends_next_day: false,
      });
      continue;
    }

    if (day.windows.length === 0) {
      return { ok: false, error: "Working days need at least one schedule window." };
    }
    if (day.windows.length > MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY) {
      return {
        ok: false,
        error: `A weekday can have up to ${MAX_STAFF_SCHEDULE_WINDOWS_PER_DAY} schedule windows.`,
      };
    }

    const ranges: Array<{ order: number; start: number; end: number }> = [];
    const orderedWindows = [...day.windows].sort((a, b) => a.order - b.order);
    for (const [index, window] of orderedWindows.entries()) {
      if (!canUseScheduleShiftType(params.staff ?? {}, window.shiftType)) {
        return {
          ok: false,
          error: "Opening and Closing shifts are only available for therapists and CRM staff.",
        };
      }

      const range = explicitAbsoluteRange(window);
      if (!range.ok) return range;
      for (const existing of ranges) {
        if (existing.start < range.end && range.start < existing.end) {
          return {
            ok: false,
            error: `Window ${index + 1} overlaps another window on this weekday.`,
          };
        }
      }
      ranges.push({ order: index + 1, start: range.start, end: range.end });

      rows.push({
        staff_id: params.staffId,
        day_of_week: day.dayOfWeek,
        start_time: window.startTime,
        end_time: window.endTime,
        is_active: true,
        shift_type: window.shiftType,
        window_order: index + 1,
        ends_next_day: window.endsNextDay,
      });
    }
  }

  if (seenDays.size !== 7) {
    return { ok: false, error: "Must provide all 7 schedule days." };
  }

  return { ok: true, rows };
}

function rowKey(row: {
  staff_id: string;
  day_of_week: number;
  window_order: number;
}): string {
  return `${row.staff_id}:${row.day_of_week}:${row.window_order}`;
}

function normalizeTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export function savedRowsMatchRequest(params: {
  requestedRows: StaffScheduleUpsertRow[];
  savedRows: SavedStaffScheduleRow[] | null | undefined;
}): boolean {
  if ((params.savedRows?.length ?? 0) !== params.requestedRows.length) return false;

  const requestedByKey = new Map<string, StaffScheduleUpsertRow>();
  for (const row of params.requestedRows) {
    const key = rowKey(row);
    if (requestedByKey.has(key)) return false;
    requestedByKey.set(key, row);
  }

  for (const savedRow of params.savedRows ?? []) {
    const requested = requestedByKey.get(rowKey(savedRow));
    if (!requested) return false;
    if (normalizeTime(savedRow.start_time) !== normalizeTime(requested.start_time)) return false;
    if (normalizeTime(savedRow.end_time) !== normalizeTime(requested.end_time)) return false;
    if (savedRow.is_active !== requested.is_active) return false;
    if (savedRow.shift_type !== requested.shift_type) return false;
    if (savedRow.ends_next_day !== requested.ends_next_day) return false;
  }

  return true;
}
