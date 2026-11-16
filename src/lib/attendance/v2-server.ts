import "server-only";
import type { AttendanceDb } from "@/lib/attendance/db";

/** Both release switches must agree. Missing SQL must fail closed if requested. */
export async function attendanceV2Enabled(db: AttendanceDb): Promise<boolean> {
  if (process.env.CRADLEHUB_ATTENDANCE_V2_ENABLED !== "true") return false;
  const result = await db.rpc("attendance_v2_enabled" as never);
  if (result.error) throw new Error("Attendance V2 is not installed. Contact the front desk.");
  return result.data === true;
}
