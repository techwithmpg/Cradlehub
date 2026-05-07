// =============================================================================
// Google Maps helpers — server-side only
// =============================================================================
//
// Required Google Cloud APIs:
//   - Geocoding API       (address → lat/lng)
//   - Distance Matrix API (travel time between two coordinates)
//
// Environment variables:
//   GOOGLE_MAPS_SERVER_API_KEY  — server-side key (never exposed to browser)
//   NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY — browser key for Places Autocomplete
//     (restrict by HTTP referrer in Google Cloud Console)
//
// Cost-control rules:
//   - Geocode only ONCE per booking, after user confirms address
//   - Store lat/lng in bookings.metadata so we never re-geocode
//   - Travel-time estimates are done server-side per dispatch check, not per render
//   - All API calls are wrapped in try/catch; failures fall back to zone-only logic
//   - The app runs fully without keys — zone-only mode is always the fallback
//
// Future: when driver assignment board is built, the browser key can power a
// Places Autocomplete widget. For now, address entry is manual.
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
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${originLat},${originLng}` +
      `&destinations=${destLat},${destLng}` +
      `&mode=driving&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      rows?: { elements?: { status: string; duration?: { value: number } }[] }[];
    };

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK" || !element.duration) return null;

    return Math.ceil(element.duration.value / 60);
  } catch {
    return null;
  }
}
