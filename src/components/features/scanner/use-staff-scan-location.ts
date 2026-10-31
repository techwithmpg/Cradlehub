"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { freshAttendanceLocation, needsLocationExplanation } from "@/lib/attendance/browser-location";
import {
  MAX_ATTENDANCE_LOCATION_ACCURACY_METERS,
  MAX_ATTENDANCE_LOCATION_AGE_MS,
} from "@/lib/attendance/geofence";

export type ScanLocationReadiness =
  | "checking" | "permission_needed" | "denied" | "unavailable" | "inaccurate" | "ready";

function withReadinessTimeout<T>(request: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject("location_unavailable"), 20_000);
    request.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); }
    );
  });
}

/**
 * Foreground-only location readiness. Coordinates are not cached or sent here.
 * The actual QR scan requests a new fix and the server remains authoritative.
 */
export function useStaffScanLocation(required: boolean) {
  const [state, setState] = useState<ScanLocationReadiness>(required ? "checking" : "ready");
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async (userInitiated = false) => {
    const attempt = ++generation.current;
    if (!required) {
      setState("ready");
      return;
    }
    if (document.visibilityState !== "visible") return;

    try {
      // Only the staff member's action may initiate the first permission prompt.
      if (!userInitiated) {
        const permission = await withReadinessTimeout(needsLocationExplanation());
        if (generation.current !== attempt) return;
        if (permission === "denied") {
          setState("denied");
          return;
        }
        if (permission === "explain") {
          setState("permission_needed");
          return;
        }
      }

      setState("checking");
      setAccuracyMeters(null);
      const fix = await withReadinessTimeout(freshAttendanceLocation());
      if (generation.current !== attempt || document.visibilityState !== "visible") return;
      const age = Date.now() - fix.timestamp;
      if (!Number.isFinite(fix.latitude) || fix.latitude < -90 || fix.latitude > 90 ||
          !Number.isFinite(fix.longitude) || fix.longitude < -180 || fix.longitude > 180 ||
          !Number.isFinite(fix.accuracy) || fix.accuracy <= 0 ||
          !Number.isFinite(age) || age < -5_000 || age > MAX_ATTENDANCE_LOCATION_AGE_MS) {
        setState("unavailable");
      } else if (fix.accuracy > MAX_ATTENDANCE_LOCATION_ACCURACY_METERS) {
        setAccuracyMeters(Math.round(fix.accuracy));
        setState("inaccurate");
      } else {
        setState("ready");
      }
    } catch (error) {
      if (generation.current !== attempt || document.visibilityState !== "visible") return;
      setState(error === "location_permission_denied" ? "denied" : "unavailable");
    }
  }, [required]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
      else generation.current += 1;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      generation.current += 1;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return {
    state,
    accuracyMeters,
    request: () => { void refresh(true); },
  };
}
