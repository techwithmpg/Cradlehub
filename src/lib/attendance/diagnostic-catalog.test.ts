import { describe, expect, it } from "vitest";
import { recurrenceLevel, resolveAttendanceDiagnostic } from "@/lib/attendance/diagnostic-catalog";
import type { AttendanceException } from "@/lib/attendance/types";

function issue(overrides: Partial<AttendanceException>): AttendanceException {
  return {
    id: "issue-1",
    branch_id: "branch-1",
    staff_id: "staff-1",
    checkin_id: null,
    scan_event_id: "scan-1",
    staff_name: "Melrose",
    exception_type: "manual",
    severity: "warning",
    status: "open",
    message: "Attendance needs review.",
    metadata: {},
    detected_at: "2026-07-24T14:00:00.000Z",
    resolved_at: null,
    ...overrides,
  };
}

describe("Attendance diagnostic catalogue", () => {
  it("turns an unknown-device scan into guided browser connection", () => {
    const diagnostic = resolveAttendanceDiagnostic({
      exception: issue({ exception_type: "unknown_device" }),
    });

    expect(diagnostic.code).toBe("phone_not_connected");
    expect(diagnostic.staffActionLabel).toBe("Connect this browser");
    expect(diagnostic.resolutionOwner).toBe("staff");
  });

  it("recognizes repeated scans after a closed shift", () => {
    const diagnostic = resolveAttendanceDiagnostic({
      exception: issue({
        message: "Melrose scanned again after this attendance shift was closed.",
      }),
    });

    expect(diagnostic.code).toBe("scan_after_clock_out");
    expect(diagnostic.crmPrimaryAction).toBe("Ignore duplicate");
  });

  it("recognizes the historical state-mismatch wording", () => {
    const diagnostic = resolveAttendanceDiagnostic({
      exception: issue({
        message:
          "The sole open attendance record was closed even though it did not match the saved scan.",
      }),
    });

    expect(diagnostic.code).toBe("attendance_state_mismatch");
    expect(diagnostic.resolutionOwner).toBe("technical_support");
  });

  it("routes private-browser recovery to staff guidance", () => {
    const diagnostic = resolveAttendanceDiagnostic({
      exception: issue({ safe_error_code: "private_browser" }),
    });

    expect(diagnostic.code).toBe("private_browser_detected");
    expect(diagnostic.staffCanResolve).toBe(true);
    expect(diagnostic.preventionAction).toContain("normal browser");
  });

  it("keeps split-shift gaps distinct from generic schedule issues", () => {
    const diagnostic = resolveAttendanceDiagnostic({
      exception: issue({ safe_error_code: "split_shift_gap" }),
    });

    expect(diagnostic.code).toBe("split_shift_gap");
    expect(diagnostic.crmPrimaryAction).toBe("Approve extra shift window");
  });

  it("routes missing database functions to permanent technical repair", () => {
    const diagnostic = resolveAttendanceDiagnostic({
      exception: issue({ safe_error_code: "database_function_missing" }),
    });

    expect(diagnostic.code).toBe("database_function_missing");
    expect(diagnostic.preventionOwner).toBe("technical_support");
    expect(diagnostic.verification).toContain("RPC signature");
  });

  it("requires atomic prevention for multiple active records", () => {
    const diagnostic = resolveAttendanceDiagnostic({
      exception: issue({ safe_error_code: "multiple_open_attendance_records" }),
    });

    expect(diagnostic.code).toBe("multiple_open_records");
    expect(diagnostic.preventionAction).toContain("atomic RPCs");
  });

  it("escalates recurring patterns into prevention follow-up", () => {
    expect(recurrenceLevel(1).requiresFollowUp).toBe(false);
    expect(recurrenceLevel(3).label).toBe("Third occurrence");
    expect(recurrenceLevel(4).requiresFollowUp).toBe(true);
  });
});
