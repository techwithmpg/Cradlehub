"use server";

import { getMyDriverJobByIdAction } from "@/app/(dashboard)/staff-portal/actions";
import { logError } from "@/lib/logger";

type RouteResult =
  | { ok: true; encodedPolyline: string; durationSeconds: number | null; distanceMeters: number | null }
  | { ok: false; message: string };

const validPosition = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export async function getAssignedDriverRouteAction(input: {
  bookingId: string;
  originLat: number;
  originLng: number;
}): Promise<RouteResult> {
  if (
    !input || typeof input.bookingId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.bookingId) ||
    !validPosition(input.originLat, input.originLng)
  ) return { ok: false, message: "Invalid route request." };

  // Existing server-side driver workspace path enforces authenticated driver
  // identity, branch, assigned booking ID, and acceptable booking status.
  const jobResult = await getMyDriverJobByIdAction(input.bookingId);
  if ("error" in jobResult) return { ok: false, message: "Trip is unavailable for this account." };

  const job = jobResult.job;
  if (
    job.bookingStatus === "cancelled" || job.bookingStatus === "no_show" ||
    job.dispatchStatus === "cancelled" || job.dispatchStatus === "completed"
  ) return { ok: false, message: "This trip is no longer navigable." };

  if (
    job.needsLocationReview || job.lat === null || job.lng === null ||
    !validPosition(job.lat, job.lng)
  ) return { ok: false, message: "CRM must verify the customer's GPS location before routing." };

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return { ok: false, message: "In-app routes are not configured. Use Open in Maps." };

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: input.originLat, longitude: input.originLng } } },
        destination: { location: { latLng: { latitude: job.lat, longitude: job.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        polylineQuality: "OVERVIEW",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Google Routes returned ${response.status}`);
    const data = (await response.json()) as {
      routes?: { polyline?: { encodedPolyline?: string }; duration?: string; distanceMeters?: number }[];
    };
    const route = data.routes?.[0];
    const encodedPolyline = route?.polyline?.encodedPolyline;
    if (!encodedPolyline) return { ok: false, message: "No driving route was found." };
    const seconds = route?.duration ? Number(route.duration.replace(/s$/, "")) : NaN;
    return {
      ok: true,
      encodedPolyline,
      durationSeconds: Number.isFinite(seconds) ? Math.ceil(seconds) : null,
      distanceMeters: Number.isFinite(route?.distanceMeters) ? route!.distanceMeters! : null,
    };
  } catch (error) {
    logError("driver.live_route.routes_api_failed", {
      bookingId: input.bookingId,
      errorName: error instanceof Error ? error.name : "UnknownRouteError",
    });
    return { ok: false, message: "Road route is unavailable. You can still open Google Maps." };
  }
}
