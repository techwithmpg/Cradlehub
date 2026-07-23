import { describe, expect, it } from "vitest";
import { buildAttendanceTimeCorrectionPreview } from "@/lib/attendance/crm-correction";

const record = { checked_in_at: "2026-07-22T01:00:00.000Z", checked_out_at: null };

describe("Attendance correction preview", () => {
  it("chooses a focused action when one value changes", () => {
    expect(
      buildAttendanceTimeCorrectionPreview({
        record,
        clockIn: record.checked_in_at,
        clockOut: "2026-07-22T09:00:00.000Z",
      }).actionType
    ).toBe("set_manual_clock_out");
  });

  it("uses the combined correction when both values change", () => {
    const preview = buildAttendanceTimeCorrectionPreview({
      record,
      clockIn: "2026-07-22T02:00:00.000Z",
      clockOut: "2026-07-22T10:00:00.000Z",
    });
    expect(preview.actionType).toBe("correct_attendance_times");
    expect(preview.changed).toBe(true);
  });
});
