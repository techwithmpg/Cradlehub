import { describe, expect, it } from "vitest";
import {
  buildPaginationRange,
  classifyReviewIssueBucket,
  computeShiftProgressDetail,
  computeShiftProgressPercent,
  formatAttendanceRole,
  formatWorkedDuration,
  hasAuthorizedCorrectionPath,
  humanizeAttendanceText,
  resolveReviewSeverity,
} from "@/lib/attendance/crm-attendance-presenter";
import type { AttendanceReviewItem } from "@/lib/attendance/crm-review";

function mockReviewItem(overrides: {
  code?: string;
  exceptionType?: string;
  severity?: string;
  priority?: "critical" | "high" | "normal";
}): AttendanceReviewItem {
  return {
    id: "item-1",
    relatedExceptionIds: ["exc-1"],
    category: "clock",
    priority: overrides.priority ?? "normal",
    title: "Test issue",
    recommendedAction: "Fix",
    recurrenceCount: 1,
    recurrenceLabel: "1x",
    diagnostic: {
      code: overrides.code ?? "attendance_state_mismatch",
      category: "clock",
      resolutionKind: "correct_record",
      severity: "warning",
      attendanceChanged: false,
      resolutionOwner: "crm",
      staffTitle: "Title",
      staffMessage: "Msg",
      staffActionLabel: "Act",
      staffActionHref: "/staff",
      staffCanResolve: true,
      staffPrevention: "Prev",
      crmTitle: "CRM Title",
      crmSummary: "Summary",
      crmPrimaryAction: "Fix",
      crmInstruction: "Instr",
      immediateResolution: "Now",
      rootCause: "Root",
      preventionAction: "Act",
      preventionOwner: "crm",
      verification: "Ver",
    },
    exception: {
      id: "exc-1",
      branch_id: "b-1",
      staff_id: "s-1",
      checkin_id: null,
      scan_event_id: null,
      staff_name: "Staff Name",
      exception_type: overrides.exceptionType ?? "clock_out_missing",
      severity: overrides.severity ?? "high",
      status: "open",
      message: "Missing clock-out",
      metadata: {},
      detected_at: "2026-11-15T06:00:00Z",
      resolved_at: null,
    },
  };
}

describe("crm-attendance-presenter", () => {
  it("classifies review buckets cleanly", () => {
    expect(
      classifyReviewIssueBucket(mockReviewItem({ code: "stale_open_attendance", exceptionType: "clock_out_missing" }))
    ).toBe("unclosed");
    expect(
      classifyReviewIssueBucket(mockReviewItem({ code: "duplicate_scan", exceptionType: "duplicate_scan" }))
    ).toBe("duplicate_conflict");
    expect(
      classifyReviewIssueBucket(mockReviewItem({ code: "no_schedule_today", exceptionType: "missed_scan" }))
    ).toBe("missing_scan");
    expect(
      classifyReviewIssueBucket(mockReviewItem({ code: "phone_not_connected", exceptionType: "device_untrusted" }))
    ).toBe("other");
  });

  it("maps severities consistently", () => {
    expect(resolveReviewSeverity(mockReviewItem({ severity: "critical", priority: "critical" }))).toBe("critical");
    expect(resolveReviewSeverity(mockReviewItem({ severity: "high", priority: "high" }))).toBe("high");
    expect(resolveReviewSeverity(mockReviewItem({ severity: "low", priority: "normal" }))).toBe("low");
  });

  it("computes bounded shift progress percentage", () => {
    const start = "2026-11-15T02:00:00Z";
    const end = "2026-11-15T10:00:00Z";
    const midpoint = new Date("2026-11-15T06:00:00Z").getTime();
    expect(
      computeShiftProgressPercent({
        clockInAt: start,
        scheduledStartAt: start,
        scheduledEndAt: end,
        nowMs: midpoint,
      })
    ).toBe(50);

    const overdue = new Date("2026-11-15T14:00:00Z").getTime();
    expect(
      computeShiftProgressPercent({
        clockInAt: start,
        scheduledStartAt: start,
        scheduledEndAt: end,
        nowMs: overdue,
      })
    ).toBe(100);
  });

  it("builds compact pagination ranges with ellipsis", () => {
    expect(buildPaginationRange(1, 3)).toEqual([1, 2, 3]);
    expect(buildPaginationRange(1, 13)).toEqual([1, 2, "ellipsis", 13]);
    expect(buildPaginationRange(6, 13)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 13]);
  });

  it("formats roles and worked durations cleanly", () => {
    expect(formatAttendanceRole("nail_tech")).toBe("Nail Tech");
    expect(formatAttendanceRole("staff")).toBe("Therapist");
    expect(formatWorkedDuration(523)).toBe("8h 43m");
    expect(formatWorkedDuration(0)).toBe("—");
  });

  it("caps visual progress at 100% while surfacing overtime state", () => {
    const start = "2026-11-15T02:00:00Z";
    const end = "2026-11-15T10:00:00Z";
    const pastEnd = new Date("2026-11-15T10:45:00Z").getTime();
    expect(
      computeShiftProgressDetail({
        clockInAt: start,
        scheduledStartAt: start,
        scheduledEndAt: end,
        nowMs: pastEnd,
      })
    ).toEqual({
      percent: 100,
      isBeyondSchedule: true,
      overtimeMinutes: 45,
    });
  });

  it("replaces raw ISO timestamps inside CSR-facing messages and gates unlinked technical items", () => {
    const clean = humanizeAttendanceText(
      "Shift window 2026-11-15T02:00:00.000Z has no clock-out",
      "Asia/Manila"
    );
    expect(clean).not.toContain("2026-11-15T02:00:00.000Z");
    expect(clean).toContain("10:00 AM");

    const techOnly = mockReviewItem({});
    techOnly.category = "technical";
    techOnly.diagnostic.resolutionKind = "technical";
    expect(hasAuthorizedCorrectionPath(techOnly, false)).toBe(false);
    expect(hasAuthorizedCorrectionPath(mockReviewItem({}), false)).toBe(true);
  });
});
