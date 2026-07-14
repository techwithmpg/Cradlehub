export const ACTIVE_ATTENDANCE_DEVICE_LIMIT = 2;

export type AttendanceDeviceRole = "primary" | "secondary";

export function nextAttendanceDeviceRole(hasActivePrimary: boolean): AttendanceDeviceRole {
  return hasActivePrimary ? "secondary" : "primary";
}
