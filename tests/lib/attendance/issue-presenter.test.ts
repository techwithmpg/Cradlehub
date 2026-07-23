import { describe, expect, it } from "vitest";
import { presentAttendanceIssue } from "@/lib/attendance/issue-presenter";

describe("Attendance issue presenter", () => {
  it.each([
    ["device_not_registered", "phone_not_connected", "Connect Phone"],
    ["revoked_device", "phone_revoked", "Connect Replacement Phone"],
    ["wrong_branch", "wrong_branch", "Approve Temporary Assignment"],
    ["missing_schedule", "no_schedule", "Open Staff Schedule"],
    ["early_clock_in", "scan_too_early", "Ask Staff to Wait"],
    ["late_clock_in", "scan_too_late", "Record for Review"],
    ["stale_open_checkin", "stale_open_attendance", "Review Previous Record"],
    ["duplicate_scan", "duplicate_scan", "Ask Staff to Wait"],
    ["likely_closing_scan_without_clock_in", "clock_out_review", "Correct Today’s Attendance"],
    ["branch_assignment_issue", "branch_assignment_review", "View Branch History"],
    ["device_limit_reached", "device_limit_reached", "Review Connected Phones"],
    ["inactive_staff", "inactive_staff", "Review Staff Access"],
    ["new_backend_code", "unknown_issue", "Open Fix Scan Problems"],
  ])("presents %s without exposing it as the title", (code, category, actionLabel) => {
    const result = presentAttendanceIssue({ technicalCodes: [code] });
    expect(result?.category).toBe(category);
    expect(result?.recommendedAction.label).toBe(actionLabel);
    expect(result?.title).not.toBe(code);
    expect(result?.technicalCode).toBe(code);
  });

  it("derives phone and schedule problems from existing authoritative states", () => {
    expect(
      presentAttendanceIssue({ technicalCodes: [], deviceStatus: "no_device", phoneRelevant: true })
        ?.category
    ).toBe("phone_not_connected");
    expect(presentAttendanceIssue({ technicalCodes: [], deviceStatus: "revoked" })?.category).toBe(
      "phone_revoked"
    );
    expect(
      presentAttendanceIssue({ technicalCodes: [], scheduleState: "schedule_missing" })?.category
    ).toBe("no_schedule");
  });

  it("does not invent a problem for a clean connected staff state", () => {
    expect(
      presentAttendanceIssue({
        technicalCodes: [],
        deviceStatus: "active",
        operationalStatus: "clocked_in",
      })
    ).toBeNull();
  });
});
