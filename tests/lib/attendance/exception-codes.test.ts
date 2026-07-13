import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_DB_EXCEPTION_TYPES,
  attendanceExceptionMetadata,
  getInternalAttendanceExceptionType,
  toAttendanceDbExceptionType,
} from "@/lib/attendance/exception-codes";

const attendanceQrMigrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260702075213_attendance_qr_system.sql"),
  "utf8"
);

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

  it("keeps mapped database exception values inside the migration constraint", () => {
    for (const dbType of ATTENDANCE_DB_EXCEPTION_TYPES) {
      expect(attendanceQrMigrationSql).toContain(`'${dbType}'`);
    }

    [
      "missing_schedule",
      "off_day_exception",
      "ambiguous_scan",
      "late_clock_in",
      "early_clock_in",
      "early_clock_out",
      "overtime_clock_out",
      "stale_open_checkin",
      "conflicting_open_checkin",
      "active_service",
    ].forEach((internalType) => {
      const dbType = toAttendanceDbExceptionType(internalType);
      expect(ATTENDANCE_DB_EXCEPTION_TYPES).toContain(dbType);
      expect(attendanceQrMigrationSql).toContain(`'${dbType}'`);
    });
  });
});
