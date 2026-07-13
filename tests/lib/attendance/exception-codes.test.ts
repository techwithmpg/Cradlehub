import { describe, expect, it } from "vitest";
import {
  attendanceExceptionMetadata,
  getInternalAttendanceExceptionType,
  toAttendanceDbExceptionType,
} from "@/lib/attendance/exception-codes";

describe("attendance exception code mapping", () => {
  it("maps internal scan reasons to stable database exception types", () => {
    expect(toAttendanceDbExceptionType("missing_schedule")).toBe("unscheduled");
    expect(toAttendanceDbExceptionType("off_day_exception")).toBe("unscheduled");
    expect(toAttendanceDbExceptionType("late_clock_in")).toBe("late");
    expect(toAttendanceDbExceptionType("early_clock_out")).toBe("early_leave");
    expect(toAttendanceDbExceptionType("overtime_clock_out")).toBe("overtime");
    expect(toAttendanceDbExceptionType("likely_closing_scan_without_clock_in")).toBe("missed_checkout");
    expect(toAttendanceDbExceptionType("ambiguous_scan")).toBe("manual");
    expect(toAttendanceDbExceptionType("active_service")).toBe("active_service");
  });

  it("preserves the internal reason in metadata for Recovery screens", () => {
    const metadata = attendanceExceptionMetadata({
      internalType: "likely_closing_scan_without_clock_in",
      metadata: { scannedAt: "2026-07-13T01:00:00.000Z" },
    });

    expect(metadata).toMatchObject({
      internalExceptionType: "likely_closing_scan_without_clock_in",
      dbExceptionType: "missed_checkout",
      scannedAt: "2026-07-13T01:00:00.000Z",
    });
    expect(
      getInternalAttendanceExceptionType({
        exception_type: "missed_checkout",
        metadata,
      })
    ).toBe("likely_closing_scan_without_clock_in");
  });
});
