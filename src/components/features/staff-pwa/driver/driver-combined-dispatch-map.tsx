"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { AlertTriangle, LocateFixed, MapPin, Navigation, RefreshCw } from "lucide-react";
import {
  calculateDriverCombinedRouteAction,
  getDriverDispatchSnapshotAction,
  type DriverDispatchSnapshot,
  type DriverCombinedRouteResult,
} from "@/app/(dashboard)/staff/driver/map/actions";
import { isValidDriverDestination } from "@/lib/staff-pwa/driver-dispatch-policy";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
const POLL_MS = 20000;
const RECALC_MS = 90000;
const MIN_RECALC_METERS = 500;
type Location = { lat: number; lng: number };
type GoodRoute = Extract<DriverCombinedRouteResult, { ok: true }>;

function routeDistanceMeters(a: Location, b: Location): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function CombinedRoadOverlay({ encodedPolyline }: { encodedPolyline: string }) {
  const map = useMap();
  const geometry = useMapsLibrary("geometry");
  useEffect(() => {
    if (!map || !geometry || !encodedPolyline) return;
    let points: google.maps.LatLng[];
    try { points = geometry.encoding.decodePath(encodedPolyline); } catch { return; }
    if (!points.length) return;
    const line = new google.maps.Polyline({
      map, path: points, strokeColor: "#146c47", strokeWeight: 6, strokeOpacity: 0.95,
    });
    const bounds = new google.maps.LatLngBounds();
    points.forEach(point => bounds.extend(point));
    map.fitBounds(bounds, 50);
    return () => line.setMap(null);
  }, [encodedPolyline, geometry, map]);
  return null;
}

export function DriverCombinedDispatchMap({
  initialSnapshot,
}: {
  initialSnapshot: DriverDispatchSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [origin, setOrigin] = useState<Location | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [route, setRoute] = useState<GoodRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const loading = useRef(false);
  const requestVersion = useRef(0);
  const lastCalculated = useRef<{ at: number; pos: Location; fingerprint: string } | null>(null);
  const snapshotRef = useRef(initialSnapshot);
  const gpsRef = useRef<Location | null>(null);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (loading.current) return;
    loading.current = true;
    setRefreshing(true);
    try {
      const result = await getDriverDispatchSnapshotAction({ date: snapshotRef.current.date });
      if (!result.ok) {
        setFetchError(result.message);
        // Never continue showing stale customer routes after authorization loss.
        setRoute(null);
        return;
      }
      setFetchError(null);
      if (result.snapshot.fingerprint !== snapshotRef.current.fingerprint) {
        snapshotRef.current = result.snapshot;
        setSnapshot(result.snapshot);
        setRoute(null);
        lastCalculated.current = null;
      }
    } catch {
      setFetchError("Could not refresh assigned bookings. Check your connection.");
    } finally {
      loading.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onPush = () => { void refresh(); };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("CRADLEHUB_DRIVER_DISPATCH_UPDATE", onPush);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("CRADLEHUB_DRIVER_DISPATCH_UPDATE", onPush);
    };
  }, [refresh]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watcher = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        gpsRef.current = point;
        setOrigin(point);
        setGpsError(null);
      },
      () => setGpsError("Location permission is required for a live route. You can still open Google Maps."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  const recalc = useCallback(async (point: Location, nextFingerprint: string) => {
    const version = ++requestVersion.current;
    setRouting(true);
    setRouteError(null);
    try {
      const result = await calculateDriverCombinedRouteAction({
        date: snapshotRef.current.date, originLat: point.lat, originLng: point.lng,
      });
      if (version !== requestVersion.current) return;
      if (snapshotRef.current.fingerprint !== nextFingerprint) return;
      // A provider error must not trigger an unbounded reroute retry loop.
      lastCalculated.current = { at: Date.now(), pos: point, fingerprint: nextFingerprint };
      if (result.ok) {
        setRoute(result);
        setRouteError(null);
      } else {
        setRoute(null);
        setRouteError(result.message);
      }
    } catch {
      if (version === requestVersion.current) {
        lastCalculated.current = { at: Date.now(), pos: point, fingerprint: nextFingerprint };
        setRoute(null);
        setRouteError("Route service unavailable. Use Open in Maps.");
      }
    } finally {
      if (version === requestVersion.current) setRouting(false);
    }
  }, []);

  useEffect(() => {
    if (!origin || !snapshot.navigable.length || document.visibilityState !== "visible") return;
    const last = lastCalculated.current;
    const newTrips = !last || last.fingerprint !== snapshot.fingerprint;
    const movedEnough = last && routeDistanceMeters(last.pos, origin) >= MIN_RECALC_METERS;
    const oldEnough = last && Date.now() - last.at >= RECALC_MS;
    if (routing || (!newTrips && !(movedEnough && oldEnough))) return;
    // Defer work out of the effect to avoid React synchronous state cascades.
    const timeout = window.setTimeout(() => void recalc(origin, snapshot.fingerprint), 0);
    return () => window.clearTimeout(timeout);
  }, [snapshot.fingerprint, snapshot.navigable.length, origin, route, routing, recalc]);

  const ordered = useMemo(() => {
    const lookup = new Map(snapshot.navigable.map(job => [job.id, job]));
    return route?.stopIds.map(id => lookup.get(id)).filter((job): job is NonNullable<typeof job> => Boolean(job)) ??
      snapshot.navigable.slice(0, 8);
  }, [route, snapshot.navigable]);
  const next = ordered[0];
  const openMapsUrl = next && isValidDriverDestination(next)
    ? `https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}&travelmode=driving`
    : null;
  const mapCenter = origin ?? (next ? { lat: next.lat!, lng: next.lng! } : { lat: 10.676, lng: 122.956 });
  const pendingStops = snapshot.navigable.length - ordered.length;

  return (
    <main className="mx-auto max-w-xl space-y-3 px-3 pb-28 pt-3">
      <header className="rounded-2xl bg-[#163a2b] px-4 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#dfcc99]">Driver live dispatch</p>
            <h1 className="mt-1 text-xl font-semibold">Combined route</h1>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {snapshot.navigable.length} route stop{snapshot.navigable.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-2 text-xs text-white/80">
          {snapshot.date} · Changes sync while open · {refreshing ? "Updating…" : "Live workspace"}
        </p>
        {route ? (
          <p className="mt-2 text-xs text-white/90">
            {route.durationSeconds !== null ? `Est. driving ${Math.ceil(route.durationSeconds / 60)} min` : "Driving ETA unavailable"}
            {route.distanceMeters !== null ? ` · ${(route.distanceMeters / 1000).toFixed(1)} km` : ""}
          </p>
        ) : null}
      </header>
      {MAPS_KEY && (next || origin) ? (
        <div className="relative h-[48dvh] min-h-[300px] overflow-hidden rounded-2xl border border-[#d2e0d3]">
          <APIProvider apiKey={MAPS_KEY}>
            <Map defaultCenter={mapCenter} defaultZoom={13} gestureHandling="greedy"
              mapTypeControl={false} streetViewControl={false} fullscreenControl={false}
              style={{ width: "100%", height: "100%" }}>
              {ordered.map((job, index) => (
                <Marker key={job.id} position={{lat:job.lat!,lng:job.lng!}}
                  label={String(index + 1)} title={`Stop ${index + 1}: ${job.customerName}`} />
              ))}
              {origin ? <Marker position={origin} title="Your current GPS position" /> : null}
              {route ? <CombinedRoadOverlay encodedPolyline={route.encodedPolyline} /> : null}
            </Map>
          </APIProvider>
        </div>
      ) : (
        <div className="rounded-xl border border-[#d2e0d3] bg-[#eef2ed] p-5 text-sm">
          {MAPS_KEY ? "No confirmed routes assigned for this date." : "Google Maps is not configured for embedded display."}
        </div>
      )}
      {fetchError ? <p role="alert" className="text-sm text-red-800">{fetchError}</p> : null}
      {gpsError ? <p role="status" className="text-sm text-amber-800">{gpsError}</p> : null}
      {routeError ? <p role="status" className="text-sm text-amber-800">{routeError}</p> : null}
      {!origin ? <p className="text-xs text-amber-800"><LocateFixed size={15} className="mr-1 inline" />Allow GPS to calculate your closest driving stop.</p> : null}
      {route?.basis === "schedule_fallback" ? (
        <p className="text-xs text-amber-800">Road distances unavailable. Stops are shown by booked time, not nearest-driving order.</p>
      ) : null}
      {route?.timingWarnings.map((warning) => (
        <p key={warning} role="alert" className="text-xs font-semibold text-amber-800">
          <AlertTriangle size={14} className="mr-1 inline" /> {warning} Contact CRM to resolve schedule conflicts.
        </p>
      ))}
      {pendingStops > 0 ? <p role="status" className="text-xs text-amber-800">
        {pendingStops} more assigned stops are not yet in this bounded route. They remain visible in Trips.
      </p> : null}
      {snapshot.unverified.length ? (
        <p role="alert" className="text-xs text-amber-800">
          {snapshot.unverified.length} confirmed stop(s) have unverified GPS coordinates. CRM must correct them.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button"
          onClick={() => { void refresh(); if (gpsRef.current) void recalc(gpsRef.current, snapshotRef.current.fingerprint); }}
          disabled={routing || refreshing}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#b8cabb] bg-white px-3 text-sm font-semibold text-[#163a2b] disabled:opacity-50">
          <RefreshCw size={17} /> {routing ? "Routing…" : "Refresh"}
        </button>
        {openMapsUrl ? (
          <a href={openMapsUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#163a2b] px-3 text-sm font-semibold text-white">
            <Navigation size={17} /> Navigate next
          </a>
        ) : <span className="inline-flex min-h-12 items-center justify-center rounded-xl border text-xs">No next stop</span>}
      </div>
      <section className="rounded-2xl border border-[#d9e0d8] bg-white p-3">
        <h2 className="px-1 text-sm font-bold text-[#163a2b]">Driver stop sequence</h2>
        <p className="mt-1 px-1 text-xs text-[#66776d]">
          {route?.basis === "driving_time" ? "Nearest reachable stop first, except imminent booked times." : "Confirmed bookings, awaiting road order."}
        </p>
        {ordered.map((job, i) => (
          <Link key={job.id} href={`/staff/driver/trips/${job.id}`}
            className="mt-2 flex min-h-16 items-center gap-3 rounded-xl border border-[#e3eae1] p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#163a2b] text-sm font-bold text-white">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[#163a2b]">{job.customerName}</span>
              <span className="block truncate text-xs text-[#68776d]">{job.startTime.slice(0,5)} · {job.formattedAddress ?? job.area}</span>
            </span>
            <MapPin size={16} className="shrink-0 text-[#68776d]" />
          </Link>
        ))}
        {!ordered.length ? <p className="mt-3 text-sm text-[#68776d]">No confirmed trips currently require travel.</p> : null}
      </section>
      <p className="px-1 text-xs leading-5 text-[#66776d]">
        GPS is live while this app screen is active. Road rerouting is limited to meaningful movement or changed assignments.
        Opening the map never starts travel, marks arrival, or changes booked appointments.
        Use Navigate next for turn-by-turn voice directions.
      </p>
    </main>
  );
}
