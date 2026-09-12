import "server-only";

import { getAttendanceSettingsReadOnly } from "@/lib/attendance/queries";
import { getAttendanceBranchNow } from "@/lib/attendance/shift-instance";

const DEFAULT_TIMEZONE = "Asia/Manila";
const DEFAULT_BOUNDARY = "06:00:00";

/**
 * Resolves the authoritative business/operational date (YYYY-MM-DD) for a branch.
 * Reuses existing Attendance timezone and day boundary configuration.
 */
export async function getProviderBusinessDate(
  branchId?: string | null,
  now?: Date
): Promise<string> {
  const settings = branchId
    ? await getAttendanceSettingsReadOnly(branchId).catch(() => null)
    : null;

  const branchNow = getAttendanceBranchNow(
    settings ?? { timezone: DEFAULT_TIMEZONE, attendance_day_boundary: DEFAULT_BOUNDARY },
    now
  );

  return branchNow.businessDate;
}
