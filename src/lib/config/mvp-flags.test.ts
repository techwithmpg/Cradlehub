import { describe, expect, it } from "vitest";
import {
  getRetainedWorkspaceRollout,
  isAttendanceEnforcementEnabled,
  isAttendanceScanningEnabled,
  isRetainedWorkspaceEnabled,
} from "@/lib/config/mvp-flags";

describe("Attendance launch configuration", () => {
  it("enables enforcement only for an explicit enabled value", () => {
    expect(isAttendanceEnforcementEnabled({
      NEXT_PUBLIC_ATTENDANCE_ENFORCEMENT_ENABLED: "true",
    })).toBe(true);
    expect(isAttendanceEnforcementEnabled({
      NEXT_PUBLIC_ATTENDANCE_ENFORCEMENT_ENABLED: "1",
    })).toBe(true);
  });

  it("keeps enforcement paused when disabled or missing", () => {
    expect(isAttendanceEnforcementEnabled({
      NEXT_PUBLIC_ATTENDANCE_ENFORCEMENT_ENABLED: "false",
    })).toBe(false);
    expect(isAttendanceEnforcementEnabled({})).toBe(false);
  });

  it("allows scanning to be explicitly disabled", () => {
    expect(isAttendanceScanningEnabled({
      NEXT_PUBLIC_ATTENDANCE_SCANNING_ENABLED: "false",
    })).toBe(false);
    expect(isAttendanceScanningEnabled({})).toBe(true);
  });
});

describe("Retained workspace rollout", () => {
  it("defaults safely to CRM-first and keeps Owner opt-in", () => {
    expect(getRetainedWorkspaceRollout({})).toBe("crm");
    expect(isRetainedWorkspaceEnabled("crm", {})).toBe(true);
    expect(isRetainedWorkspaceEnabled("owner", {})).toBe(false);
  });

  it("supports full rollout and immediate rollback", () => {
    expect(isRetainedWorkspaceEnabled("owner", {
      NEXT_PUBLIC_RETAINED_WORKSPACES: "all",
    })).toBe(true);
    expect(isRetainedWorkspaceEnabled("crm", {
      NEXT_PUBLIC_RETAINED_WORKSPACES: "off",
    })).toBe(false);
  });
});
