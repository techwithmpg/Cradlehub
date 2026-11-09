"use server";

import { getMyDriverJobByIdAction, getMyDriverJobsAction } from "@/app/(dashboard)/staff-portal/actions";
import {
  isNavigableDriverTrip, isValidDriverDestination, orderDriverStops,
  MAX_DRIVER_ROUTE_STOPS, type DrivingMatrixCell,
} from "@/lib/staff-pwa/driver-dispatch-policy";
import { logError } from "@/lib/logger";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validGPS = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export type DriverDispatchSnapshot = {
  date: string;
  trips: RealDispatchItem[];
  navigable: RealDispatchItem[];
  unverified: RealDispatchItem[];
  fingerprint: string;
};

export type DriverDispatchSnapshotResult =
  | { ok: true; snapshot: DriverDispatchSnapshot }
  | { ok: false; message: string };

export type DriverCombinedRouteResult =
  | {
      ok: true;
      encodedPolyline: string;
      stopIds: string[];
      basis: "driving_time" | "schedule_fallback";
      timingWarnings: string[];
      durationSeconds: number | null;
      distanceMeters: number | null;
      remainingCount: number;
    }
  | { ok: false; message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Authenticated Staff PWA query. "date" and "bookingId" are filters only.
 * The existing driver server boundary supplies current user, branch,
 * assignment and booking status. Never use admin DB reads with browser IDs.
 */
export async function getDriverDispatchSnapshotAction(input: {
  date?: string;
  bookingId?: string;
} = {}): Promise<DriverDispatchSnapshotResult> {
  let date = input.date && datePattern.test(input.date) ? input.date : undefined;
  if (input.bookingId) {
    if (!uuidPattern.test(input.bookingId)) return { ok: false, message: "Invalid trip reference." };
    const assigned = await getMyDriverJobByIdAction(input.bookingId);
    if ("error" in assigned) return { ok: false, message: "This trip is not assigned to your driver account." };
    date = assigned.job.bookingDate;
  }

  const response = await getMyDriverJobsAction(date);
  if ("error" in response) return { ok: false, message: "Driver dispatch is unavailable. Please sign in again." };
  const active = response.items.filter((job) =>
    ["confirmed", "in_progress"].includes(job.bookingStatus) &&
    job.dispatchStatus !== "cancelled" && job.dispatchStatus !== "completed"
  );
  const navigable = active.filter(isNavigableDriverTrip);
  const unverified = navigable.filter((job) => !isValidDriverDestination(job));
  const filtered = [...active].sort((a,b) =>
    `${a.bookingDate}T${a.startTime}`.localeCompare(`${b.bookingDate}T${b.startTime}`) || a.id.localeCompare(b.id)
  );
  return {
    ok: true,
    snapshot: {
      date: date ?? response.businessDate ?? new Date().toISOString().slice(0, 10),
      trips: filtered,
      navigable: navigable.filter(isValidDriverDestination),
      unverified,
      fingerprint: filtered.map((job) =>
        [job.id, job.bookingStatus, job.bookingProgressStatus, job.bookingDate,
         job.startTime, job.endTime, job.driverId, job.lat, job.lng,
         job.needsLocationReview].join(":")
      ).join("|"),
    },
  };
}

const waypoint = (lat: number, lng: number) =>
  ({ location: { latLng: { latitude: lat, longitude: lng } } });

async function readDrivingMatrix(
  key: string, originLat: number, originLng: number,
  jobs: RealDispatchItem[]
): Promise<DrivingMatrixCell[]> {
  if (jobs.length < 2) return [];
  try {
    const origins = [
      { waypoint: waypoint(originLat, originLng) },
      ...jobs.map((job) => ({ waypoint: waypoint(job.lat!, job.lng!) })),
    ];
    const destinations = jobs.map((job) => ({ waypoint: waypoint(job.lat!, job.lng!) }));
    const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,duration",
      },
      body: JSON.stringify({ origins, destinations, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Routes matrix returned ${response.status}`);
    const rows = (await response.json()) as {
      originIndex?: number; destinationIndex?: number; duration?: string;
      condition?: string; status?: { code?: number };
    }[];
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) =>
      row.condition === "ROUTE_EXISTS" && !row.status?.code &&
      Number.isInteger(row.originIndex) && Number.isInteger(row.destinationIndex) &&
      typeof row.duration === "string"
    ).map((row) => ({
      originIndex: row.originIndex!,
      destinationIndex: row.destinationIndex!,
      seconds: Number(row.duration!.replace(/s$/, "")),
    })).filter((row) => Number.isFinite(row.seconds) && row.seconds >= 0);
  } catch (error) {
    logError("driver.dispatch.route_matrix_failed", {
      errorName: error instanceof Error ? error.name : "RouteMatrixError",
    });
    return [];
  }
}

/**
 * Billed API calls are bounded by a maximum of 8 stops; always fetch and
 * authorize the entire stop set again before calling external Google services.
 * This action doesn't advance booking, attendance or customer location state.
 */
export async function calculateDriverCombinedRouteAction(input: {
  date: string;
  originLat: number;
  originLng: number;
}): Promise<DriverCombinedRouteResult> {
  if (!input || !datePattern.test(input.date) ||
      !validGPS(input.originLat, input.originLng)) {
    return { ok: false, message: "Invalid driver route request." };
  }
  const response = await getDriverDispatchSnapshotAction({ date: input.date });
  if (!response.ok) return { ok: false, message: response.message };

  const jobs = response.snapshot.navigable
    .sort((a, b) => `${a.bookingDate}T${a.startTime}`.localeCompare(`${b.bookingDate}T${b.startTime}`))
    .slice(0, MAX_DRIVER_ROUTE_STOPS);
  if (!jobs.length) return { ok: false, message: "No confirmed trip with a verified GPS destination." };

  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) return { ok: false, message: "In-app routes are unavailable. Use Open in Maps." };

  const matrix = await readDrivingMatrix(key, input.originLat, input.originLng, jobs);
  const ordered = orderDriverStops(jobs, matrix, Date.now());
  const last = ordered.ordered.at(-1);
  if (!last) return { ok: false, message: "No valid route stops." };

  try {
    const routeResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: waypoint(input.originLat, input.originLng),
        destination: waypoint(last.lat!, last.lng!),
        intermediates: ordered.ordered.slice(0, -1).map((job) => waypoint(job.lat!, job.lng!)),
        travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", polylineQuality: "OVERVIEW",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!routeResponse.ok) throw new Error(`Routes API returned ${routeResponse.status}`);
    const data = (await routeResponse.json()) as {
      routes?: { polyline?: { encodedPolyline?: string }; duration?: string; distanceMeters?: number }[];
    };
    const route = data.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return { ok: false, message: "No drivable combined route was found." };
    const duration = typeof route.duration === "string" ? Number(route.duration.replace(/s$/, "")) : NaN;
    return {
      ok: true, encodedPolyline: route.polyline.encodedPolyline,
      stopIds: ordered.ordered.map(job => job.id),
      basis: ordered.basis,
      timingWarnings: ordered.timingWarnings,
      durationSeconds: Number.isFinite(duration) ? duration : null,
      distanceMeters: Number.isFinite(route.distanceMeters) ? route.distanceMeters! : null,
      remainingCount: Math.max(0, response.snapshot.navigable.length - ordered.ordered.length),
    };
  } catch (error) {
    logError("driver.dispatch.combined_route_failed", {
      errorName: error instanceof Error ? error.name : "CombinedRouteError",
    });
    return { ok: false, message: "Live road route is temporarily unavailable. Check the stops and use Google Maps." };
  }
}
