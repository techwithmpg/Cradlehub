export type AttendanceDeviceBranchDecision =
  | "allowed"
  | "sync_device_branch"
  | "wrong_branch"
  | "staff_inactive";

export function getAttendanceDeviceBranchDecision(params: {
  qrBranchId: string;
  staffBranchId: string | null | undefined;
  deviceBranchId: string | null | undefined;
  staffIsActive: boolean;
  isCrossBranch?: boolean;
}): AttendanceDeviceBranchDecision {
  if (!params.staffIsActive) return "staff_inactive";

  const canUseQrBranch =
    params.staffBranchId === params.qrBranchId || params.isCrossBranch === true;
  if (!canUseQrBranch) return "wrong_branch";

  return params.deviceBranchId === params.qrBranchId ? "allowed" : "sync_device_branch";
}
