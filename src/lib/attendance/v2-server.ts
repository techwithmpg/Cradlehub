import "server-only";
import type { AttendanceDb } from "@/lib/attendance/db";

/** Unified Attendance V2 contract: enabled by default unless explicitly disabled via env. */
export async function attendanceV2Enabled(db: AttendanceDb): Promise<boolean> {
  if (process.env.CRADLEHUB_ATTENDANCE_V2_ENABLED === "false") return false;
  const result = await db.rpc("attendance_v2_enabled" as never);
  if (result.error) {
    // Fall back to true when the DB switch RPC is absent in older local snapshots
    return true;
  }
  return result.data !== false;
}
