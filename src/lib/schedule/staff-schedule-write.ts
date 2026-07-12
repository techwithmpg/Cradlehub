import type { StaffScheduleShiftType } from "@/lib/schedule/resolve-staff-schedule";
import { isValidShiftRange, timeToMinutes } from "@/lib/utils/time-format";

export const STAFF_SCHEDULE_CONFLICT_TARGET = "staff_id,day_of_week,shift_type";

export const STAFF_SCHEDULE_RETURNING_COLUMNS =
  "id, staff_id, day_of_week, shift_type, start_time, end_time, is_active";

export type StaffScheduleUpsertRow = {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type: StaffScheduleShiftType;
};

export type SavedStaffScheduleRow = StaffScheduleUpsertRow & {
  id: string;
};

export type StaffGroupScheduleRuleUpsertRow = {
  group_id: string;
  day_of_week: number;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  is_day_off: boolean;
  shift_type: StaffScheduleShiftType;
};

export type SavedStaffGroupScheduleRuleRow = StaffGroupScheduleRuleUpsertRow & {
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

export type StaffGroupScheduleRuleValidationResult =
  | { ok: true; rows: StaffGroupScheduleRuleUpsertRow[] }
  | { ok: false; error: string };

export type StaffSingleShiftWeeklyDayInput = {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
};

const SHIFT_FIELDS = ["opening", "closing", "regular"] as const;
type ShiftField = (typeof SHIFT_FIELDS)[number];

function shiftTypeForField(field: ShiftField): StaffScheduleShiftType {
  return field === "regular" ? "single" : field;
}

function activeShiftFields(day: StaffScheduleDayInput): ShiftField[] {
  return SHIFT_FIELDS.filter((field) => day[field]);
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

function timeRangesOverlap(
  first: { start: string; end: string },
  second: { start: string; end: string }
): boolean {
  const firstRange = absoluteRange(first.start, first.end);
  const secondRange = absoluteRange(second.start, second.end);
  if (!firstRange || !secondRange) return true;

  return firstRange.start < secondRange.end && secondRange.start < firstRange.end;
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
}): { ok: true; days: Array<{ day: StaffScheduleDayInput; activeFields: ShiftField[] }> } | { ok: false; error: string } {
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
}): StaffScheduleValidationResult {
  const validation = validateWeeklyScheduleDays({ days: params.days, times: params.times });
  if (!validation.ok) return validation;

  const rows: StaffScheduleUpsertRow[] = [];

  for (const { day } of validation.days) {
    for (const field of SHIFT_FIELDS) {
      const range = params.times[field];
      rows.push({
        staff_id: params.staffId,
        day_of_week: day.dayOfWeek,
        start_time: range.start,
        end_time: range.end,
        is_active: !day.dayOff && day[field],
        shift_type: shiftTypeForField(field),
      });
    }
  }

  return { ok: true, rows };
}

export function buildStaffGroupWeeklyRuleRows(params: {
  groupId: string;
  days: StaffScheduleDayInput[];
  times: StaffScheduleShiftTimes;
}): StaffGroupScheduleRuleValidationResult {
  const validation = validateWeeklyScheduleDays({ days: params.days, times: params.times });
  if (!validation.ok) return validation;

  const rows: StaffGroupScheduleRuleUpsertRow[] = [];

  for (const { day } of validation.days) {
    for (const field of SHIFT_FIELDS) {
      const shiftType = shiftTypeForField(field);
      const active = !day.dayOff && day[field];
      const dayOffMarker = day.dayOff && field === "regular";
      const range = params.times[field];

      rows.push({
        group_id: params.groupId,
        day_of_week: day.dayOfWeek,
        start_time: active ? range.start : dayOffMarker ? null : range.start,
        end_time: active ? range.end : dayOffMarker ? null : range.end,
        is_active: active || dayOffMarker,
        is_day_off: dayOffMarker,
        shift_type: shiftType,
      });
    }
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

    for (const field of SHIFT_FIELDS) {
      rows.push({
        staff_id: params.staffId,
        day_of_week: day.dayOfWeek,
        start_time: day.startTime,
        end_time: day.endTime,
        is_active: day.isActive && field === "regular",
        shift_type: shiftTypeForField(field),
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
  shift_type: StaffScheduleShiftType;
}): string {
  return `${row.staff_id}:${row.day_of_week}:${row.shift_type}`;
}

function groupRuleKey(row: {
  group_id: string;
  day_of_week: number;
  shift_type: StaffScheduleShiftType;
}): string {
  return `${row.group_id}:${row.day_of_week}:${row.shift_type}`;
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
  }

  return true;
}

export function savedGroupRuleRowsMatchRequest(params: {
  requestedRows: StaffGroupScheduleRuleUpsertRow[];
  savedRows: SavedStaffGroupScheduleRuleRow[] | null | undefined;
}): boolean {
  if ((params.savedRows?.length ?? 0) !== params.requestedRows.length) return false;

  const requestedByKey = new Map<string, StaffGroupScheduleRuleUpsertRow>();
  for (const row of params.requestedRows) {
    const key = groupRuleKey(row);
    if (requestedByKey.has(key)) return false;
    requestedByKey.set(key, row);
  }

  for (const savedRow of params.savedRows ?? []) {
    const requested = requestedByKey.get(groupRuleKey(savedRow));
    if (!requested) return false;
    if (normalizeTime(savedRow.start_time) !== normalizeTime(requested.start_time)) return false;
    if (normalizeTime(savedRow.end_time) !== normalizeTime(requested.end_time)) return false;
    if (savedRow.is_active !== requested.is_active) return false;
    if (savedRow.is_day_off !== requested.is_day_off) return false;
  }

  return true;
}
