import { getDayOfWeekFromYmd } from "@/lib/engine/slot-time";
import {
  canUseScheduleShiftType,
  isCrmFrontDeskScheduleStaff,
  type ScheduleShiftEligibilityStaff,
} from "@/lib/schedule/shift-eligibility";
import {
  doesDurationFitWithinScheduleWindows as doesDurationFitWithinCoverage,
  getScheduleWindowAbsoluteRange,
} from "@/lib/schedule/schedule-coverage";
import { timeToMinutes } from "@/lib/utils/time-format";

export const STAFF_SCHEDULE_SHIFT_TYPES = ["single", "opening", "closing"] as const;

export type StaffScheduleShiftType = (typeof STAFF_SCHEDULE_SHIFT_TYPES)[number];

export type ResolvedStaffScheduleSource = "override" | "individual" | "none";
export type ResolvedStaffScheduleStatus =
  | "resolved"
  | "day_off"
  | "missing"
  | "conflict"
  | "not_operational";
export type ResolvedStaffScheduleState =
  | "NO_SCHEDULE_CONFIGURED"
  | "CONFIGURED_DAY_OFF"
  | "VALID_SCHEDULE"
  | "VALID_SPLIT_SHIFT"
  | "VALID_OVERNIGHT_SHIFT"
  | "OVERLAPPING_WINDOWS"
  | "INVALID_TIME_WINDOW"
  | "INELIGIBLE_SHIFT_TYPE"
  | "CONTRADICTORY_DAY_STATE"
  | "STAFF_NOT_OPERATIONAL";
export type ResolvedStaffScheduleConflictCode =
  | "invalid_time_range"
  | "overlapping_windows"
  | "day_off_with_working_window"
  | "ineligible_shift_type"
  | "contradictory_day_state";

export type ResolvedStaffScheduleWindow = {
  shiftType: StaffScheduleShiftType;
  startTime: string;
  endTime: string;
  id?: string;
  windowOrder?: number;
  endsNextDay?: boolean;
};

export type ResolvedStaffSchedule = {
  source: ResolvedStaffScheduleSource;
  status: ResolvedStaffScheduleStatus;
  state: ResolvedStaffScheduleState;
  isWorking: boolean;
  isDayOff: boolean;
  windows: ResolvedStaffScheduleWindow[];
  coverageKind?: "open_close";
  conflictCode?: ResolvedStaffScheduleConflictCode;
  conflictReason?: string;
};

export type IndividualScheduleSourceRow = {
  id?: string | null;
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean | null;
  window_order?: number | null;
  ends_next_day?: boolean | null;
};

export type ScheduleOverrideSourceRow = {
  id?: string | null;
  shift_type?: string | null;
  is_day_off: boolean | null;
  start_time: string | null;
  end_time: string | null;
  ends_next_day?: boolean | null;
} | null;

export const UNSCHEDULED_STAFF_SCHEDULE: ResolvedStaffSchedule = {
  source: "none",
  status: "missing",
  state: "NO_SCHEDULE_CONFIGURED",
  isWorking: false,
  isDayOff: false,
  windows: [],
};

export const NON_OPERATIONAL_STAFF_SCHEDULE: ResolvedStaffSchedule = {
  source: "none",
  status: "not_operational",
  state: "STAFF_NOT_OPERATIONAL",
  isWorking: false,
  isDayOff: false,
  windows: [],
};

const DAY_OFF_BY_SOURCE: Record<
  Exclude<ResolvedStaffScheduleSource, "none">,
  ResolvedStaffSchedule
> = {
  override: {
    source: "override",
    status: "day_off",
    state: "CONFIGURED_DAY_OFF",
    isWorking: false,
    isDayOff: true,
    windows: [],
  },
  individual: {
    source: "individual",
    status: "day_off",
    state: "CONFIGURED_DAY_OFF",
    isWorking: false,
    isDayOff: true,
    windows: [],
  },
};

export function dayOfWeekFromDateString(date: string): number {
  return getDayOfWeekFromYmd(date);
}

export function normalizeScheduleShiftType(
  shiftType: string | null | undefined
): StaffScheduleShiftType {
  return shiftType === "opening" || shiftType === "closing" ? shiftType : "single";
}

function isKnownScheduleShiftType(
  shiftType: string | null | undefined
): shiftType is StaffScheduleShiftType {
  return shiftType === "single" || shiftType === "opening" || shiftType === "closing";
}

function hasTimeRange<
  T extends {
    start_time: string | null;
    end_time: string | null;
  },
>(row: T): row is T & { start_time: string; end_time: string } {
  return Boolean(row.start_time && row.end_time && row.start_time !== row.end_time);
}

function sameTimeRange(
  a: { start_time: string; end_time: string },
  b: { start_time: string; end_time: string }
): boolean {
  return (
    a.start_time.slice(0, 5) === b.start_time.slice(0, 5) &&
    a.end_time.slice(0, 5) === b.end_time.slice(0, 5)
  );
}

function toWindow(row: {
  id?: string | null;
  shift_type: string | null;
  start_time: string;
  end_time: string;
  window_order?: number | null;
  ends_next_day?: boolean | null;
}): ResolvedStaffScheduleWindow {
  const window: ResolvedStaffScheduleWindow = {
    shiftType: normalizeScheduleShiftType(row.shift_type),
    startTime: row.start_time,
    endTime: row.end_time,
  };
  if (row.id) window.id = row.id;
  if (row.window_order != null) window.windowOrder = row.window_order;
  if (row.ends_next_day != null) window.endsNextDay = row.ends_next_day;
  return window;
}

function sortWindows(windows: ResolvedStaffScheduleWindow[]): ResolvedStaffScheduleWindow[] {
  return [...windows].sort((a, b) => {
    if (a.windowOrder != null || b.windowOrder != null) {
      return (a.windowOrder ?? 999) - (b.windowOrder ?? 999);
    }
    const aStart = timeToMinutes(a.startTime) ?? 0;
    const bStart = timeToMinutes(b.startTime) ?? 0;
    return aStart - bStart;
  });
}

function absoluteWindowRange(window: ResolvedStaffScheduleWindow): {
  start: number | null;
  end: number | null;
} {
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (start === null || end === null || start === end) {
    return { start: null, end: null };
  }

  const crossesMidnight = window.endsNextDay ?? end <= start;
  return {
    start,
    end: crossesMidnight ? end + 24 * 60 : end,
  };
}

function isAdjacentOpenCloseCoverage(windows: ResolvedStaffScheduleWindow[]): boolean {
  if (windows.length !== 2) return false;
  const opening = windows.find((window) => window.shiftType === "opening");
  const closing = windows.find((window) => window.shiftType === "closing");
  if (!opening || !closing) return false;

  const openingRange = getScheduleWindowAbsoluteRange(opening);
  const closingRange = getScheduleWindowAbsoluteRange(closing);
  return Boolean(
    openingRange &&
    closingRange &&
    openingRange.start < closingRange.start &&
    openingRange.end === closingRange.start &&
    closingRange.end > openingRange.end
  );
}

function getWindowConflict(
  windows: ResolvedStaffScheduleWindow[]
): {
  code: ResolvedStaffScheduleConflictCode;
  reason: string;
  state: ResolvedStaffScheduleState;
} | null {
  const sorted = sortWindows(windows);

  for (const window of sorted) {
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    const range = absoluteWindowRange(window);
    if (
      start === null ||
      end === null ||
      range.start === null ||
      range.end === null ||
      range.end <= range.start ||
      range.end - range.start > 16 * 60 ||
      (window.endsNextDay === false && end <= start) ||
      (window.endsNextDay === true && end > start)
    ) {
      return {
        code: "invalid_time_range",
        reason: "A schedule window has an invalid or zero-length time range.",
        state: "INVALID_TIME_WINDOW",
      };
    }
  }

  for (let index = 0; index < sorted.length; index++) {
    for (let other = index + 1; other < sorted.length; other++) {
      const first = sorted[index]!;
      const second = sorted[other]!;
      const firstRange = absoluteWindowRange(first);
      const secondRange = absoluteWindowRange(second);
      if (
        firstRange.start === null ||
        firstRange.end === null ||
        secondRange.start === null ||
        secondRange.end === null
      ) {
        continue;
      }

      if (firstRange.start < secondRange.end && secondRange.start < firstRange.end) {
        return {
          code: "overlapping_windows",
          reason: "Multiple active schedule windows overlap for the same day.",
          state: "OVERLAPPING_WINDOWS",
        };
      }
    }
  }

  return null;
}

function getEligibilityConflict(params: {
  staff?: ScheduleShiftEligibilityStaff;
  windows: ResolvedStaffScheduleWindow[];
}): {
  code: ResolvedStaffScheduleConflictCode;
  reason: string;
  state: ResolvedStaffScheduleState;
} | null {
  if (!params.staff) return null;

  const invalidWindow = params.windows.find(
    (window) => !canUseScheduleShiftType(params.staff!, window.shiftType)
  );
  if (!invalidWindow) return null;

  return {
    code: "ineligible_shift_type",
    reason: "Opening and Closing shifts are only valid for therapists and CRM staff.",
    state: "INELIGIBLE_SHIFT_TYPE",
  };
}

function conflictSchedule(params: {
  source: Exclude<ResolvedStaffScheduleSource, "none">;
  windows: ResolvedStaffScheduleWindow[];
  code: ResolvedStaffScheduleConflictCode;
  reason: string;
  state: ResolvedStaffScheduleState;
}): ResolvedStaffSchedule {
  return {
    source: params.source,
    status: "conflict",
    state: params.state,
    isWorking: false,
    isDayOff: false,
    windows: sortWindows(params.windows),
    conflictCode: params.code,
    conflictReason: params.reason,
  };
}

function workingSchedule(
  source: Exclude<ResolvedStaffScheduleSource, "none">,
  windows: ResolvedStaffScheduleWindow[],
  coverageKind?: ResolvedStaffSchedule["coverageKind"]
): ResolvedStaffSchedule {
  const sortedWindows = sortWindows(windows);
  const hasOvernight = sortedWindows.some((window) => window.endsNextDay === true);
  const schedule: ResolvedStaffSchedule = {
    source,
    status: "resolved",
    state:
      sortedWindows.length > 1
        ? "VALID_SPLIT_SHIFT"
        : hasOvernight
          ? "VALID_OVERNIGHT_SHIFT"
          : "VALID_SCHEDULE",
    isWorking: sortedWindows.length > 0,
    isDayOff: false,
    windows: sortedWindows,
  };
  if (coverageKind) schedule.coverageKind = coverageKind;
  return schedule;
}

function getLegacyOverrideSourceRows(params: {
  individualRows: IndividualScheduleSourceRow[];
}): Array<{
  shift_type: string | null;
  start_time: string;
  end_time: string;
}> {
  return params.individualRows.filter(
    (row): row is IndividualScheduleSourceRow & { start_time: string; end_time: string } =>
      row.is_active === true && hasTimeRange(row)
  );
}

function resolveOverrideShiftType(params: {
  override: NonNullable<ScheduleOverrideSourceRow> & { start_time: string; end_time: string };
  individualRows: IndividualScheduleSourceRow[];
}): StaffScheduleShiftType {
  if (isKnownScheduleShiftType(params.override.shift_type)) {
    return params.override.shift_type;
  }

  const sourceRows = getLegacyOverrideSourceRows({
    individualRows: params.individualRows,
  });
  const exactMatch = sourceRows.find(
    (row) => isKnownScheduleShiftType(row.shift_type) && sameTimeRange(row, params.override)
  );
  if (exactMatch && isKnownScheduleShiftType(exactMatch.shift_type)) {
    return exactMatch.shift_type;
  }

  const knownTypes = Array.from(
    new Set(sourceRows.map((row) => row.shift_type).filter(isKnownScheduleShiftType))
  );

  return knownTypes.length === 1 ? knownTypes[0]! : "single";
}

export function resolveScheduleForStaffDay(params: {
  override?: ScheduleOverrideSourceRow;
  individualRows?: IndividualScheduleSourceRow[];
  staff?: ScheduleShiftEligibilityStaff;
  operational?: boolean;
}): ResolvedStaffSchedule {
  if (params.operational === false) {
    return NON_OPERATIONAL_STAFF_SCHEDULE;
  }

  const override = params.override ?? null;
  if (override?.is_day_off === true) {
    return DAY_OFF_BY_SOURCE.override;
  }

  if (override) {
    if (!hasTimeRange(override)) {
      return conflictSchedule({
        source: "override",
        windows: [],
        code: "invalid_time_range",
        reason: "A date-specific schedule override is missing a valid time range.",
        state: "INVALID_TIME_WINDOW",
      });
    }

    const shiftType = resolveOverrideShiftType({
      override,
      individualRows: params.individualRows ?? [],
    });

    const window = toWindow({
      id: override.id,
      shift_type: shiftType,
      start_time: override.start_time,
      end_time: override.end_time,
      window_order: 1,
      ends_next_day: override.ends_next_day,
    });
    const eligibilityConflict = getEligibilityConflict({ staff: params.staff, windows: [window] });
    if (eligibilityConflict) {
      return conflictSchedule({
        source: "override",
        windows: [window],
        code: eligibilityConflict.code,
        reason: eligibilityConflict.reason,
        state: eligibilityConflict.state,
      });
    }

    const conflict = getWindowConflict([window]);
    if (conflict) {
      return conflictSchedule({
        source: "override",
        windows: [window],
        code: conflict.code,
        reason: conflict.reason,
        state: conflict.state,
      });
    }

    return workingSchedule("override", [window]);
  }

  const individualRows = params.individualRows ?? [];
  if (individualRows.length > 0) {
    const activeRows = individualRows.filter((row) => row.is_active === true);
    const invalidActiveRows = activeRows.filter((row) => !hasTimeRange(row));
    const windows = activeRows
      .filter(
        (row): row is IndividualScheduleSourceRow & { start_time: string; end_time: string } =>
          hasTimeRange(row)
      )
      .map(toWindow);

    if (invalidActiveRows.length > 0) {
      return conflictSchedule({
        source: "individual",
        windows,
        code: "invalid_time_range",
        reason: "An active individual schedule row is missing a valid time range.",
        state: "INVALID_TIME_WINDOW",
      });
    }

    const eligibilityConflict = getEligibilityConflict({ staff: params.staff, windows });
    if (eligibilityConflict) {
      return conflictSchedule({
        source: "individual",
        windows,
        code: eligibilityConflict.code,
        reason: eligibilityConflict.reason,
        state: eligibilityConflict.state,
      });
    }

    const conflict = getWindowConflict(windows);
    if (conflict) {
      return conflictSchedule({
        source: "individual",
        windows,
        code: conflict.code,
        reason: conflict.reason,
        state: conflict.state,
      });
    }

    if (windows.length > 0) {
      const coverageKind =
        params.staff &&
        isCrmFrontDeskScheduleStaff(params.staff) &&
        isAdjacentOpenCloseCoverage(windows)
          ? "open_close"
          : undefined;
      return workingSchedule("individual", windows, coverageKind);
    }

    return DAY_OFF_BY_SOURCE.individual;
  }

  return UNSCHEDULED_STAFF_SCHEDULE;
}

function absoluteWindowEndMinutes(window: ResolvedStaffScheduleWindow): number {
  const range = absoluteWindowRange(window);
  return range.end ?? 0;
}

export function getScheduleWindowSpan(
  windows: ResolvedStaffScheduleWindow[]
): { startTime: string; endTime: string } | null {
  if (windows.length === 0) return null;

  const sortedByStart = [...windows].sort((a, b) => {
    const aStart = timeToMinutes(a.startTime) ?? 0;
    const bStart = timeToMinutes(b.startTime) ?? 0;
    return aStart - bStart;
  });
  const startWindow = sortedByStart[0]!;
  const endWindow = [...windows].sort(
    (a, b) => absoluteWindowEndMinutes(b) - absoluteWindowEndMinutes(a)
  )[0]!;

  return {
    startTime: startWindow.startTime,
    endTime: endWindow.endTime,
  };
}

export function isTimeWithinScheduleWindows(
  time: string,
  windows: ResolvedStaffScheduleWindow[]
): boolean {
  const current = timeToMinutes(time);
  if (current === null) return false;

  return windows.some((window) => {
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    if (start === null || end === null) return false;

    const crossesMidnight = window.endsNextDay ?? end <= start;
    if (crossesMidnight) {
      return current >= start || current <= end;
    }

    return current >= start && current <= end;
  });
}

export function doesDurationFitWithinScheduleWindow(params: {
  slotStartTime: string;
  durationMinutes: number;
  window: ResolvedStaffScheduleWindow;
}): boolean {
  const slotStartRaw = timeToMinutes(params.slotStartTime);
  const workStart = timeToMinutes(params.window.startTime);
  let workEnd = timeToMinutes(params.window.endTime);
  if (slotStartRaw === null || workStart === null || workEnd === null) return false;

  const isOvernight = params.window.endsNextDay ?? workEnd <= workStart;
  if (isOvernight) {
    workEnd += 24 * 60;
  }

  let slotStart = slotStartRaw;
  if (isOvernight && slotStart < workStart) {
    slotStart += 24 * 60;
  }

  const slotEnd = slotStart + params.durationMinutes;
  return slotStart >= workStart && slotEnd <= workEnd;
}

export function doesDurationFitWithinScheduleWindows(params: {
  slotStartTime: string;
  durationMinutes: number;
  windows: ResolvedStaffScheduleWindow[];
}): boolean {
  return doesDurationFitWithinCoverage(params);
}
