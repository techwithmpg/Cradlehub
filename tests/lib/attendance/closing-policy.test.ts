import { describe, expect, it } from "vitest";

import {
  classifyClosingClockOut,
  deriveAttendanceClosingTimeline,
  resolveAttendancePolicy,
  resolveAttendanceStaffCategory,
  type ClosingPolicySettings,
} from "@/lib/attendance/closing-policy";
import { computeAttendanceMetrics } from "@/lib/attendance/time";

const settings: ClosingPolicySettings = {
  timezone: "Asia/Manila",
  late_grace_minutes: 10,
  early_leave_threshold_minutes: 5,
  overtime_threshold_minutes: 15,
  active_service_blocks_clock_out: true,
  crm_closing_policy_enabled: true,
  branch_operating_close_time: "22:30:00",
  crm_closing_buffer_minutes: 30,
  crm_manager_escalation_delay_minutes: 30,
  crm_hard_cutoff_delay_minutes: 60,
};

describe("CRM closing Attendance policy", () => {
  it.each(["crm", "csr", "csr_head", "csr_staff"])(
    "canonicalizes %s to the CRM/front-desk category",
    (systemRole) => {
      expect(resolveAttendanceStaffCategory({ systemRole, staffType: "other" })).toBe(
        "crm_front_desk"
      );
    }
  );

  it("uses staff_type csr as a legacy front-desk fallback", () => {
    expect(resolveAttendanceStaffCategory({ systemRole: "staff", staffType: "csr" })).toBe(
      "crm_front_desk"
    );
  });

  it.each([
    ["staff", "therapist", "therapists"],
    ["staff", "aesthetician", "salon"],
    ["staff", "nail_tech", "salon"],
    ["service_head", "salon_head", "salon"],
    ["driver", "driver", "drivers"],
    ["utility", "utility", "utility"],
    ["manager", "managerial", "managers"],
    ["staff", "unknown", "other"],
  ])("maps %s/%s to %s", (systemRole, staffType, expected) => {
    expect(resolveAttendanceStaffCategory({ systemRole, staffType })).toBe(expected);
  });

  it.each(["single", "regular", "opening"])(
    "does not apply the special policy to CRM %s shifts",
    (shiftType) => {
      const policy = resolveAttendancePolicy({
        settings,
        systemRole: "crm",
        staffType: "csr",
        shiftType,
        businessDate: "2026-07-14",
        scheduledEndAt: "2026-07-14T17:30:00.000Z",
      });
      expect(policy.kind).toBe("schedule");
      expect(policy.expectedEndAt).toBe("2026-07-14T17:30:00.000Z");
    }
  );

  it.each([
    ["staff", "therapist"],
    ["staff", "nail_tech"],
    ["driver", "driver"],
    ["utility", "utility"],
    ["manager", "managerial"],
  ])("keeps non-CRM closing staff schedule-based for %s/%s", (systemRole, staffType) => {
    const policy = resolveAttendancePolicy({
      settings,
      systemRole,
      staffType,
      shiftType: "closing",
      businessDate: "2026-07-14",
      scheduledEndAt: "2026-07-14T17:30:00.000Z",
    });
    expect(policy.kind).toBe("schedule");
    expect(policy.latestNormalClockOutAt).toBeNull();
  });

  it("derives the default 10:30 PM to midnight intervention timeline", () => {
    expect(
      deriveAttendanceClosingTimeline({
        businessDate: "2026-07-14",
        timezone: "Asia/Manila",
        branchCloseTime: "22:30:00",
        normalBufferMinutes: 30,
        managerEscalationDelayMinutes: 30,
        hardCutoffDelayMinutes: 60,
      })
    ).toEqual({
      branchCloseAt: "2026-07-14T14:30:00.000Z",
      earliestNormalClockOutAt: "2026-07-14T14:30:00.000Z",
      latestNormalClockOutAt: "2026-07-14T15:00:00.000Z",
      reminderAt: "2026-07-14T15:00:00.000Z",
      managerEscalationAt: "2026-07-14T15:30:00.000Z",
      hardCutoffAt: "2026-07-14T16:00:00.000Z",
      provisionalClockOutAt: "2026-07-14T15:00:00.000Z",
    });
  });

  it("uses timezone-aware branch instants outside Manila", () => {
    const timeline = deriveAttendanceClosingTimeline({
      businessDate: "2026-11-01",
      timezone: "America/New_York",
      branchCloseTime: "22:30:00",
      normalBufferMinutes: 30,
      managerEscalationDelayMinutes: 30,
      hardCutoffDelayMinutes: 60,
    });
    expect(timeline.branchCloseAt).toBe("2026-11-02T03:30:00.000Z");
    expect(timeline.hardCutoffAt).toBe("2026-11-02T05:00:00.000Z");
  });

  it("keeps the raw overnight assigned schedule separate from the expected end", () => {
    const rawScheduledEndAt = "2026-07-14T17:30:00.000Z";
    const policy = resolveAttendancePolicy({
      settings,
      systemRole: "crm",
      staffType: "csr",
      shiftType: "closing",
      businessDate: "2026-07-14",
      scheduledEndAt: rawScheduledEndAt,
    });
    expect(rawScheduledEndAt).toBe("2026-07-14T17:30:00.000Z");
    expect(policy.expectedEndAt).toBe("2026-07-14T15:00:00.000Z");
  });

  it("allows an effective category override to disable CRM closing policy", () => {
    const policy = resolveAttendancePolicy({
      settings,
      categoryRule: { crm_closing_policy_enabled: false },
      systemRole: "crm",
      staffType: "csr",
      shiftType: "closing",
      businessDate: "2026-07-14",
      scheduledEndAt: "2026-07-14T17:30:00.000Z",
    });
    expect(policy.kind).toBe("schedule");
  });

  it.each([
    ["2026-07-14T14:29:59.999Z", "early"],
    ["2026-07-14T14:30:00.000Z", "normal"],
    ["2026-07-14T14:45:00.000Z", "normal"],
    ["2026-07-14T15:00:00.000Z", "normal"],
    ["2026-07-14T15:00:00.001Z", "overtime"],
  ])("classifies the closing boundary at %s as %s", (clockOutAt, expected) => {
    expect(
      classifyClosingClockOut({
        clockOutAt,
        earliestNormalClockOutAt: "2026-07-14T14:30:00.000Z",
        latestNormalClockOutAt: "2026-07-14T15:00:00.000Z",
      })
    ).toBe(expected);
  });

  it.each([
    ["2026-07-14T14:15:00.000Z", 15, 0],
    ["2026-07-14T14:30:00.000Z", 0, 0],
    ["2026-07-14T14:45:00.000Z", 0, 0],
    ["2026-07-14T15:00:00.000Z", 0, 0],
    ["2026-07-14T15:15:00.000Z", 0, 15],
  ])(
    "computes operational early/overtime at %s without using the raw 1:30 AM schedule end",
    (checkedOutAt, earlyLeaveMinutes, overtimeMinutes) => {
      const metrics = computeAttendanceMetrics({
        checkedInAt: "2026-07-14T09:00:00.000Z",
        checkedOutAt,
        scheduledStartAt: "2026-07-14T09:00:00.000Z",
        scheduledEndAt: "2026-07-14T17:30:00.000Z",
        earliestNormalClockOutAt: "2026-07-14T14:30:00.000Z",
        latestNormalClockOutAt: "2026-07-14T15:00:00.000Z",
        lateGraceMinutes: 10,
        earlyLeaveGraceMinutes: 5,
      });
      expect(metrics.earlyLeaveMinutes).toBe(earlyLeaveMinutes);
      expect(metrics.overtimeMinutes).toBe(overtimeMinutes);
    }
  );
});
