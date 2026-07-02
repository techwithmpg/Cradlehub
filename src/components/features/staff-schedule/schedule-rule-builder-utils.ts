import { formatShiftTimeRange, formatTime12h } from "@/lib/utils/time-format";
import type { StaffGroupScheduleRule } from "@/lib/queries/staff-schedule-groups";
import type { StaffScheduleItem } from "./staff-schedule-list";

export type ScheduleMode = "opening_closing" | "regular_only";
export type ShiftKind = "opening" | "closing" | "regular";
export type RuleShiftType = "opening" | "closing" | "single";

export type DayPattern = {
  opening: boolean;
  closing: boolean;
  regular: boolean;
  dayOff: boolean;
};

export type ShiftTimeRange = {
  start: string;
  end: string;
};

export type ShiftTimes = Record<ShiftKind, ShiftTimeRange>;

export type GroupScheduleConfig = {
  groupId: string;
  label: string;
  singularLabel: string;
  mode: ScheduleMode;
  subtitle: string;
  description: string;
  defaults: ShiftTimes;
};

export const SCHEDULE_DAYS = [
  { dow: 1, label: "Monday", short: "Mon" },
  { dow: 2, label: "Tuesday", short: "Tue" },
  { dow: 3, label: "Wednesday", short: "Wed" },
  { dow: 4, label: "Thursday", short: "Thu" },
  { dow: 5, label: "Friday", short: "Fri" },
  { dow: 6, label: "Saturday", short: "Sat" },
  { dow: 0, label: "Sunday", short: "Sun" },
] as const;

export const ALL_SHIFT_KINDS: ShiftKind[] = ["opening", "closing", "regular"];

const THERAPIST_TIMES: ShiftTimes = {
  opening: { start: "10:00", end: "17:30" },
  closing: { start: "14:00", end: "22:30" },
  regular: { start: "10:00", end: "17:30" },
};

const CRM_TIMES: ShiftTimes = {
  opening: { start: "10:00", end: "19:00" },
  closing: { start: "17:00", end: "01:00" },
  regular: { start: "10:00", end: "19:00" },
};

const DRIVER_TIMES: ShiftTimes = {
  opening: { start: "14:00", end: "22:00" },
  closing: { start: "14:00", end: "22:00" },
  regular: { start: "14:00", end: "22:00" },
};

const UTILITY_TIMES: ShiftTimes = {
  opening: { start: "08:00", end: "20:00" },
  closing: { start: "08:00", end: "20:00" },
  regular: { start: "08:00", end: "20:00" },
};

const SALON_TIMES: ShiftTimes = {
  opening: { start: "10:00", end: "17:30" },
  closing: { start: "10:00", end: "17:30" },
  regular: { start: "10:00", end: "17:30" },
};

export const GROUP_SCHEDULE_CONFIG: Record<string, GroupScheduleConfig> = {
  therapist: {
    groupId: "therapist",
    label: "Therapists",
    singularLabel: "Therapist",
    mode: "opening_closing",
    subtitle: "Opening and closing rotation",
    description: "Therapist coverage uses opening and closing shifts for balanced provider rotation.",
    defaults: THERAPIST_TIMES,
  },
  csr: {
    groupId: "csr",
    label: "CRM / Front Desk",
    singularLabel: "Front Desk Associate",
    mode: "opening_closing",
    subtitle: "Opening and closing coverage",
    description:
      "Front desk coverage uses opening and closing shifts to ensure full daily operations.",
    defaults: CRM_TIMES,
  },
  driver: {
    groupId: "driver",
    label: "Drivers",
    singularLabel: "Driver",
    mode: "regular_only",
    subtitle: "Regular coverage",
    description: "Drivers use regular working hours for dispatch and route coverage.",
    defaults: DRIVER_TIMES,
  },
  utility: {
    groupId: "utility",
    label: "Utility",
    singularLabel: "Utility Staff",
    mode: "regular_only",
    subtitle: "Regular coverage",
    description: "Utility staff use regular working hours for facility support.",
    defaults: UTILITY_TIMES,
  },
  nail_tech: {
    groupId: "nail_tech",
    label: "Salon / Nail Tech",
    singularLabel: "Salon / Nail Tech",
    mode: "regular_only",
    subtitle: "Regular coverage",
    description: "Salon and nail technicians use regular working hours by default.",
    defaults: SALON_TIMES,
  },
  aesthetician: {
    groupId: "aesthetician",
    label: "Aesthetician",
    singularLabel: "Aesthetician",
    mode: "regular_only",
    subtitle: "Regular coverage",
    description: "Aestheticians use regular working hours by default.",
    defaults: SALON_TIMES,
  },
  managerial: {
    groupId: "managerial",
    label: "Managers",
    singularLabel: "Manager",
    mode: "regular_only",
    subtitle: "Regular coverage",
    description: "Managers use regular coverage unless individual adjustments are needed.",
    defaults: CRM_TIMES,
  },
};

export function getGroupScheduleConfig(groupId: string): GroupScheduleConfig {
  return GROUP_SCHEDULE_CONFIG[groupId] ?? GROUP_SCHEDULE_CONFIG.therapist!;
}

export function getVisibleShiftKinds(groupId: string): ShiftKind[] {
  return getGroupScheduleConfig(groupId).mode === "opening_closing"
    ? ["opening", "closing"]
    : ["regular"];
}

export function getRuleShiftType(kind: ShiftKind): RuleShiftType {
  return kind === "regular" ? "single" : kind;
}

export function getGroupKeyForStaffType(staffType: string | null | undefined): string {
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

export function createEmptyPattern(): Record<number, DayPattern> {
  return {
    0: { opening: false, closing: false, regular: false, dayOff: false },
    1: { opening: false, closing: false, regular: false, dayOff: false },
    2: { opening: false, closing: false, regular: false, dayOff: false },
    3: { opening: false, closing: false, regular: false, dayOff: false },
    4: { opening: false, closing: false, regular: false, dayOff: false },
    5: { opening: false, closing: false, regular: false, dayOff: false },
    6: { opening: false, closing: false, regular: false, dayOff: false },
  };
}

export function createDefaultPattern(groupId: string): Record<number, DayPattern> {
  const pattern = createEmptyPattern();
  const visibleKinds = getVisibleShiftKinds(groupId);

  for (const { dow } of SCHEDULE_DAYS) {
    const row = pattern[dow];
    if (!row) continue;

    if (dow === 0) {
      row.dayOff = true;
      continue;
    }

    for (const kind of visibleKinds) {
      row[kind] = true;
    }
  }

  return pattern;
}

export function extractShiftTimesForGroup(
  rules: StaffGroupScheduleRule[],
  groupId: string
): ShiftTimes {
  const times: ShiftTimes = structuredClone(getGroupScheduleConfig(groupId).defaults);

  for (const rule of rules) {
    if (rule.is_day_off || !rule.start_time || !rule.end_time) continue;
    const start = rule.start_time.slice(0, 5);
    const end = rule.end_time.slice(0, 5);
    if (rule.shift_type === "opening") times.opening = { start, end };
    if (rule.shift_type === "closing") times.closing = { start, end };
    if (rule.shift_type === "single") times.regular = { start, end };
  }

  return times;
}

export function rulesToPatternForGroup(
  rules: StaffGroupScheduleRule[],
  groupId: string
): Record<number, DayPattern> {
  const hasRules = rules.some((rule) => rule.is_active);
  if (!hasRules) return createDefaultPattern(groupId);

  const pattern = createEmptyPattern();
  const visibleKinds = new Set(getVisibleShiftKinds(groupId));

  for (const rule of rules) {
    const row = pattern[rule.day_of_week];
    if (!row || !rule.is_active) continue;

    if (rule.is_day_off) {
      row.dayOff = true;
      continue;
    }

    if (rule.shift_type === "opening" && visibleKinds.has("opening")) row.opening = true;
    if (rule.shift_type === "closing" && visibleKinds.has("closing")) row.closing = true;
    if (rule.shift_type === "single" && visibleKinds.has("regular")) row.regular = true;
  }

  return pattern;
}

export function schedulesToPatternForGroup(
  schedules: StaffScheduleItem["schedules"],
  groupId: string
): Record<number, DayPattern> {
  const visibleKinds = new Set(getVisibleShiftKinds(groupId));
  const pattern = createEmptyPattern();

  for (const { dow } of SCHEDULE_DAYS) {
    const row = pattern[dow];
    if (!row) continue;
    const dayRows = schedules.filter((schedule) => schedule.day_of_week === dow);
    const activeRows = dayRows.filter((schedule) => schedule.is_active);

    if (dayRows.length > 0 && activeRows.length === 0) {
      row.dayOff = true;
      continue;
    }

    for (const schedule of activeRows) {
      if (schedule.shift_type === "opening" && visibleKinds.has("opening")) row.opening = true;
      if (schedule.shift_type === "closing" && visibleKinds.has("closing")) row.closing = true;
      if (schedule.shift_type === "single" && visibleKinds.has("regular")) row.regular = true;
    }
  }

  return pattern;
}

export function extractStaffTimesForGroup(
  schedules: StaffScheduleItem["schedules"],
  groupId: string,
  fallback: ShiftTimes
): ShiftTimes {
  const times: ShiftTimes = structuredClone(fallback);

  for (const schedule of schedules) {
    if (!schedule.start_time || !schedule.end_time) continue;
    const start = schedule.start_time.slice(0, 5);
    const end = schedule.end_time.slice(0, 5);
    if (schedule.shift_type === "opening") times.opening = { start, end };
    if (schedule.shift_type === "closing") times.closing = { start, end };
    if (schedule.shift_type === "single") times.regular = { start, end };
  }

  return times;
}

export function hasActiveIndividualSchedule(item: StaffScheduleItem): boolean {
  return item.schedules.some((schedule) => schedule.is_active);
}

export function patternsMatchForDay(
  current: DayPattern,
  base: DayPattern,
  visibleKinds: ShiftKind[]
): boolean {
  return (
    current.dayOff === base.dayOff &&
    visibleKinds.every((kind) => current[kind] === base[kind])
  );
}

export function countDiffDays(
  current: Record<number, DayPattern>,
  base: Record<number, DayPattern>,
  visibleKinds: ShiftKind[]
): number {
  return SCHEDULE_DAYS.filter(({ dow }) => {
    const currentRow = current[dow];
    const baseRow = base[dow];
    return currentRow && baseRow && !patternsMatchForDay(currentRow, baseRow, visibleKinds);
  }).length;
}

export function countWeeklyShifts(
  pattern: Record<number, DayPattern>,
  visibleKinds: ShiftKind[]
): number {
  return SCHEDULE_DAYS.reduce((total, { dow }) => {
    const row = pattern[dow];
    if (!row || row.dayOff) return total;
    return total + visibleKinds.filter((kind) => row[kind]).length;
  }, 0);
}

export function activeDayLabels(
  pattern: Record<number, DayPattern>,
  field: ShiftKind | "dayOff"
): string[] {
  return SCHEDULE_DAYS.filter(({ dow }) => pattern[dow]?.[field]).map((day) => day.short);
}

export function formatDayList(labels: string[]): string {
  if (labels.length === 0) return "Not used";
  if (labels.length === 1) return labels[0] ?? "Not used";

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (weekdayLabels.every((day) => labels.includes(day)) && labels.length === weekdayLabels.length) {
    return "Mon - Fri";
  }
  if (weekLabels.every((day) => labels.includes(day)) && labels.length === weekLabels.length) {
    return "Mon - Sat";
  }

  return labels.join(", ");
}

export function isOvernightShift(start: string, end: string): boolean {
  const toMinutes = (value: string) => {
    const [hour = "0", minute = "0"] = value.slice(0, 5).split(":");
    return Number(hour) * 60 + Number(minute);
  };

  return toMinutes(end) <= toMinutes(start);
}

export function getShiftDisplay(kind: ShiftKind, times: ShiftTimes) {
  const range = times[kind];
  return {
    label: formatShiftTimeRange(range.start, range.end).replace(" (+1)", ""),
    startLabel: formatTime12h(range.start),
    endLabel: formatTime12h(range.end),
    isOvernight: isOvernightShift(range.start, range.end),
  };
}

export function getShiftLabel(kind: ShiftKind): string {
  if (kind === "opening") return "Opening Shift";
  if (kind === "closing") return "Closing Shift";
  return "Regular Shift";
}

export function getShiftHelper(kind: ShiftKind, groupId: string): string {
  if (kind === "opening") {
    return groupId === "csr" ? "Early / front desk coverage" : "Early shift and first coverage";
  }
  if (kind === "closing") {
    return groupId === "csr" ? "Late shift and closing duties" : "Late shift and final coverage";
  }
  return "Default working hours for this group";
}

export function getNextDayOff(pattern: Record<number, DayPattern>): string {
  return SCHEDULE_DAYS.find(({ dow }) => pattern[dow]?.dayOff)?.label ?? "No weekly day off";
}

export function getActiveShiftLabelsForDay(
  pattern: Record<number, DayPattern>,
  dow: number,
  visibleKinds: ShiftKind[]
): string[] {
  const row = pattern[dow];
  if (!row || row.dayOff) return ["Day Off"];
  const labels = visibleKinds.filter((kind) => row[kind]).map(getShiftLabel);
  return labels.length > 0 ? labels : ["Not scheduled"];
}

export function clonePattern(pattern: Record<number, DayPattern>): Record<number, DayPattern> {
  return Object.fromEntries(
    Object.entries(pattern).map(([key, value]) => [Number(key), { ...value }])
  ) as Record<number, DayPattern>;
}

export function patternToSaveDays(pattern: Record<number, DayPattern>) {
  return SCHEDULE_DAYS.map(({ dow }) => {
    const row = pattern[dow] ?? {
      opening: false,
      closing: false,
      regular: false,
      dayOff: false,
    };

    return {
      dayOfWeek: dow,
      opening: row.opening,
      closing: row.closing,
      regular: row.regular,
      dayOff: row.dayOff,
    };
  });
}
