export type GeoPoint = {
  lat: number;
  lng: number;
};

export interface RouteCacheRequest {
  routeKey: string;
  origin: GeoPoint;
}

export interface RouteCacheEntry {
  routeKey: string;
  origin: GeoPoint;
  computedAtMs: number;
  durationMinutes: number | null;
  distanceMeters: number | null;
  encodedPolyline: string | null;
  estimatedArrivalIso: string | null;
  basis: "routes_api" | "straight_line_estimate";
}

export const ROUTE_MIN_RECALC_INTERVAL_MS = 30_000;
export const ROUTE_MIN_MOVEMENT_METERS = 250;
export const ROUTE_CACHE_TTL_MS = 120_000;

export function isValidGeoPoint(point: GeoPoint | null | undefined): point is GeoPoint {
  if (!point) return false;
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180 &&
    !(point.lat === 0 && point.lng === 0)
  );
}

export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function buildRouteCacheKey(input: {
  driverId: string | null;
  stops: Array<{ stopId: string; lat: number | null; lng: number | null }>;
}): string {
  const driverPart = input.driverId ?? "unassigned";
  const stopPart = input.stops
    .filter((stop) => stop.lat !== null && stop.lng !== null)
    .map((stop) => `${stop.stopId}:${stop.lat?.toFixed(5)},${stop.lng?.toFixed(5)}`)
    .join("|");
  return `${driverPart}=>${stopPart}`;
}

/**
 * Decides whether the CRM map should request a new Google Routes API
 * computation. Prevents unnecessary API calls when a driver has barely moved
 * or a valid cached route for the exact stop list is still fresh.
 */
export function shouldRecomputeDriverRoute(
  previous: RouteCacheEntry | null | undefined,
  next: RouteCacheRequest,
  nowMs = Date.now()
): boolean {
  if (!isValidGeoPoint(next.origin)) return false;
  if (!previous) return true;
  if (previous.routeKey !== next.routeKey) return true;

  const elapsed = nowMs - previous.computedAtMs;
  if (elapsed >= ROUTE_CACHE_TTL_MS) return true;

  if (!isValidGeoPoint(previous.origin)) return true;
  const movedMeters = haversineDistanceMeters(previous.origin, next.origin);
  return movedMeters >= ROUTE_MIN_MOVEMENT_METERS && elapsed >= ROUTE_MIN_RECALC_INTERVAL_MS;
}

/**
 * Pure TypeScript implementation of Google's Encoded Polyline Algorithm Format
 * so decoded road paths work cleanly without requiring an extra JS Maps library.
 */
export function decodeEncodedPolyline(encoded: string): GeoPoint[] {
  if (!encoded || typeof encoded !== "string") return [];
  const points: GeoPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      if (index >= encoded.length) return points;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      if (index >= encoded.length) return points;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    const decodedLat = lat / 1e5;
    const decodedLng = lng / 1e5;
    if (
      Number.isFinite(decodedLat) &&
      Number.isFinite(decodedLng) &&
      Math.abs(decodedLat) <= 90 &&
      Math.abs(decodedLng) <= 180
    ) {
      points.push({ lat: decodedLat, lng: decodedLng });
    }
  }

  return points;
}

export function formatDistanceRemaining(distanceMeters: number | null | undefined): string {
  if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return "Distance unavailable";
  }
  if (distanceMeters < 1_000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1_000).toFixed(1)} km`;
}

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) {
    return "ETA unavailable";
  }
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hrs = Math.floor(rounded / 60);
  const rem = rounded % 60;
  return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`;
}

export function formatArrivalClockTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}
