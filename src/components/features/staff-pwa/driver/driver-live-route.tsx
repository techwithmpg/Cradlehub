"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MapPin, Navigation, RefreshCw } from "lucide-react";
import { getAssignedDriverRouteAction } from "@/app/(dashboard)/staff/driver/routes/actions";
import { getDriverNavigationUrl } from "@/lib/staff-pwa/driver-ui-model";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type Coordinates = { lat: number; lng: number };
type RouteData = { encodedPolyline: string; durationSeconds: number | null; distanceMeters: number | null };

const BROWSER_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

function RouteOverlay({ encodedPolyline }: { encodedPolyline: string }) {
  const map = useMap();
  const geometry = useMapsLibrary("geometry");

  useEffect(() => {
    if (!map || !geometry || !encodedPolyline) return;
    let path: google.maps.LatLng[];
    try {
      path = geometry.encoding.decodePath(encodedPolyline);
    } catch {
      return;
    }
    if (!path.length) return;
    const polyline = new google.maps.Polyline({
      map,
      path,
      strokeColor: "#176343",
      strokeOpacity: 0.95,
      strokeWeight: 6,
    });
    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 45);
    return () => polyline.setMap(null);
  }, [encodedPolyline, geometry, map]);

  return null;
}

export function DriverLiveRoute({ job }: { job: RealDispatchItem }) {
  const destination = useMemo(
    () =>
      job.lat !== null && job.lng !== null &&
      Number.isFinite(job.lat) && Number.isFinite(job.lng) &&
      Math.abs(job.lat) <= 90 && Math.abs(job.lng) <= 180 &&
      !job.needsLocationReview
        ? { lat: job.lat, lng: job.lng }
        : null,
    [job.lat, job.lng, job.needsLocationReview]
  );
  const externalUrl = destination ? getDriverNavigationUrl(job) : null;
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (!destination || !("geolocation" in navigator)) return;
    const watcher = navigator.geolocation.watchPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
        setGpsError(null);
      },
      () => setGpsError("Allow location for live positioning, or use Open in Maps."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [job.id, destination]); // No location is written to the database.

  const loadRoute = useCallback(async (origin: Coordinates) => {
    setIsRouting(true);
    setRouteError(null);
    try {
      const response = await getAssignedDriverRouteAction({
        bookingId: job.id,
        originLat: origin.lat,
        originLng: origin.lng,
      });
      if (response.ok) setRoute(response);
      else {
        setRoute(null);
        setRouteError(response.message);
      }
    } catch {
      setRoute(null);
      setRouteError("Could not load the route. Use Open in Maps.");
    } finally {
      setIsRouting(false);
    }
  }, [job.id]);

  useEffect(() => {
    // Calculate once on first GPS fix; moving driver marker remains live.
    // Recalculation is manual to avoid unbounded Google Routes requests.
    if (!position || !destination || requested.current) return;
    requested.current = true;
    void loadRoute(position);
  }, [position, destination, loadRoute]);

  const hasMap = Boolean(BROWSER_MAPS_KEY) && destination !== null;
  const eta = route?.durationSeconds !== null && route?.durationSeconds !== undefined
    ? Math.ceil(route.durationSeconds / 60)
    : null;
  const km = route?.distanceMeters !== null && route?.distanceMeters !== undefined
    ? (route.distanceMeters / 1000).toFixed(1)
    : null;

  return (
    <main className="mx-auto max-w-xl space-y-3 px-3 pb-28 pt-3">
      <Link href={`/staff/driver/trips/${job.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#176343]">
        Back to trip details
      </Link>
      <header className="rounded-2xl bg-[#163a2b] px-4 py-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#e3d09f]">Confirmed Home Service route</p>
        <h1 className="mt-1 text-lg font-semibold">{job.customerName}</h1>
        <p className="mt-1 text-sm text-white/80">{job.formattedAddress ?? job.area ?? "Destination pending"}</p>
        <p className="mt-2 text-xs text-white/75">
          {eta !== null ? `Road ETA ${eta} min` : "ETA pending"}
          {km !== null ? ` · ${km} km` : ""}
        </p>
      </header>

      {hasMap ? (
        <div className="relative h-[54dvh] min-h-[310px] overflow-hidden rounded-2xl border border-[#d7dfd7]">
          <APIProvider apiKey={BROWSER_MAPS_KEY}>
            <Map
              defaultCenter={destination!}
              defaultZoom={13}
              gestureHandling="greedy"
              disableDefaultUI={false}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              style={{ width: "100%", height: "100%" }}
            >
              <Marker position={destination!} title="Customer destination" />
              {position ? <Marker position={position} title="Your live location" /> : null}
              {route ? <RouteOverlay encodedPolyline={route.encodedPolyline} /> : null}
            </Map>
          </APIProvider>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {!destination
            ? "Customer coordinates need CRM review. Navigation is not available until the destination is verified."
            : "Embedded map is unavailable. The browser Maps key must be configured."}
        </div>
      )}

      {gpsError ? <p role="status" className="text-sm text-amber-800">{gpsError}</p> : (
        destination && !position ? (
          <p role="status" className="text-sm text-amber-800">
            Allow location access to show your live position and load the driving route.
          </p>
        ) : null
      )}
      {routeError ? <p role="status" className="text-sm text-amber-800">{routeError}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!position || !destination || isRouting}
          onClick={() => { if (position) void loadRoute(position); }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#b8cabb] bg-white px-3 text-sm font-semibold text-[#163a2b] disabled:opacity-50"
        >
          <RefreshCw size={17} aria-hidden="true" />
          {isRouting ? "Routing…" : "Refresh route"}
        </button>
        {externalUrl ? (
          <a href={externalUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#163a2b] px-3 text-sm font-semibold text-white">
            <Navigation size={17} aria-hidden="true" /> Open in Maps
          </a>
        ) : (
          <span className="inline-flex min-h-12 items-center justify-center rounded-xl border px-3 text-xs">
            <MapPin size={16} className="mr-2" aria-hidden="true" /> Destination pending
          </span>
        )}
      </div>
      <p className="text-xs leading-5 text-[#68776d]">
        Your position updates while this page is open. Route recalculation is manual; tap Open in Maps
        for voice-guided turn-by-turn navigation. Opening a route does not start travel or mark arrival.
      </p>
    </main>
  );
}
