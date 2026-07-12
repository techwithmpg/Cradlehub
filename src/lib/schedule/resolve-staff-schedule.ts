import { timeToMinutes } from "@/lib/utils/time-format";
import { getDayOfWeekFromYmd } from "@/lib/engine/slot-time";

export const STAFF_SCHEDULE_SHIFT_TYPES = ["single", "opening", "closing"] as const;

export type StaffScheduleShiftType = (typeof STAFF_SCHEDULE_SHIFT_TYPES)[number];

export type ResolvedStaffScheduleSource = "override" | "individual" | "group" | "none";
export type ResolvedStaffScheduleStatus = "resolved" | "day_off" | "missing" | "conflict";
export type ResolvedStaffScheduleConflictCode =
  | "invalid_time_range"
  | "overlapping_windows"
  | "day_off_with_working_window";

export type ResolvedStaffScheduleWindow = {
  shiftType: StaffScheduleShiftType;
  startTime: string;
  endTime: string;
};

export type ResolvedStaffSchedule = {
  source: ResolvedStaffScheduleSource;
  status: ResolvedStaffScheduleStatus;
  isWorking: boolean;
  isDayOff: boolean;
  windows: ResolvedStaffScheduleWindow[];
  conflictCode?: ResolvedStaffScheduleConflictCode;
  conflictReason?: string;
};

export type IndividualScheduleSourceRow = {
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean | null;
};

export type ScheduleOverrideSourceRow = {
  shift_type?: string | null;
  is_day_off: boolean | null;
  start_time: string | null;
  end_time: string | null;
} | null;

export type GroupScheduleRuleSourceRow = {
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean | null;
  is_day_off: boolean | null;
};

export const UNSCHEDULED_STAFF_SCHEDULE: ResolvedStaffSchedule = {
  source: "none",
  status: "missing",
  isWorking: false,
  isDayOff: false,
  windows: [],
};

const DAY_OFF_BY_SOURCE: Record<Exclude<ResolvedStaffScheduleSource, "none">, ResolvedStaffSchedule> = {
  override: {
    source: "override",
    status: "day_off",
    isWorking: false,
    isDayOff: true,
    windows: [],
  },
  individual: {
    source: "individual",
    status: "day_off",
    isWorking: false,
    isDayOff: true,
    windows: [],
  },
  group: {
    source: "group",
    status: "day_off",
    isWorking: false,
    isDayOff: true,
    windows: [],
  },
};

export function dayOfWeekFromDateString(date: string): number {
  return getDayOfWeekFromYmd(date);
}

export function getScheduleGroupKeyForStaffType(
  staffType: string | null | undefined
): string | null {
  if (!staffType) return null;
  if (staffType === "csr") {
    return "csr";
  }
  if (staffType === "driver") return "driver";
  if (staffType === "utility") return "utility";
  if (staffType === "nail_tech" || staffType === "salon_head") return "nail_tech";
  if (staffType === "aesthetician" || staffType === "facialist") return "aesthetician";
  if (staffType === "managerial") return "managerial";
  return "therapist";
}

export function normalizeScheduleShiftType(
  shiftType: string | null | undefined
): StaffScheduleShiftType {
  return shiftType === "opening" || shiftType === "closing" ? shiftType : "single";
}

function isKnownScheduleShiftType(
  shiftType: string | null | undefined
): shiftType is StaffScheduleShiftType {
  return (
    shiftType === "single" ||
    shiftType === "opening" ||
    shiftType === "closing"
  );
}

function hasTimeRange<T extends {
  start_time: string | null;
  end_time: string | null;
}>(row: T): row is T & { start_time: string; end_time: string } {
  return Boolean(row.start_time && row.end_time && row.start_time !== row.end_time);
}

function sameTimeRange(
  a: { start_time: string; end_time: string },
  b: { start_time: string; end_time: string }
): boolean {
  return a.start_time.slice(0, 5) === b.start_time.slice(0, 5) &&
    a.end_time.slice(0, 5) === b.end_time.slice(0, 5);
}

function toWindow(row: {
  shift_type: string | null;
  start_time: string;
  end_time: string;
}): ResolvedStaffScheduleWindow {
  return {
    shiftType: normalizeScheduleShiftType(row.shift_type),
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

function sortWindows(
  windows: ResolvedStaffScheduleWindow[]
): ResolvedStaffScheduleWindow[] {
  return [...windows].sort((a, b) => {
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

  return {
    start,
    end: end <= start ? end + 24 * 60 : end,
  };
}

function getWindowConflict(
  windows: ResolvedStaffScheduleWindow[]
): { code: ResolvedStaffScheduleConflictCode; reason: string } | null {
  const sorted = sortWindows(windows);

  for (const window of sorted) {
    const range = absoluteWindowRange(window);
    if (range.start === null || range.end === null || range.end <= range.start) {
      return {
        code: "invalid_time_range",
        reason: "A schedule window has an invalid or zero-length time range.",
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
        };
      }
    }
  }

  return null;
}

function conflictSchedule(params: {
  source: Exclude<ResolvedStaffScheduleSource, "none">;
  windows: ResolvedStaffScheduleWindow[];
  code: ResolvedStaffScheduleConflictCode;
  reason: string;
}): ResolvedStaffSchedule {
  return {
    source: params.source,
    status: "conflict",
    isWorking: false,
    isDayOff: false,
    windows: [],
    conflictCode: params.code,
    conflictReason: params.reason,
  };
}

function workingSchedule(
  source: Exclude<ResolvedStaffScheduleSource, "none">,
  windows: ResolvedStaffScheduleWindow[]
): ResolvedStaffSchedule {
  const sortedWindows = sortWindows(windows);
  return {
    source,
    status: "resolved",
    isWorking: sortedWindows.length > 0,
    isDayOff: false,
    windows: sortedWindows,
  };
}

function getLegacyOverrideSourceRows(params: {
  individualRows: IndividualScheduleSourceRow[];
  groupRules: GroupScheduleRuleSourceRow[];
}): Array<{
  shift_type: string | null;
  start_time: string;
  end_time: string;
}> {
  const individualRows = params.individualRows
    .filter(
      (
        row
      ): row is IndividualScheduleSourceRow & { start_time: string; end_time: string } =>
        row.is_active === true && hasTimeRange(row)
    );

  if (individualRows.length > 0) {
    return individualRows;
  }

  return params.groupRules
    .filter(
      (
        rule
      ): rule is GroupScheduleRuleSourceRow & { start_time: string; end_time: string } =>
        rule.is_active !== false && rule.is_day_off !== true && hasTimeRange(rule)
    );
}

function resolveOverrideShiftType(params: {
  override: NonNullable<ScheduleOverrideSourceRow> & { start_time: string; end_time: string };
  individualRows: IndividualScheduleSourceRow[];
  groupRules: GroupScheduleRuleSourceRow[];
}): StaffScheduleShiftType {
  if (isKnownScheduleShiftType(params.override.shift_type)) {
    return params.override.shift_type;
  }

  const sourceRows = getLegacyOverrideSourceRows({
    individualRows: params.individualRows,
    groupRules: params.groupRules,
  });
  const exactMatch = sourceRows.find(
    (row) => isKnownScheduleShiftType(row.shift_type) && sameTimeRange(row, params.override)
  );
  if (exactMatch && isKnownScheduleShiftType(exactMatch.shift_type)) {
    return exactMatch.shift_type;
  }

  const knownTypes = Array.from(
    new Set(
      sourceRows
        .map((row) => row.shift_type)
        .filter(isKnownScheduleShiftType)
    )
  );

  return knownTypes.length === 1 ? knownTypes[0]! : "single";
}

export function resolveScheduleForStaffDay(params: {
  override?: ScheduleOverrideSourceRow;
  individualRows?: IndividualScheduleSourceRow[];
  groupRules?: GroupScheduleRuleSourceRow[];
}): ResolvedStaffSchedule {
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
      });
    }

    const shiftType = resolveOverrideShiftType({
      override,
      individualRows: params.individualRows ?? [],
      groupRules: params.groupRules ?? [],
    });

    const window = {
      shiftType,
      startTime: override.start_time,
      endTime: override.end_time,
    };
    const conflict = getWindowConflict([window]);
    if (conflict) {
      return conflictSchedule({
        source: "override",
        windows: [window],
        code: conflict.code,
        reason: conflict.reason,
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
        (
          row
        ): row is IndividualScheduleSourceRow & { start_time: string; end_time: string } =>
          hasTimeRange(row)
      )
      .map(toWindow);

    if (invalidActiveRows.length > 0) {
      return conflictSchedule({
        source: "individual",
        windows,
        code: "invalid_time_range",
        reason: "An active individual schedule row is missing a valid time range.",
      });
    }

    const conflict = getWindowConflict(windows);
    if (conflict) {
      return conflictSchedule({
        source: "individual",
        windows,
        code: conflict.code,
        reason: conflict.reason,
      });
    }

    if (windows.length > 0) {
      return workingSchedule("individual", windows);
    }

    return DAY_OFF_BY_SOURCE.individual;
  }

  const groupRules = (params.groupRules ?? []).filter((rule) => rule.is_active !== false);
  const activeGroupWindows = groupRules.filter(
    (rule) => rule.is_day_off !== true && hasTimeRange(rule)
  );
  const invalidActiveGroupRules = groupRules.filter(
    (rule) => rule.is_day_off !== true && !hasTimeRange(rule)
  );

  if (groupRules.some((rule) => rule.is_day_off === true) && activeGroupWindows.length > 0) {
    return conflictSchedule({
      source: "group",
      windows: activeGroupWindows.map((rule) =>
        toWindow(rule as GroupScheduleRuleSourceRow & { start_time: string; end_time: string })
      ),
      code: "day_off_with_working_window",
      reason: "A group default marks the day off and also defines an active working window.",
    });
  }

  if (groupRules.some((rule) => rule.is_day_off === true)) {
    return DAY_OFF_BY_SOURCE.group;
  }

  const groupWindows = activeGroupWindows.map((rule) =>
    toWindow(rule as GroupScheduleRuleSourceRow & { start_time: string; end_time: string })
  );

  if (invalidActiveGroupRules.length > 0) {
    return conflictSchedule({
      source: "group",
      windows: groupWindows,
      code: "invalid_time_range",
      reason: "An active group schedule rule is missing a valid time range.",
    });
  }

  const groupConflict = getWindowConflict(groupWindows);
  if (groupConflict) {
    return conflictSchedule({
      source: "group",
      windows: groupWindows,
      code: groupConflict.code,
      reason: groupConflict.reason,
    });
  }

  if (groupWindows.length > 0) {
    return workingSchedule("group", groupWindows);
  }

  return UNSCHEDULED_STAFF_SCHEDULE;
}

function absoluteWindowEndMinutes(window: ResolvedStaffScheduleWindow): number {
  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  if (start === null || end === null) return 0;
  return end <= start ? end + 24 * 60 : end;
}

export function getScheduleWindowSpan(
  windows: ResolvedStaffScheduleWindow[]
): { startTime: string; endTime: string } | null {
  if (windows.length === 0) return null;

  const sortedByStart = sortWindows(windows);
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

    if (end <= start) {
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

  const isOvernight = workEnd <= workStart;
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
