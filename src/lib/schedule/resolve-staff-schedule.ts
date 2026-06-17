import { timeToMinutes } from "@/lib/utils/time-format";

export const STAFF_SCHEDULE_SHIFT_TYPES = ["single", "opening", "closing"] as const;

export type StaffScheduleShiftType = (typeof STAFF_SCHEDULE_SHIFT_TYPES)[number];

export type ResolvedStaffScheduleSource = "override" | "individual" | "group" | "none";

export type ResolvedStaffScheduleWindow = {
  shiftType: StaffScheduleShiftType;
  startTime: string;
  endTime: string;
};

export type ResolvedStaffSchedule = {
  source: ResolvedStaffScheduleSource;
  isWorking: boolean;
  isDayOff: boolean;
  windows: ResolvedStaffScheduleWindow[];
};

export type IndividualScheduleSourceRow = {
  shift_type: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean | null;
};

export type ScheduleOverrideSourceRow = {
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
  isWorking: false,
  isDayOff: false,
  windows: [],
};

const DAY_OFF_BY_SOURCE: Record<Exclude<ResolvedStaffScheduleSource, "none">, ResolvedStaffSchedule> = {
  override: {
    source: "override",
    isWorking: false,
    isDayOff: true,
    windows: [],
  },
  individual: {
    source: "individual",
    isWorking: false,
    isDayOff: true,
    windows: [],
  },
  group: {
    source: "group",
    isWorking: false,
    isDayOff: true,
    windows: [],
  },
};

export function dayOfWeekFromDateString(date: string): number {
  const [year = "0", month = "1", day = "1"] = date.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day)).getDay();
}

export function getScheduleGroupKeyForStaffType(
  staffType: string | null | undefined
): string | null {
  if (!staffType) return null;
  if (staffType === "csr" || staffType === "csr_staff" || staffType === "csr_head") {
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

function hasTimeRange<T extends {
  start_time: string | null;
  end_time: string | null;
}>(row: T): row is T & { start_time: string; end_time: string } {
  return Boolean(row.start_time && row.end_time && row.start_time !== row.end_time);
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

function workingSchedule(
  source: Exclude<ResolvedStaffScheduleSource, "none">,
  windows: ResolvedStaffScheduleWindow[]
): ResolvedStaffSchedule {
  const sortedWindows = sortWindows(windows);
  return {
    source,
    isWorking: sortedWindows.length > 0,
    isDayOff: false,
    windows: sortedWindows,
  };
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

  if (override && hasTimeRange(override)) {
    return workingSchedule("override", [
      {
        shiftType: "single",
        startTime: override.start_time,
        endTime: override.end_time,
      },
    ]);
  }

  const individualRows = params.individualRows ?? [];
  if (individualRows.length > 0) {
    const windows = individualRows
      .filter(
        (
          row
        ): row is IndividualScheduleSourceRow & { start_time: string; end_time: string } =>
          row.is_active === true && hasTimeRange(row)
      )
      .map(toWindow);

    if (windows.length > 0) {
      return workingSchedule("individual", windows);
    }

    return DAY_OFF_BY_SOURCE.individual;
  }

  const groupRules = (params.groupRules ?? []).filter((rule) => rule.is_active !== false);
  if (groupRules.some((rule) => rule.is_day_off === true)) {
    return DAY_OFF_BY_SOURCE.group;
  }

  const groupWindows = groupRules
    .filter(
      (
        rule
      ): rule is GroupScheduleRuleSourceRow & { start_time: string; end_time: string } =>
        rule.is_day_off !== true && hasTimeRange(rule)
    )
    .map(toWindow);

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
