import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ATTENDANCE_MAINTENANCE_ACTION_MESSAGE,
  AttendanceMaintenanceError,
  assertAttendanceWritable,
  createAttendanceMaintenanceResult,
  getAttendanceMaintenanceState,
  isAttendanceMaintenanceMode,
} from "@/lib/attendance/maintenance-mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Attendance maintenance mode", () => {
  it("is disabled by default and only enables for an explicit true value", () => {
    expect(getAttendanceMaintenanceState({}).active).toBe(false);
    expect(isAttendanceMaintenanceMode({ ATTENDANCE_MAINTENANCE_MODE: "false" })).toBe(false);
    expect(isAttendanceMaintenanceMode({ ATTENDANCE_MAINTENANCE_MODE: "1" })).toBe(false);
    expect(isAttendanceMaintenanceMode({ ATTENDANCE_MAINTENANCE_MODE: " TRUE " })).toBe(true);
  });

  it("supports server-configured public copy without exposing the control value", () => {
    const state = getAttendanceMaintenanceState({
      ATTENDANCE_MAINTENANCE_MODE: "true",
      ATTENDANCE_MAINTENANCE_TITLE: "Planned Attendance pause",
      ATTENDANCE_MAINTENANCE_MESSAGE: "Use the front desk log for now.",
    });

    expect(state).toMatchObject({
      active: true,
      title: "Planned Attendance pause",
      message: "Use the front desk log for now.",
    });
    expect(JSON.stringify(state)).not.toContain("ATTENDANCE_MAINTENANCE_MODE");
  });

  it("blocks writes while enabled and restores the normal path when disabled", () => {
    expect(() => assertAttendanceWritable({ ATTENDANCE_MAINTENANCE_MODE: "true" })).toThrow(
      AttendanceMaintenanceError
    );
    expect(() => assertAttendanceWritable({ ATTENDANCE_MAINTENANCE_MODE: "false" })).not.toThrow();
  });

  it("returns a typed no-change result with no incident, CRM, or technical routing", () => {
    vi.stubEnv("ATTENDANCE_MAINTENANCE_MODE", "true");
    const result = createAttendanceMaintenanceResult({
      operationId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toMatchObject({
      ok: false,
      outcome: "noop",
      reasonCode: "attendance_maintenance",
      securityNote: "Attendance changed: No",
      recoverable: false,
      resolution: {
        attendanceChanged: false,
        incidentRequired: false,
        crmActionRequired: false,
        technicalSupportRequired: false,
        staffActionRequired: false,
        canRetry: false,
      },
    });
    expect(result.message).toContain("front desk");
    expect(result.detail).toContain("Do not scan repeatedly");

    const publicPayload = JSON.stringify(result);
    for (const secret of [
      "ATTENDANCE_MAINTENANCE_MODE",
      "SUPABASE_SERVICE_ROLE_KEY",
      "commit_attendance_scan_transaction",
      "rpc(",
      "stack",
    ]) {
      expect(publicPayload).not.toContain(secret);
    }
  });

  it("uses a calm action error instead of a generic technical failure", () => {
    vi.stubEnv("ATTENDANCE_MAINTENANCE_MODE", "true");
    expect(() => assertAttendanceWritable()).toThrow(ATTENDANCE_MAINTENANCE_ACTION_MESSAGE);
  });
});
