"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { CheckCircle2, Clock3, MapPin, Navigation, WifiOff } from "lucide-react";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import { recordAssignedDriverLiveLocationAction } from "@/app/(dashboard)/staff/driver/map/live-location-action";
import { getAssignedDriverRouteAction } from "@/app/(dashboard)/staff/driver/routes/actions";
import { invalidateStaffSafeMemory } from "@/components/features/staff-pwa/safe-memory";
import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type Point = { lat: number; lng: number };
type DrivingRoute = { encodedPolyline: string; durationSeconds: number | null; distanceMeters: number | null };
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";

function RoadLine({ encodedPolyline }: { encodedPolyline: string }) {
  const map = useMap();
  const geometry = useMapsLibrary("geometry");
  useEffect(() => {
    if (!map || !geometry || !encodedPolyline) return;
    let path: google.maps.LatLng[];
    try { path = geometry.encoding.decodePath(encodedPolyline); } catch { return; }
    if (!path.length) return;
    const polyline = new google.maps.Polyline({
      map, path, strokeColor: "#1976d2", strokeOpacity: 0.95, strokeWeight: 6,
    });
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.fitBounds(bounds, 56);
    return () => polyline.setMap(null);
  }, [encodedPolyline, geometry, map]);
  return null;
}

/**
 * Driver-facing single-assignment route. A notification's bookingId is ONLY a
 * selector: the server page authorizes the trip, and each action rechecks it.
 * This is a UI simplification; native GPS arrival does not yet write progress.
 */
export function DriverFocusedTripRoute({ job }: { job: RealDispatchItem }) {
  const [position, setPosition] = useState<Point | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const routeRequested = useRef(false);
  const lastShared = useRef(0);

  const destination = !job.needsLocationReview &&
    job.lat !== null && job.lng !== null &&
    Number.isFinite(job.lat) && Number.isFinite(job.lng) &&
    Math.abs(job.lat) <= 90 && Math.abs(job.lng) <= 180
      ? { lat: job.lat, lng: job.lng } : null;

  const started = job.bookingProgressStatus === "travel_started" &&
    job.dispatchStatus === "in_route";
  const waiting = job.bookingProgressStatus === "not_started" &&
    ["confirmed", "in_progress"].includes(job.bookingStatus);
  const finished = ["arrived", "session_started", "completed"].includes(job.bookingProgressStatus);
  const routeHref = `/staff/driver/map?bookingId=${encodeURIComponent(job.id)}&launch=native`;

  useEffect(() => {
    if (!destination || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition({ lat: coords.latitude, lng: coords.longitude });
        setAccuracy(coords.accuracy);
        setGpsError(null);
      },
      () => setGpsError("Allow precise location to show your route."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [job.id, destination?.lat, destination?.lng]);

  useEffect(() => {
    if (!position || !destination || routeRequested.current) return;
    routeRequested.current = true;
    void getAssignedDriverRouteAction({
      bookingId: job.id, originLat: position.lat, originLng: position.lng,
    }).then(result => {
      if (result.ok) setRoute(result);
      else setRouteMessage(result.message);
    }).catch(() => setRouteMessage("Unable to draw the route. Ask CRM to check the destination."));
  }, [position, destination, job.id]);

  // Preserve CRM live location behavior for the Web/PWA route while visible.
  // The Android navigator needs its own separately authorized GPS writer before
  // anyone can claim background/native CRM tracking or automatic arrival.
  useEffect(() => {
    if (!started || !position || accuracy === null || accuracy <= 0 ||
        accuracy > 150 || document.visibilityState !== "visible") return;
    if (Date.now() - lastShared.current < 30000) return;
    lastShared.current = Date.now();
    void recordAssignedDriverLiveLocationAction({
      bookingId: job.id, lat: position.lat, lng: position.lng, accuracyMeters: accuracy,
    }).catch(() => { /* Noncritical failure; server remains authoritative. */ });
  }, [started, position, accuracy, job.id]);

  function startTrip() {
    if (pending || !waiting || !destination) return;
    startTransition(async () => {
      setError(null);
      try {
        const result = await updateBookingProgressAction({
          bookingId: job.id, nextStatus: "travel_started",
        });
        if (!result.ok) {
          setError(result.message ?? "CradleHub could not start this trip.");
          return;
        }
        invalidateStaffSafeMemory(["driverToday", "driverTrips", "driverMap"]);
        // A normal same-origin page load is observed by the Android shell.
        // Only after the server confirms Start does it open native navigation.
        window.location.assign(routeHref);
      } catch {
        setError("Could not start the trip. Check your connection and try again.");
      }
    });
  }

  const eta = route?.durationSeconds == null ? null : Math.ceil(route.durationSeconds / 60);
  const destinationLabel = job.formattedAddress ?? job.area ?? "Destination pending";
  const routeReady = Boolean(destination);

  return (
    <main className="mx-auto max-w-xl space-y-3 px-3 pb-24 pt-3">
      <header className="rounded-[24px] bg-[#163a2b] px-5 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#e5d4a1]">
          {finished ? "Destination reached" : started ? "En route" : "Your assigned trip"}
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{job.customerName}</h1>
        <p className="mt-1 text-sm text-white/75">
          {job.serviceName} · {formatTime12h(job.startTime)}
        </p>
      </header>

      {routeReady && MAPS_KEY ? (
        <div className="relative h-[49dvh] min-h-[290px] overflow-hidden rounded-3xl border border-[#d4e0d6]">
          <APIProvider apiKey={MAPS_KEY}>
            <Map defaultCenter={destination!} defaultZoom={13}
              gestureHandling="greedy" mapTypeControl={false}
              streetViewControl={false} fullscreenControl={false}
              style={{ width: "100%", height: "100%" }}>
              <Marker position={destination!} title="Verified customer destination" />
              {position ? <Marker position={position} title="Driver position" /> : null}
              {route ? <RoadLine encodedPolyline={route.encodedPolyline} /> : null}
            </Map>
          </APIProvider>
          {eta !== null ? (
            <div className="absolute bottom-3 left-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#163a2b] shadow-md">
              Estimated drive: {eta} min
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-[180px] items-center justify-center rounded-3xl border border-[#d4e0d6] bg-[#edf2eb] p-6 text-center text-sm text-[#42594b]">
          {routeReady
            ? "The preview map is unavailable. Your assigned destination is saved in CradleHub."
            : "CRM must verify the destination GPS before this trip can start."}
        </div>
      )}

      <section className="rounded-3xl border border-[#e2e4db] bg-white p-5 shadow-sm" aria-label="Trip action">
        <p className="flex items-start gap-2 text-sm font-semibold text-[#163a2b]">
          <MapPin size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{destinationLabel}</span>
        </p>
        {finished ? (
          <>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#19563c]">
              <CheckCircle2 size={20} /> Arrival recorded in CradleHub
            </div>
            <Link href="/staff/driver/trips"
              className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-[#163a2b] text-base font-bold text-white">
              View next trip
            </Link>
          </>
        ) : waiting ? (
          <button type="button" disabled={!destination || pending} onClick={startTrip}
            className="mt-4 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#0d6548] px-4 text-lg font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-45">
            <Navigation size={22} aria-hidden="true" />
            {pending ? "Starting trip…" : "Start Trip"}
          </button>
        ) : started ? (
          <>
            <p className="mt-3 text-sm text-[#526358]">
              Navigation is active. Arrival must be confirmed by CradleHub before the booking status changes.
            </p>
            <a href={routeHref}
              className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#163a2b] px-4 text-base font-bold text-white">
              <Navigation size={19} aria-hidden="true" /> Resume navigation
            </a>
          </>
        ) : (
          <p className="mt-4 text-sm text-[#7b4b19]">
            This trip cannot be started in its current state. Ask CRM to check the assignment.
          </p>
        )}
        <Link href={`/staff/driver/trips/${job.id}`}
          className="mt-3 block py-2 text-center text-xs font-medium text-[#526358] underline">
          Trip details / assistance
        </Link>
      </section>

      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {gpsError ? <p role="status" className="flex items-center gap-2 text-xs text-amber-800">
        <WifiOff size={15} /> {gpsError}
      </p> : null}
      {routeMessage ? <p role="status" className="text-xs text-amber-800">{routeMessage}</p> : null}
      <p className="text-center text-xs leading-5 text-[#68776d]">
        CradleHub verifies your assignment before starting. Attendance scanning is separate from trips.
      </p>
    </main>
  );
}
