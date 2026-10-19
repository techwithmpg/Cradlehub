"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, MapPin, Navigation, RefreshCcw, Route } from "lucide-react";
import {
  StaffCard,
  StaffEmptyState,
  StaffScreen,
  StaffScreenHeader,
  StaffStatusChip,
} from "@/components/features/staff-pwa/native-foundation";
import { StaffSnapshotRecorder } from "@/components/features/staff-pwa/safe-memory";
import { buildDriverRoutePageViewModel } from "@/components/features/staff-portal/driver/map/driver-route-view-model";
import { DriverStartTravelButton } from "@/components/features/staff-portal/driver/map/driver-start-travel-button";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

type Coordinates = { lat: number; lng: number };
const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

function validCoords(lat: number | null | undefined, lng: number | null | undefined): Coordinates | null {
  if (typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function embedMapUrl(item: RealDispatchItem, currentOrigin: Coordinates | null): string | null {
  if (!embedKey) return null;
  const destination = validCoords(item.lat, item.lng);
  const address = item.formattedAddress?.trim();
  const target = destination ? `${destination.lat},${destination.lng}` : address;
  if (!target) return null;
  const origin = currentOrigin ?? validCoords(item.branchLat, item.branchLng);
  const params = new URLSearchParams({ key: embedKey });
  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
    params.set("destination", target);
    params.set("mode", "driving");
    params.set("units", "metric");
    return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
  }
  params.set("q", target);
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

function statusLabel(status: RealDispatchItem["dispatchStatus"]): string {
  if (status === "in_route") return "Travelling";
  if (status === "ready") return "Queued";
  if (status === "arrived_at_customer") return "Dropped off";
  if (status === "service_started") return "Service ongoing";
  if (status === "completed") return "Completed";
  return status.replaceAll("_", " ");
}

export function DriverNativeMap({
  items,
  businessDate,
}: {
  items: RealDispatchItem[];
  businessDate: string;
}) {
  const router = useRouter();
  const [chosenStopId, setChosenStopId] = useState<string | null>(null);
  const [currentOrigin, setCurrentOrigin] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const route = useMemo(() => buildDriverRoutePageViewModel([...items], {
    detailsBasePath: "/staff/driver/trips",
    today: new Date(`${businessDate}T12:00:00Z`),
    preferredStopId: chosenStopId,
  }), [items, businessDate, chosenStopId]);

  const next = route.nextStop;
  const activeItem = next ? items.find((item) => item.id === next.id) : null;
  const mapUrl = activeItem ? embedMapUrl(activeItem, currentOrigin) : null;
  const travelUrl = next?.navigationUrl
    ? `${next.navigationUrl}&dir_action=navigate`
    : null;

  // If dispatch changes while Google Maps is open, refresh the authorized
  // server snapshot when the driver returns to the PWA.
  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [router]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("This device does not support location access.");
      return;
    }
    setLocationMessage("Requesting location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = validCoords(position.coords.latitude, position.coords.longitude);
        if (!coords) {
          setLocationMessage("Could not determine a valid location.");
          return;
        }
        setCurrentOrigin(coords);
        setLocationMessage("Showing directions from your current position.");
      },
      () => setLocationMessage("Location unavailable. The branch-origin map remains available."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  return (
    <StaffScreen>
      <StaffSnapshotRecorder
        snapshot={{
          screen: "driverMap",
          label: "Driver map",
          counts: [
            { label: "Stops", value: route.totalStops },
            { label: "Completed", value: route.completedStops },
            { label: "Travelling", value: route.activeStops },
          ],
        }}
      />
      <StaffScreenHeader
        title="Trip queue & route"
        subtitle={`${route.dateLabel} · ${route.totalStops} assigned stops`}
      />
      {next ? (
        <>
          <StaffCard className="overflow-hidden">
            <div className="relative min-h-[240px] bg-[#e9efe8]">
              {mapUrl ? (
                <iframe
                  key={mapUrl}
                  title={`Google Maps route to ${next.customerName}`}
                  src={mapUrl}
                  className="h-[300px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center">
                  <MapPin size={28} className="text-[#163a2b]" aria-hidden="true" />
                  <p className="text-sm font-semibold text-[#163a2b]">In-app map unavailable</p>
                  <p className="text-xs leading-5 text-[#65746b]">
                    {embedKey
                      ? "This trip needs a usable destination address or coordinates."
                      : "Google Maps Embed API needs to be enabled with the existing authorized browser key."}
                  </p>
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#76501a]">
                  {next.dispatchStatus === "in_route" ? "Current journey" : "Next selected stop"}
                </p>
                <StaffStatusChip tone="gold">{statusLabel(next.dispatchStatus)}</StaffStatusChip>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-[#163a2b]">{next.customerName}</h2>
              <p className="mt-1 text-sm text-[#65746b]">{next.serviceName}</p>
              <p className="mt-3 flex items-start gap-2 text-sm text-[#526358]">
                <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {next.address}
              </p>
              {next.etaMinutes !== null ? (
                <p className="mt-2 text-xs text-[#65746b]">{next.etaLabel}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="min-h-11 rounded-xl border border-[#c8a96b] px-3 text-xs font-semibold text-[#163a2b]"
                >
                  Use my location for route
                </button>
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#c8a96b] px-3 text-xs font-semibold text-[#163a2b]"
                >
                  <RefreshCcw size={14} aria-hidden="true" /> Refresh queue
                </button>
              </div>
              {locationMessage ? <p role="status" className="mt-2 text-xs text-[#65746b]">{locationMessage}</p> : null}
              <p className="mt-2 text-xs text-[#65746b]">
                {currentOrigin
                  ? "Route preview begins at your requested current location."
                  : "Route preview starts at the branch when branch coordinates are available."}
                {" "}Embedded directions are not turn-by-turn navigation.
              </p>
              <div className="mt-4 grid gap-2">
                {next.bookingProgressStatus === "not_started" ? (
                  <DriverStartTravelButton bookingId={next.id} navigationUrl={next.navigationUrl} stayInPwa />
                ) : null}
                {travelUrl ? (
                  <a
                    href={travelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#163a2b] px-4 text-sm font-semibold text-white"
                  >
                    <Navigation size={17} aria-hidden="true" />
                    Open turn-by-turn in Google Maps
                  </a>
                ) : null}
                <Link
                  href={next.detailsHref}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#c8a96b] px-4 text-sm font-semibold text-[#163a2b]"
                >
                  Trip details <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </StaffCard>
          <h2 className="mt-6 text-base font-semibold text-[#163a2b]">Assigned trip queue</h2>
          <p className="mt-1 text-xs leading-5 text-[#65746b]">
            After you mark arrival, the next ready trip becomes the route shown here.
            Select another assigned stop to change your map focus. This does not alter
            dispatch ownership or mark the therapist's service complete.
          </p>
          <StaffCard className="mt-3 overflow-hidden">
            {route.stops.map((stop) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => setChosenStopId(stop.id)}
                disabled={stop.dispatchStatus === "completed" || stop.dispatchStatus === "cancelled"}
                aria-pressed={next.id === stop.id}
                className={`flex min-h-16 w-full items-center gap-3 border-b border-[#eee8dc] px-4 py-3 text-left last:border-0 disabled:opacity-50 ${next.id === stop.id ? "bg-[#e5f3e8]" : "bg-white"}`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3e9d6] text-xs font-semibold text-[#76501a]">
                  {stop.stopNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{stop.customerName}</span>
                  <span className="block truncate text-xs text-[#65746b]">
                    {stop.startTimeLabel} · {stop.address}
                  </span>
                  <span className="block text-[11px] text-[#65746b]">{statusLabel(stop.dispatchStatus)}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[#19563c]">
                  {next.id === stop.id ? "Selected" : "View route"}
                </span>
              </button>
            ))}
          </StaffCard>
        </>
      ) : (
        <StaffEmptyState
          icon={<Route size={20} />}
          title="No active route"
          description="Assigned stops appear here when available."
        />
      )}
    </StaffScreen>
  );
}
