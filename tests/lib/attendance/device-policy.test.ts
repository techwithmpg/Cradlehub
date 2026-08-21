import { describe, expect, it } from "vitest";

import {
  ACTIVE_ATTENDANCE_DEVICE_LIMIT,
  evaluateAttendanceDeviceRegistration,
} from "@/lib/attendance/device-policy";

describe("Attendance device registration policy", () => {
  it("allows a primary device when there are no active devices", () => {
    expect(evaluateAttendanceDeviceRegistration({ activeDevices: [] })).toEqual({
      allowed: true,
      role: "primary",
      effectiveActiveCount: 0,
    });
  });

  it("assigns secondary after an active primary", () => {
    expect(
      evaluateAttendanceDeviceRegistration({
        activeDevices: [{ id: "device-primary", device_role: "primary" }],
      })
    ).toEqual({
      allowed: true,
      role: "secondary",
      effectiveActiveCount: 1,
    });
  });

  it("blocks a third active device at the shared limit", () => {
    const policy = evaluateAttendanceDeviceRegistration({
      activeDevices: [
        { id: "device-primary", device_role: "primary" },
        { id: "device-secondary", device_role: "secondary" },
      ],
    });

    expect(ACTIVE_ATTENDANCE_DEVICE_LIMIT).toBe(2);
    expect(policy).toEqual({
      allowed: false,
      reasonCode: "device_limit_reached",
      effectiveActiveCount: 2,
    });
  });

  it("allows a reviewed replacement without increasing the effective active count", () => {
    expect(
      evaluateAttendanceDeviceRegistration({
        activeDevices: [
          { id: "device-primary", device_role: "primary" },
          { id: "device-secondary", device_role: "secondary" },
        ],
        replacementDeviceId: "device-secondary",
      })
    ).toEqual({
      allowed: true,
      role: "secondary",
      effectiveActiveCount: 1,
    });
  });
});
