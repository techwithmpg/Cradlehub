export type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type GeofenceFailure =
  | "geofence_configuration"
  | "location_required"
  | "location_invalid"
  | "location_inaccurate"
  | "location_stale"
  | "location_outside";

export const ATTENDANCE_GEOFENCE_BRANCHES = {
  "c1000000-0000-0000-0000-000000000001": { radiusMeters: 100 },
  "c1000000-0000-0000-0000-000000000002": { radiusMeters: 150 },
} as const;

export const MAX_ATTENDANCE_LOCATION_ACCURACY_METERS = 75;
export const MAX_ATTENDANCE_LOCATION_AGE_MS = 20_000;

function validCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function distanceMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (second.latitude - first.latitude) * radians;
  const longitudeDelta = (second.longitude - first.longitude) * radians;
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(first.latitude * radians) *
      Math.cos(second.latitude * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function validateAttendanceLocation(input: {
  branchId: string;
  branchLatitude: number | null;
  branchLongitude: number | null;
  location: AttendanceLocation | null | undefined;
  now?: number;
  radiusMeters?: number;
}): GeofenceFailure | null {
  const policy =
    ATTENDANCE_GEOFENCE_BRANCHES[input.branchId as keyof typeof ATTENDANCE_GEOFENCE_BRANCHES];
  const radiusMeters = input.radiusMeters ?? policy?.radiusMeters;
  if (
    !policy ||
    !Number.isFinite(radiusMeters) ||
    !radiusMeters ||
    radiusMeters <= 0 ||
    input.branchLatitude === null ||
    input.branchLongitude === null ||
    !validCoordinates(input.branchLatitude, input.branchLongitude)
  ) {
    return "geofence_configuration";
  }
  const location = input.location;
  if (!location) return "location_required";
  if (
    !validCoordinates(location.latitude, location.longitude) ||
    !Number.isFinite(location.accuracy) ||
    location.accuracy <= 0 ||
    !Number.isFinite(location.timestamp)
  )
    return "location_invalid";
  if (location.accuracy > MAX_ATTENDANCE_LOCATION_ACCURACY_METERS) return "location_inaccurate";
  const age = (input.now ?? Date.now()) - location.timestamp;
  if (age < -5_000 || age > MAX_ATTENDANCE_LOCATION_AGE_MS) return "location_stale";
  return distanceMeters(
    { latitude: location.latitude, longitude: location.longitude },
    { latitude: input.branchLatitude, longitude: input.branchLongitude }
  ) <= radiusMeters
    ? null
    : "location_outside";
}
