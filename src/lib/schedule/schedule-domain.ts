export type ScheduleShiftKind = "regular" | "opening" | "closing";
export type DatabaseScheduleShiftType = "single" | "opening" | "closing";
export type ScheduleDayMode = "unconfigured" | "working" | "day_off";

export type ScheduleWindow = {
  id: string;
  source: "weekly" | "override";
  shiftKind: ScheduleShiftKind;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  windowOrder: number;
  endsNextDay: boolean;
};

export type ScheduleDay = {
  dayOfWeek: number;
  mode: ScheduleDayMode;
  windows: ScheduleWindow[];
};

const SHIFT_LABELS: Record<ScheduleShiftKind, string> = {
  opening: "Opening Shift",
  regular: "Regular Shift",
  closing: "Closing Shift",
};

export function databaseShiftToUi(
  value: string | null | undefined
): ScheduleShiftKind {
  if (value === "opening" || value === "closing") return value;
  return "regular";
}

export function uiShiftToDatabase(
  value: ScheduleShiftKind
): DatabaseScheduleShiftType {
  return value === "regular" ? "single" : value;
}

export function getScheduleShiftLabel(value: ScheduleShiftKind): string {
  return SHIFT_LABELS[value];
}

export function getDatabaseShiftLabel(
  value: string | null | undefined
): string {
  return getScheduleShiftLabel(databaseShiftToUi(value));
}
