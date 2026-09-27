import "server-only";

import { getAttendanceSettingsReadOnly } from "@/lib/attendance/queries";
import { getAttendanceBranchNow } from "@/lib/attendance/shift-instance";

/**
 * Resolves the authoritative business/operational date (YYYY-MM-DD) for a branch.
 * Reuses existing Attendance timezone and day boundary configuration.
 *
 * Throws explicitly on database read failure or missing branchId so callers
 * do not silently mask backend failure into default dates.
 */
export async function getProviderBusinessDate(
  branchId?: string | null,
  now?: Date
): Promise<string> {
  const normalizedBranchId = branchId?.trim();
  if (!normalizedBranchId) {
    throw new Error("Provider has no assigned branch for operational date resolution");
  }

  // getAttendanceSettingsReadOnly already provides normalized in-memory default settings
  // when the database row is legitimately absent. It only throws on genuine database/query failure.
  const settings = await getAttendanceSettingsReadOnly(normalizedBranchId);
  const branchNow = getAttendanceBranchNow(settings, now);

  return branchNow.businessDate;
}
