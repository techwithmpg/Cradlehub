export const ACTIVE_ATTENDANCE_DEVICE_LIMIT = 2;

export type AttendanceDeviceRole = "primary" | "secondary";

export type ActiveAttendanceDevice = {
  id: string;
  device_role?: string | null;
};

export type AttendanceDeviceRegistrationPolicy =
  | {
      allowed: true;
      role: AttendanceDeviceRole;
      effectiveActiveCount: number;
    }
  | {
      allowed: false;
      reasonCode: "device_limit_reached";
      effectiveActiveCount: number;
    };

export function nextAttendanceDeviceRole(hasActivePrimary: boolean): AttendanceDeviceRole {
  return hasActivePrimary ? "secondary" : "primary";
}

export function evaluateAttendanceDeviceRegistration(input: {
  activeDevices: ActiveAttendanceDevice[];
  replacementDeviceId?: string | null;
}): AttendanceDeviceRegistrationPolicy {
  const replacesActiveDevice = Boolean(
    input.replacementDeviceId &&
    input.activeDevices.some((device) => device.id === input.replacementDeviceId)
  );
  const effectiveActiveCount = input.activeDevices.length - (replacesActiveDevice ? 1 : 0);

  if (effectiveActiveCount >= ACTIVE_ATTENDANCE_DEVICE_LIMIT) {
    return {
      allowed: false,
      reasonCode: "device_limit_reached",
      effectiveActiveCount,
    };
  }

  return {
    allowed: true,
    role: nextAttendanceDeviceRole(
      input.activeDevices.some((device) => device.device_role === "primary")
    ),
    effectiveActiveCount,
  };
}
