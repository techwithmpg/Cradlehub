import { describe, expect, it } from "vitest";
import { classifyAttendanceScanResult } from "@/lib/attendance/scan-resolution";
import type { PublicScanResult } from "@/lib/attendance/types";

function failure(reasonCode: string): PublicScanResult {
  return { ok: false, outcome: "blocked", reasonCode, title: "legacy", message: "raw must not win", operationId: "op-safe" };
}

describe("Attendance scan resolution", () => {
  it.each([
    ["wrong_branch", "branch", true], ["missing_schedule", "schedule", true],
    ["schedule_conflict", "schedule", true], ["off_day_scan", "schedule", true],
    ["device_limit_reached", "device", true], ["device_not_registered", "device", true],
    ["DEVICE_REVOKED", "security", true], ["active_service", "booking_or_service", false],
    ["duplicate_scan", "duplicate", false], ["ATTENDANCE_RLS_DENIED", "technical", true],
    ["ATTENDANCE_RPC_MISSING", "technical", true], ["unmapped_failure", "technical", true],
  ] as const)("classifies %s", (code, category, incidentRequired) => {
    const resolution = classifyAttendanceScanResult(failure(code));
    expect(resolution.category).toBe(category);
    expect(resolution.incidentRequired).toBe(incidentRequired);
    expect(resolution.attendanceChanged).toBe(false);
    expect(resolution.operationId).toBe("op-safe");
  });

  it("does not create an incident for a harmless committed duplicate", () => {
    const resolution = classifyAttendanceScanResult(failure("duplicate_scan"));
    expect(resolution.title).toBe("Attendance already recorded");
    expect(resolution.crmActionRequired).toBe(false);
    expect(resolution.technicalSupportRequired).toBe(false);
  });

  it("assigns successful review writes to CRM without asking staff to act", () => {
    const resolution = classifyAttendanceScanResult({
      ok: true,
      outcome: "success",
      reasonCode: "ambiguous_scan",
      severity: "warning",
      title: "You’re clocked in, Nikki 🌿",
      message: "This scan was outside your schedule, so the front desk will review it.",
      reviewLabel: "Recorded · Outside schedule",
      attendance: {
        action: "clock_in",
        staffName: "Nicole Santos",
        branchName: "Cradle Main",
        branchTimezone: "Asia/Manila",
        shiftLabel: "single",
        occurredAt: "2026-07-15T06:14:00.000Z",
        sessionStartedAt: "2026-07-15T06:14:00.000Z",
      },
    });

    expect(resolution.attendanceChanged).toBe(true);
    expect(resolution.staffActionRequired).toBe(false);
    expect(resolution.crmActionRequired).toBe(true);
    expect(resolution.canRetry).toBe(false);
  });

  it("assigns a captured closing scan to CRM without marking it as a failure", () => {
    const resolution = classifyAttendanceScanResult({
      ok: true,
      outcome: "exception",
      reasonCode: "likely_closing_scan_without_clock_in",
      severity: "warning",
      title: "Scan captured, Nikki",
      message: "The front desk will confirm today’s attendance. You may continue normally.",
      reviewLabel: "Captured · For review",
    });

    expect(resolution.attendanceChanged).toBe(false);
    expect(resolution.staffActionRequired).toBe(false);
    expect(resolution.crmActionRequired).toBe(true);
    expect(resolution.technicalSupportRequired).toBe(false);
  });
});
