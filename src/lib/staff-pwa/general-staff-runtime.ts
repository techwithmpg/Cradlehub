import "server-only";

import { getMyProfileAction } from "@/app/(dashboard)/staff-portal/actions";
import { getMyAttendanceData } from "@/lib/staff-portal/attendance";

export async function getGeneralStaffRuntimeData() {
  const [profileResult, attendanceData] =
    await Promise.all([
      getMyProfileAction().catch(() => null),
      getMyAttendanceData(30).catch(() => null),
    ]);

  const staff =
    profileResult && "staff" in profileResult
      ? profileResult.staff
      : null;

  return {
    staff,
    attendanceData,
  };
}