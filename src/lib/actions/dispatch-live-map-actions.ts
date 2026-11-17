"use server";

import { z } from "zod";
import { getAttendanceActionContext } from "@/lib/attendance/queries";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { computeDrivingRouteWithPolyline, isGoogleMapsEnabled } from "@/lib/maps/google-maps";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { buildLiveMapDriversViewModel, extractLatLng } from "@/lib/dispatch/crm-live-map-model";
import { isValidGeoPoint, type GeoPoint } from "@/lib/dispatch/route-eta";

const routeRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driverId: z.string().trim().min(1).max(120),
  origin: z
    .object({
      lat: z.number().finite().min(-90).max(90),
      lng: z.number().finite().min(-180).max(180),
    })
    .optional(),
});

export type CrmDriverRouteResult =
  | {
      ok: true;
      driverId: string;
      routeKey: string;
      durationMinutes: number | null;
      distanceMeters: number | null;
      encodedPolyline: string | null;
      estimatedArrivalIso: string | null;
      basis: "routes_api" | "straight_line_estimate";
      computedAt: string;
      stopCount: number;
    }
  | {
      ok: false;
      code: "UNAUTHORIZED" | "INVALID_INPUT" | "NO_DRIVER_OR_DESTINATIONS" | "MAPS_UNAVAILABLE";
      error: string;
    };

/**
 * Computes an authorized driving route & ETA for a branch driver using the
 * existing Google Routes API integration. All destinations and driver
 * associations are re-verified from branch-scoped server state.
 */
export async function getCrmDriverRouteAction(
  rawInput: unknown
): Promise<CrmDriverRouteResult> {
  const parsed = routeRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "INVALID_INPUT", error: "Invalid route request." };
  }

  const context = await getAttendanceActionContext();
  if (!context || !context.branchId || !canAccessCrmWorkspace(context.role)) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      error: "CRM authorization is required to inspect driver routes.",
    };
  }

  const dispatchData = await getDispatchData({
    branchId: context.branchId,
    date: parsed.data.date,
    scope: "active_map",
    throwOnError: true,
  });

  const nowMs = Date.now();
  const model = buildLiveMapDriversViewModel({
    items: dispatchData.items,
    transportJourneys: dispatchData.transportJourneys,
    nowMs,
  });

  const driver = model.drivers.find((entry) => entry.driverId === parsed.data.driverId);
  if (!driver) {
    return {
      ok: false,
      code: "NO_DRIVER_OR_DESTINATIONS",
      error: "Assigned driver has no active route in this branch.",
    };
  }

  const authorizedStops: GeoPoint[] = driver.stops
    .map((stop) => extractLatLng(stop))
    .filter((point): point is GeoPoint => point !== null);

  if (authorizedStops.length === 0) {
    return {
      ok: false,
      code: "NO_DRIVER_OR_DESTINATIONS",
      error: "No verified destination coordinates are available for this driver.",
    };
  }

  const authoritativeOrigin =
    driver.location && isValidGeoPoint({ lat: driver.location.lat, lng: driver.location.lng })
      ? { lat: driver.location.lat, lng: driver.location.lng }
      : parsed.data.origin && isValidGeoPoint(parsed.data.origin)
        ? parsed.data.origin
        : null;

  if (!authoritativeOrigin) {
    return {
      ok: false,
      code: "NO_DRIVER_OR_DESTINATIONS",
      error: "Awaiting driver GPS position to calculate route.",
    };
  }

  const finalStop = authorizedStops[authorizedStops.length - 1]!;
  const intermediates = authorizedStops.slice(0, -1);

  if (isGoogleMapsEnabled()) {
    const computed = await computeDrivingRouteWithPolyline({
      originLat: authoritativeOrigin.lat,
      originLng: authoritativeOrigin.lng,
      destinationLat: finalStop.lat,
      destinationLng: finalStop.lng,
      intermediates,
    });
    if (computed) {
      return {
        ok: true,
        driverId: parsed.data.driverId,
        routeKey: driver.routeKey,
        durationMinutes: computed.durationMinutes,
        distanceMeters: computed.distanceMeters,
        encodedPolyline: computed.encodedPolyline,
        estimatedArrivalIso: new Date(nowMs + computed.durationMinutes * 60_000).toISOString(),
        basis: "routes_api",
        computedAt: new Date(nowMs).toISOString(),
        stopCount: authorizedStops.length,
      };
    }
  }

  return {
    ok: false,
    code: "MAPS_UNAVAILABLE",
    error: "Google Routes API is unavailable; showing direct stop markers and straight-line guide.",
  };
}
