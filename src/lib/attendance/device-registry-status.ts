import type { AttendanceDeviceStatus } from "@/lib/attendance/types";

export function resolveDeviceRegistryStatus(params: {
  staffIsActive: boolean;
  hasPendingRecovery: boolean;
  hasDevice: boolean;
  deviceStatus: "active" | "revoked" | null;
  totalSuccessfulScans: number;
}): AttendanceDeviceStatus {
  if (!params.staffIsActive) return "inactive_staff";
  if (params.hasPendingRecovery) return "recovery_pending";
  if (!params.hasDevice) return "no_device";
  if (params.deviceStatus === "revoked") return "revoked";
  if (params.totalSuccessfulScans === 0) return "never_used";
  return "active";
}
