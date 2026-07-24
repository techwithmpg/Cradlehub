import { describe, expect, it } from "vitest";
import {
  buildStaffAttendanceIssueGuide,
  isStaffDeviceSignInReason,
} from "@/lib/attendance/staff-self-service";

describe("staff Attendance self-service guidance", () => {
  it.each([
    "unknown_device",
    "missing_device",
    "device_not_registered",
    "device_cookie_missing",
    "device_cookie_expired",
    "browser_data_cleared",
    "device_recovery_required",
    "unregistered_device",
  ])("routes %s to staff sign-in", (reasonCode) => {
    expect(isStaffDeviceSignInReason(reasonCode)).toBe(true);
  });

  it("guides an unknown phone to the phone instructions", () => {
    const guide = buildStaffAttendanceIssueGuide({
      id: "issue-1",
      exception_type: "unknown_device",
      message: "An unregistered device scanned Attendance.",
    });
    expect(guide.kind).toBe("phone");
    expect(guide.staffCanComplete).toBe(true);
    expect(guide.actionHref).toContain("attendance-phone");
  });

  it("guides schedule mismatches to a staff response", () => {
    const guide = buildStaffAttendanceIssueGuide({
      id: "issue-2",
      exception_type: "manual",
      message: "The open record did not match the current schedule.",
      metadata: { internalExceptionType: "missing_schedule" },
    });
    expect(guide.kind).toBe("schedule");
    expect(guide.actionHref).toBe("/staff-portal/notifications");
  });

  it("keeps revoked phones under CRM approval", () => {
    const guide = buildStaffAttendanceIssueGuide({
      id: "issue-3",
      exception_type: "revoked_device",
      message: "The phone is revoked.",
    });
    expect(guide.staffCanComplete).toBe(false);
    expect(guide.waitingForCrm).toBe(true);
  });

  it("guides repeated scans to scan confirmation", () => {
    const guide = buildStaffAttendanceIssueGuide({
      id: "issue-4",
      exception_type: "duplicate_scan",
      message: "The staff member scanned again.",
    });
    expect(guide.kind).toBe("scan");
    expect(guide.actionLabel).toContain("scan");
  });
});
