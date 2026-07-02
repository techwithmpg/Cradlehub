import type { AttendanceTab } from "@/lib/attendance/types";

export const ATTENDANCE_TAB_VALUES: AttendanceTab[] = [
  "overview",
  "records",
  "sessions",
  "qr",
  "devices",
  "exceptions",
  "reports",
];

export function isAttendanceTab(value: string | null | undefined): value is AttendanceTab {
  return ATTENDANCE_TAB_VALUES.includes(value as AttendanceTab);
}

export function parseAttendanceTab(value: string | string[] | null | undefined): AttendanceTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isAttendanceTab(candidate) ? candidate : "overview";
}

export function attendanceTabHref(tab: AttendanceTab): string {
  return `/crm/attendance?tab=${tab}`;
}
