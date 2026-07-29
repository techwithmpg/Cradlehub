import "server-only";

import {
  isAttendanceEnforcementEnabled,
  isAttendanceScanningEnabled,
} from "@/lib/config/mvp-flags";

export type AttendanceLaunchStatus = {
  scanningEnabled: boolean;
  enforcementEnabled: boolean;
  closingAutomationVerified: boolean;
};

export function getAttendanceLaunchStatus(): AttendanceLaunchStatus {
  return {
    scanningEnabled: isAttendanceScanningEnabled(),
    enforcementEnabled: isAttendanceEnforcementEnabled(),
    closingAutomationVerified:
      process.env.ATTENDANCE_CLOSING_AUTOMATION_VERIFIED?.trim().toLowerCase() === "true",
  };
}
