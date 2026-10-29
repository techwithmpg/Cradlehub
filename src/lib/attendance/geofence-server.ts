import "server-only";

import type { AttendanceDb } from "@/lib/attendance/db";
import {
  validateAttendanceLocation,
  type AttendanceLocation,
  type GeofenceFailure,
} from "@/lib/attendance/geofence";

export function attendanceGeofenceMode(): "disabled" | "enabled" | "invalid" {
  const value = process.env.ATTENDANCE_GEOFENCE_MODE;
  if (!value || value === "disabled") return "disabled";
  return value === "enabled" ? "enabled" : "invalid";
}

export function attendanceGeofenceRequired(): boolean {
  return attendanceGeofenceMode() !== "disabled";
}

export async function verifyAttendanceGeofence(input: {
  admin: AttendanceDb;
  branchId: string;
  location: AttendanceLocation | null | undefined;
}): Promise<GeofenceFailure | null> {
  const mode = attendanceGeofenceMode();
  if (mode === "disabled") return null;
  if (mode === "invalid") return "geofence_configuration";
  const radiusVariable =
    input.branchId === "c1000000-0000-0000-0000-000000000001"
      ? process.env.ATTENDANCE_GEOFENCE_MAIN_RADIUS_METERS
      : input.branchId === "c1000000-0000-0000-0000-000000000002"
        ? process.env.ATTENDANCE_GEOFENCE_SM_RADIUS_METERS
        : undefined;
  const configuredRadius = radiusVariable === undefined ? undefined : Number(radiusVariable);
  if (
    radiusVariable !== undefined &&
    (!/^\d+(?:\.\d+)?$/.test(radiusVariable) ||
      !Number.isFinite(configuredRadius) ||
      !configuredRadius ||
      configuredRadius > 1_000)
  )
    return "geofence_configuration";
  const { data, error } = await input.admin
    .from("branches")
    .select("latitude, longitude")
    .eq("id", input.branchId)
    .maybeSingle();
  if (error || !data) return "geofence_configuration";
  return validateAttendanceLocation({
    branchId: input.branchId,
    branchLatitude: data.latitude,
    branchLongitude: data.longitude,
    location: input.location,
    radiusMeters: configuredRadius,
  });
}
