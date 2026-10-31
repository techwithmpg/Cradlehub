import type { AttendanceLocation } from "@/lib/attendance/geofence";

export type BrowserLocationFailure = "location_permission_denied" | "location_unavailable";

export async function locationPermissionState(): Promise<PermissionState | "unknown"> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    // Safari and installed PWAs may not expose the Permissions API.
    return "unknown";
  }
}

export async function freshAttendanceLocation(): Promise<AttendanceLocation> {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation ||
    (typeof window !== "undefined" && !window.isSecureContext)
  ) {
    throw "location_unavailable" satisfies BrowserLocationFailure;
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          window.localStorage.setItem("attendance-location-permission", "granted");
        } catch {
          /* private mode */
        }
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) =>
        reject(
          (error.code === 1
            ? "location_permission_denied"
            : "location_unavailable") satisfies BrowserLocationFailure
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
    );
  });
}

export async function needsLocationExplanation(): Promise<"explain" | "denied" | "ready"> {
  const state = await locationPermissionState();
  if (state === "denied") return "denied";
  if (state === "granted") return "ready";
  if (state === "unknown") {
    try {
      if (window.localStorage.getItem("attendance-location-permission") === "granted")
        return "ready";
    } catch {
      /* private mode */
    }
  }
  return "explain";
}

// A single foreground refresh helps readiness. It is never used as scan proof.
export async function warmAttendanceLocation(): Promise<void> {
  if (typeof document === "undefined" || document.visibilityState !== "visible") return;
  if ((await locationPermissionState()) !== "granted") return;
  try {
    await freshAttendanceLocation();
  } catch {
    // The next scan reports acquisition failures to the staff member.
  }
}

export function browserLocationFailureResult(error: unknown) {
  const denied = error === "location_permission_denied";
  return {
    ok: false as const,
    outcome: "blocked" as const,
    reasonCode: denied ? "location_permission_denied" : "location_unavailable",
    severity: "warning" as const,
    title: "Location needed",
    message: denied
      ? "Location access is required for attendance. Please enable location permission for CradleHub and try again."
      : "We couldn't verify your location accurately. Please enable Precise Location, move to an area with better reception, and try again.",
    securityNote: "No attendance change was recorded from this scan.",
  };
}
