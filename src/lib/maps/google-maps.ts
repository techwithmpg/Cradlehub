// =============================================================================
// Google Maps helpers — server-side only
// =============================================================================
//
// Required Google Cloud APIs:
//   - Geocoding API  (address → lat/lng)
//   - Routes API     (travel time / driving distance between two coordinates)
//
// Environment variables:
//   GOOGLE_MAPS_SERVER_API_KEY  — server-side key (never exposed to browser)
//   NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY — browser key for Places Autocomplete
//     (restrict by HTTP referrer in Google Cloud Console)
//
// Cost-control rules:
//   - Geocode only ONCE per booking, after user confirms address
//   - Store lat/lng in bookings.metadata so we never re-geocode
//   - If client-side Places Autocomplete already captured lat/lng, skip geocoding
//   - Travel-time estimates are done server-side per dispatch check, not per render
//   - All API calls are wrapped in try/catch; failures fall back to zone-only logic
//   - The app runs fully without keys — zone-only mode is always the fallback
// =============================================================================

export function isGoogleMapsEnabled(): boolean {
  return !!process.env.GOOGLE_MAPS_SERVER_API_KEY;
}

export function buildGoogleMapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  mapUrl: string;
};

export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results?: {
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        place_id: string;
      }[];
    };

    if (data.status !== "OK" || !data.results?.[0]) return null;

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;

    return {
      lat,
      lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      mapUrl: buildGoogleMapsSearchUrl(lat, lng),
    };
  } catch {
    return null;
  }
}

// Returns estimated driving time in minutes, or null if unavailable.
export async function estimateTravelTime(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<number | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration",
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: originLat, longitude: originLng } },
          },
          destination: {
            location: { latLng: { latitude: destLat, longitude: destLng } },
          },
          travelMode: "DRIVE",
        }),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      routes?: { duration?: string }[];
    };

    const duration = data.routes?.[0]?.duration;
    if (!duration) return null;

    // Routes API returns duration as e.g. "1234s"
    const seconds = parseInt(duration.replace("s", ""), 10);
    if (Number.isNaN(seconds)) return null;

    return Math.ceil(seconds / 60);
  } catch {
    return null;
  }
}

// Returns driving distance in kilometers, or null if unavailable.
export async function calculateDrivingDistanceKm(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<number | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: originLat, longitude: originLng } },
          },
          destination: {
            location: { latLng: { latitude: destLat, longitude: destLng } },
          },
          travelMode: "DRIVE",
        }),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      routes?: { distanceMeters?: number }[];
    };

    const meters = data.routes?.[0]?.distanceMeters;
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) {
      return null;
    }

    return meters / 1000;
  } catch {
    return null;
  }
}

export interface ComputedRouteResult {
  durationMinutes: number;
  distanceMeters: number;
  encodedPolyline: string;
}

/**
 * Computes a road route with encoded polyline, travel duration, and distance via
 * Google Routes API v2, optionally routing across multiple ordered stops.
 */
export async function computeDrivingRouteWithPolyline(input: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  intermediates?: Array<{ lat: number; lng: number }>;
}): Promise<ComputedRouteResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;

  const toWaypoint = (lat: number, lng: number) => ({
    location: { latLng: { latitude: lat, longitude: lng } },
  });

  try {
    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: toWaypoint(input.originLat, input.originLng),
          destination: toWaypoint(input.destinationLat, input.destinationLng),
          ...(input.intermediates && input.intermediates.length > 0
            ? {
                intermediates: input.intermediates
                  .slice(0, 8)
                  .map((point) => toWaypoint(point.lat, point.lng)),
              }
            : {}),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          polylineQuality: "OVERVIEW",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      routes?: {
        polyline?: { encodedPolyline?: string };
        duration?: string;
        distanceMeters?: number;
      }[];
    };

    const route = data.routes?.[0];
    const encodedPolyline = route?.polyline?.encodedPolyline;
    const durationStr = route?.duration;
    const distanceMeters = route?.distanceMeters;
    if (!encodedPolyline || !durationStr) return null;

    const seconds = Number.parseInt(durationStr.replace(/s$/i, ""), 10);
    if (!Number.isFinite(seconds) || seconds < 0) return null;

    return {
      durationMinutes: Math.max(1, Math.ceil(seconds / 60)),
      distanceMeters:
        typeof distanceMeters === "number" && Number.isFinite(distanceMeters) && distanceMeters >= 0
          ? distanceMeters
          : 0,
      encodedPolyline,
    };
  } catch {
    return null;
  }
}
