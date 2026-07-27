import "server-only";

import {
  isAttendanceEnforcementEnabled,
  isAttendanceScanningEnabled,
} from "@/lib/config/mvp-flags";
import { isAttendanceMaintenanceMode } from "@/lib/attendance/maintenance-mode";

export type AttendanceLaunchStatus = {
  scanningEnabled: boolean;
  enforcementEnabled: boolean;
  closingAutomationVerified: boolean;
  maintenanceActive: boolean;
};

export function getAttendanceLaunchStatus(): AttendanceLaunchStatus {
  const maintenanceActive = isAttendanceMaintenanceMode();
  return {
    scanningEnabled: !maintenanceActive && isAttendanceScanningEnabled(),
    enforcementEnabled: !maintenanceActive && isAttendanceEnforcementEnabled(),
    closingAutomationVerified:
      process.env.ATTENDANCE_CLOSING_AUTOMATION_VERIFIED?.trim().toLowerCase() === "true",
    maintenanceActive,
  };
}
