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
    // Deployment configuration is not proof that pg_cron jobs exist or ran.
    // Keep this unverified until a database-backed health check supplies evidence.
    closingAutomationVerified: false,
  };
}
