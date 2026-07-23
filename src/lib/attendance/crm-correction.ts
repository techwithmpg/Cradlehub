import type { AttendanceRecord } from "@/lib/attendance/types";

export type AttendanceTimeCorrectionPreview = {
  changed: boolean;
  actionType: "set_manual_clock_in" | "set_manual_clock_out" | "correct_attendance_times";
  before: { clockIn: string; clockOut: string | null };
  after: { clockIn: string; clockOut: string | null };
};

export function buildAttendanceTimeCorrectionPreview(params: {
  record: Pick<AttendanceRecord, "checked_in_at" | "checked_out_at">;
  clockIn: string;
  clockOut: string | null;
}): AttendanceTimeCorrectionPreview {
  const clockInChanged = params.clockIn !== params.record.checked_in_at;
  const clockOutChanged = params.clockOut !== params.record.checked_out_at;
  return {
    changed: clockInChanged || clockOutChanged,
    actionType:
      clockInChanged && clockOutChanged
        ? "correct_attendance_times"
        : clockInChanged
          ? "set_manual_clock_in"
          : "set_manual_clock_out",
    before: { clockIn: params.record.checked_in_at, clockOut: params.record.checked_out_at },
    after: { clockIn: params.clockIn, clockOut: params.clockOut },
  };
}
