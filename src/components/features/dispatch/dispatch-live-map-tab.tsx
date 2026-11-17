"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Car,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  UserRound,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";
import {
  eligibleCustomerDestinations,
  hasCustomerGps,
  isOpenHomeServiceBooking,
} from "@/lib/home-service/active-map";
import type { DriverTrack } from "@/lib/dispatch/crm-live-map-model";
import {
  decodeEncodedPolyline,
  formatArrivalClockTime,
  formatDistanceRemaining,
  formatDurationMinutes,
  isValidGeoPoint,
  type RouteCacheEntry,
} from "@/lib/dispatch/route-eta";
import {
  freshnessBadgeClasses,
  SelectedDriverDetails,
  statusBadgeClasses,
} from "./selected-driver-details";
import { useLiveCrmMapSync } from "./use-live-crm-map-sync";

type LatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleMapOptions = {
  center: LatLngLiteral;
  zoom: number;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  clickableIcons?: boolean;
};

type GoogleLatLngBounds = {
  extend: (position: LatLngLiteral) => void;
};

type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void;
  setCenter: (position: LatLngLiteral) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarkerInstance = {
  addListener: (eventName: string, handler: () => void) => void;
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleMarkerOptions = {
  map: GoogleMapInstance;
  position: LatLngLiteral;
  title: string;
  label?: string;
  icon?: string;
  zIndex?: number;
};

type GoogleInfoWindowInstance = {
  open: (options: { map: GoogleMapInstance; anchor: GoogleMarkerInstance }) => void;
};

type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance;
  Marker: new (options: GoogleMarkerOptions) => GoogleMarkerInstance;
  InfoWindow: new (options: { content: string }) => GoogleInfoWindowInstance;
  LatLngBounds: new () => GoogleLatLngBounds;
  Polyline?: new (options: {
    map: GoogleMapInstance;
    path: LatLngLiteral[];
    geodesic?: boolean;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
  }) => GooglePolylineInstance;
};

declare global {
  interface Window {
    google?: {
      maps: GoogleMapsNamespace;
    };
    __cradleGoogleMapsPromise?: Promise<void>;
  }
}

type CustomerMarker = {
  booking: RealDispatchItem;
  position: LatLngLiteral;
  label: string;
};

function locationLabel(item: RealDispatchItem): string {
  return item.area ?? item.formattedAddress ?? "Customer GPS saved";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window.__cradleGoogleMapsPromise) return window.__cradleGoogleMapsPromise;

  window.__cradleGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-cradle-google-maps="true"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.cradleGoogleMaps = "true";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps failed to load")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return window.__cradleGoogleMapsPromise;
}

function buildRouteUrl(item: RealDispatchItem): string {
  if (!hasCustomerGps(item) || item.lat === null || item.lng === null) {
    return "https://www.google.com/maps";
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`;
}

function driverInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "D";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function driverMarkerIcon(state: DriverTrack["reliability"]["state"]): string {
  if (state === "live") return "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
  if (state === "delayed" || state === "poor_accuracy") {
    return "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
  }
  return "https://maps.google.com/mapfiles/ms/icons/orange-dot.png";
}

function DriverTrackCard({
  driver,
  selected,
  onSelect,
}: {
  driver: DriverTrack;
  selected: boolean;
  onSelect: () => void;
}) {
  const nextStop = driver.nextStop;
  const arrivalClock = formatArrivalClockTime(driver.estimatedArrivalIso);
  const collectionNote = driver.collectionSummary;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-2xl border p-3.5 text-left shadow-sm transition hover:border-[#155A33] hover:shadow-md ${selected
        ? "border-[#155A33] bg-green-50/90"
        : "border-[var(--cs-border)] bg-[var(--cs-surface)]"
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Car size={14} className="shrink-0 text-[#1F4E33]" />
            <h4 className="truncate text-sm font-bold text-[var(--cs-text)]">{driver.driverName}</h4>
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--cs-text-secondary)]">
            {driver.therapists.map((t) => t.name).join(", ") || "Assigned therapist"}
          </p>
        </div>

        <Badge
          variant="outline"
          className={`shrink-0 text-[0.65rem] ${statusBadgeClasses(driver.currentStatusLabel)}`}
        >
          {driver.currentStatusLabel}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge
          variant="outline"
          className={`text-[0.62rem] ${freshnessBadgeClasses(driver.reliability.state)}`}
        >
          {driver.reliability.badgeText}
        </Badge>
        {driver.predictiveEndingSoon ? (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[0.62rem] text-amber-800">
            Ending soon
          </Badge>
        ) : null}
        {collectionNote && collectionNote.decision !== "not_required" ? (
          <Badge
            variant="outline"
            className={
              collectionNote.requiresResolution
                ? "border-amber-300 bg-amber-50 text-[0.62rem] text-amber-800"
                : "border-emerald-300 bg-emerald-50 text-[0.62rem] text-emerald-700"
            }
          >
            {collectionNote.requiresResolution ? "Collection undecided" : "Collection required"}
          </Badge>
        ) : null}
      </div>

      <div className="mt-2.5 space-y-1 text-xs text-[var(--cs-text-secondary)]">
        {nextStop ? (
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">
              {nextStop.customerName} · {nextStop.destinationLabel}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 text-[0.72rem] text-[var(--cs-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} />
            {formatDurationMinutes(driver.etaMinutes)}
            {arrivalClock ? ` (${arrivalClock})` : ""}
          </span>
          {driver.distanceMeters !== null ? (
            <span>{formatDistanceRemaining(driver.distanceMeters)}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function UnassignedBookingCard({
  item,
  selected,
  onSelect,
}: {
  item: RealDispatchItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const gpsReady = hasCustomerGps(item);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-2xl border p-3.5 text-left shadow-sm transition hover:border-[#155A33] hover:shadow-md ${selected
        ? "border-[#155A33] bg-green-50"
        : "border-[var(--cs-border)] bg-[var(--cs-surface)]"
        }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[0.68rem] text-[var(--cs-text-muted)]">{item.number}</p>
          <h4 className="mt-0.5 truncate text-sm font-bold text-[var(--cs-text)]">
            {item.customerName}
          </h4>
          <p className="truncate text-xs text-[var(--cs-text-secondary)]">
            {item.serviceName} · {item.therapistName ?? "Unassigned therapist"}
          </p>
        </div>

        <Badge
          variant="outline"
          className={`shrink-0 text-[0.65rem] ${gpsReady
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-red-300 bg-red-50 text-red-700"
            }`}
        >
          {gpsReady ? "Needs Driver" : "GPS Missing"}
        </Badge>
      </div>

      <div className="mt-2 space-y-1 text-xs text-[var(--cs-text-secondary)]">
        <div className="flex items-center gap-1.5">
          <Clock size={12} />
          <span>
            {formatTime12h(item.startTime)}
            {item.endTime ? ` – ${formatTime12h(item.endTime)}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={12} />
          <span className="truncate">{locationLabel(item)}</span>
        </div>
      </div>
    </button>
  );
}

function MapCanvas({
  bookings,
  drivers,
  routesByDriver,
  businessDate,
  selectedDriverId,
  selectedBookingId,
  onSelectDriver,
  onSelectBooking,
}: {
  bookings: RealDispatchItem[];
  drivers: DriverTrack[];
  routesByDriver: ReadonlyMap<string, RouteCacheEntry>;
  businessDate: string;
  selectedDriverId: string | null;
  selectedBookingId: string | null;
  onSelectDriver: (driverId: string, primaryBookingId?: string) => void;
  onSelectBooking: (bookingId: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<GoogleMarkerInstance[]>([]);
  const polylineRefs = useRef<GooglePolylineInstance[]>([]);
  const initialFitDoneRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
  const mapError = apiKey ? mapLoadError : "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is missing.";

  const customerMarkers: CustomerMarker[] = useMemo(
    () =>
      eligibleCustomerDestinations(bookings, businessDate).map((booking, index) => ({
        booking,
        position: {
          lat: booking.lat as number,
          lng: booking.lng as number,
        },
        label: String(index + 1),
      })),
    [bookings, businessDate]
  );

  // Initialize Google Map once
  useEffect(() => {
    if (!apiKey || !mapContainerRef.current) return;
    let cancelled = false;

    async function initMap() {
      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !mapContainerRef.current || !window.google?.maps) return;
        const maps = window.google.maps;
        if (!mapInstanceRef.current) {
          const defaultCenter = customerMarkers[0]?.position ??
            (drivers.find((d) => d.location)?.location
              ? {
                lat: drivers.find((d) => d.location)!.location!.lat,
                lng: drivers.find((d) => d.location)!.location!.lng,
              }
              : { lat: 10.6765, lng: 122.9509 });

          mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
            center: defaultCenter,
            zoom: customerMarkers.length > 0 || drivers.length > 0 ? 13 : 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: true,
          });
        }
        setMapLoadError(null);
        setMapReady(true);
      } catch {
        setMapLoadError("Google Maps could not load.");
      }
    }

    void initMap();
    return () => {
      cancelled = true;
    };
    // Initialize map instance once when API key/container mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Update markers & active routes smoothly whenever GPS positions, stops, or routes change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!mapReady || !map || !maps) return;

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
    polylineRefs.current.forEach((polyline) => polyline.setMap(null));
    polylineRefs.current = [];

    const bounds = new maps.LatLngBounds();
    let visibleCount = 0;

    // 1. Authorized Customer Destination Pins (Red)
    customerMarkers.forEach((marker) => {
      bounds.extend(marker.position);
      visibleCount += 1;

      const markerInstance = new maps.Marker({
        map,
        position: marker.position,
        title: marker.booking.customerName,
        label: marker.label,
        icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        zIndex: 10,
      });

      const infoWindow = new maps.InfoWindow({
        content: `
          <div style="min-width: 220px; font-family: system-ui, sans-serif;">
            <div style="font-size: 12px; color: #6b5b4b;">${escapeHtml(marker.booking.number)} · Customer Destination</div>
            <div style="font-weight: 700; font-size: 15px; margin-top: 2px;">${escapeHtml(marker.booking.customerName)}</div>
            <div style="font-size: 13px; color: #5f5146; margin-top: 4px;">${escapeHtml(marker.booking.serviceName)} · ${escapeHtml(formatTime12h(marker.booking.startTime))}</div>
            <div style="font-size: 12px; color: #6b5b4b; margin-top: 8px;">${escapeHtml(locationLabel(marker.booking))}</div>
          </div>
        `,
      });

      markerInstance.addListener("click", () => {
        onSelectBooking(marker.booking.id);
        infoWindow.open({ map, anchor: markerInstance });
      });

      markerRefs.current.push(markerInstance);
    });

    // 2. Active Driver Vehicle Markers & Active Routes
    drivers.forEach((driver) => {
      const driverPos =
        driver.location && isValidGeoPoint({ lat: driver.location.lat, lng: driver.location.lng })
          ? { lat: driver.location.lat, lng: driver.location.lng }
          : null;

      if (driverPos) {
        bounds.extend(driverPos);
        visibleCount += 1;

        const isSelected = selectedDriverId === driver.driverKey;
        const markerInstance = new maps.Marker({
          map,
          position: driverPos,
          title: `${driver.driverName} (${driver.currentStatusLabel})`,
          label: driverInitials(driver.driverName),
          icon: driverMarkerIcon(driver.reliability.state),
          zIndex: isSelected ? 40 : 25,
        });

        const nextLabel = driver.nextStop
          ? `${driver.nextStop.customerName} (${driver.nextStop.destinationLabel})`
          : "No active stop";
        const infoWindow = new maps.InfoWindow({
          content: `
            <div style="min-width: 220px; font-family: system-ui, sans-serif;">
              <div style="font-size: 12px; color: #155A33; font-weight: 700;">Driver · ${escapeHtml(driver.reliability.label)}</div>
              <div style="font-weight: 700; font-size: 15px; margin-top: 2px;">${escapeHtml(driver.driverName)}</div>
              <div style="font-size: 13px; color: #334155; margin-top: 4px;">Status: ${escapeHtml(driver.currentStatusLabel)}</div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;">Next: ${escapeHtml(nextLabel)}</div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;">ETA: ${escapeHtml(formatDurationMinutes(driver.etaMinutes))}</div>
            </div>
          `,
        });

        markerInstance.addListener("click", () => {
          onSelectDriver(driver.driverKey, driver.nextStop?.bookingId);
          infoWindow.open({ map, anchor: markerInstance });
        });

        markerRefs.current.push(markerInstance);
      }

      // Draw active route polyline if Google Maps Polyline class is available
      if (maps.Polyline) {
        const cachedRoute = driver.driverId ? routesByDriver.get(driver.driverId) : undefined;
        let path: LatLngLiteral[] = [];
        if (cachedRoute?.encodedPolyline) {
          path = decodeEncodedPolyline(cachedRoute.encodedPolyline);
        } else if (driverPos) {
          const validStops = driver.stops
            .filter((stop) => stop.hasAuthorizedDestination && stop.lat !== null && stop.lng !== null)
            .map((stop) => ({ lat: stop.lat as number, lng: stop.lng as number }));
          if (validStops.length > 0) {
            path = [driverPos, ...validStops];
          }
        }

        if (path.length >= 2) {
          const isSelected = selectedDriverId === driver.driverKey;
          const polyline = new maps.Polyline({
            map,
            path,
            geodesic: true,
            strokeColor: isSelected ? "#155A33" : "#64748b",
            strokeOpacity: isSelected ? 0.92 : 0.55,
            strokeWeight: isSelected ? 5 : 3,
          });
          polylineRefs.current.push(polyline);
        }
      }
    });

    if (!initialFitDoneRef.current && visibleCount > 0) {
      initialFitDoneRef.current = true;
      if (visibleCount > 1) {
        map.fitBounds(bounds, 80);
      } else {
        const single =
          customerMarkers[0]?.position ??
          (drivers[0]?.location
            ? { lat: drivers[0].location.lat, lng: drivers[0].location.lng }
            : { lat: 10.6765, lng: 122.9509 });
        map.setCenter(single);
        map.setZoom(15);
      }
    }
  }, [
    customerMarkers,
    drivers,
    mapReady,
    onSelectBooking,
    onSelectDriver,
    routesByDriver,
    selectedDriverId,
  ]);

  const selectedDriver =
    drivers.find((driver) => driver.driverKey === selectedDriverId) ?? null;
  const selectedBooking =
    bookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const selectedRouteUrl = selectedBooking
    ? buildRouteUrl(selectedBooking)
    : "https://www.google.com/maps";

  return (
    <div className="relative h-[calc(100vh-235px)] min-h-[620px] overflow-hidden rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-sm">
      {mapError ? (
        <div className="flex h-full flex-col items-center justify-center bg-[var(--cs-surface-warm)] p-8 text-center">
          <MapPin className="mb-3 text-[var(--cs-text-muted)]" size={38} />
          <h3 className="text-lg font-bold text-[var(--cs-text)]">Live Google Map is not ready</h3>
          <p className="mt-2 max-w-md text-sm text-[var(--cs-text-secondary)]">{mapError}</p>
          {selectedBooking ? (
            <a
              href={selectedRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#155A33] px-5 text-sm font-bold text-white hover:bg-[#104728]"
            >
              Open selected customer in Google Maps
              <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      ) : (
        <div ref={mapContainerRef} className="h-full w-full" />
      )}

      <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-sm font-bold text-[var(--cs-text)]">Live Home-Service Map</p>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[var(--cs-text-secondary)]">
            <span className="size-3 rounded-full bg-red-500" />
            Customer destinations
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--cs-text-secondary)]">
            <span className="size-3 rounded-full bg-blue-500" />
            Live driver GPS (&le;2 min)
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--cs-text-secondary)]">
            <span className="size-3 rounded-full bg-amber-500" />
            Delayed / stale GPS (not live)
          </span>
        </div>
      </div>

      {selectedDriver ? (
        <div className="absolute bottom-4 right-4 left-4 flex justify-end sm:left-auto">
          <SelectedDriverDetails
            driver={selectedDriver}
            route={selectedDriver.driverId ? routesByDriver.get(selectedDriver.driverId) : null}
          />
        </div>
      ) : selectedBooking ? (
        <div className="absolute bottom-4 right-4 w-[320px] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-[var(--cs-text-muted)]">
                {selectedBooking.number}
              </p>
              <h3 className="mt-1 truncate text-base font-bold text-[var(--cs-text)]">
                {selectedBooking.customerName}
              </h3>
              <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">
                {selectedBooking.serviceName} · {formatTime12h(selectedBooking.startTime)}
              </p>
            </div>
            <Badge
              variant="outline"
              className="shrink-0 border-amber-300 bg-amber-50 text-[0.68rem] text-amber-800"
            >
              {hasCustomerGps(selectedBooking) ? "Needs Driver" : "GPS Missing"}
            </Badge>
          </div>

          <div className="mt-3 space-y-1.5 text-xs text-[var(--cs-text-secondary)]">
            <div className="flex items-center gap-1.5">
              <MapPin size={13} />
              <span className="truncate">{locationLabel(selectedBooking)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserRound size={13} />
              <span>{selectedBooking.therapistName ?? "Unassigned therapist"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Navigation size={13} />
              <span>
                {typeof selectedBooking.lat === "number" ? selectedBooking.lat.toFixed(5) : "—"},{" "}
                {typeof selectedBooking.lng === "number" ? selectedBooking.lng.toFixed(5) : "—"}
              </span>
            </div>
          </div>

          <a
            href={selectedRouteUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1F4E33] px-4 text-sm font-bold text-white transition hover:bg-[#163B26]"
          >
            Open Customer Route
            <ExternalLink size={13} />
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function DispatchLiveMapTab({
  data,
  onRefresh,
  selectedBookingId: initialSelectedBookingId,
  branchId,
}: {
  data: DispatchData;
  onRefresh?: () => void;
  selectedBookingId?: string;
  branchId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [requestedBookingId, setRequestedBookingId] = useState<string | null>(
    initialSelectedBookingId ?? null
  );
  const [requestedDriverId, setRequestedDriverId] = useState<string | null>(null);

  const handleArrivalBookingFocus = useCallback((bookingId: string) => {
    setRequestedBookingId(bookingId);
    setRequestedDriverId(null);
  }, []);

  const sync = useLiveCrmMapSync({
    data,
    branchId,
    onRefresh,
    onSelectBooking: handleArrivalBookingFocus,
  });

  const openBookings = useMemo(() => {
    const byOpen = data.items.filter((item) => isOpenHomeServiceBooking(item, data.today));
    // Also keep recently completed home services that remain tracked via active drivers/collections
    const activeDriverBookingIds = new Set(
      sync.viewModel.drivers.flatMap((driver) => driver.stops.map((stop) => stop.bookingId))
    );
    const extras = data.items.filter(
      (item) =>
        activeDriverBookingIds.has(item.id) &&
        !byOpen.some((existing) => existing.id === item.id)
    );
    return [...byOpen, ...extras];
  }, [data.items, data.today, sync.viewModel.drivers]);

  const filteredBookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return openBookings;

    return openBookings.filter((item) =>
      [
        item.customerName,
        item.serviceName,
        item.area ?? "",
        item.formattedAddress ?? "",
        item.driverName ?? "",
        item.therapistName ?? "",
        item.number,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [openBookings, query]);

  const filteredDrivers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sync.viewModel.drivers;

    return sync.viewModel.drivers.filter((driver) =>
      [
        driver.driverName,
        driver.currentStatusLabel,
        driver.reliability.label,
        ...driver.therapists.map((t) => `${t.name} ${t.customerName}`),
        ...driver.stops.map((stop) => `${stop.destinationLabel} ${stop.serviceName}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, sync.viewModel.drivers]);

  const selectedBookingId = useMemo(() => {
    if (requestedBookingId && filteredBookings.some((item) => item.id === requestedBookingId)) {
      return requestedBookingId;
    }
    return filteredBookings[0]?.id ?? null;
  }, [filteredBookings, requestedBookingId]);

  const selectedDriverId = useMemo(() => {
    if (requestedDriverId && filteredDrivers.some((d) => d.driverKey === requestedDriverId)) {
      return requestedDriverId;
    }
    if (selectedBookingId) {
      const owningDriver = filteredDrivers.find((driver) =>
        driver.stops.some((stop) => stop.bookingId === selectedBookingId)
      );
      if (owningDriver) return owningDriver.driverKey;
    }
    if (!requestedBookingId) {
      return filteredDrivers[0]?.driverKey ?? null;
    }
    return null;
  }, [filteredDrivers, requestedBookingId, requestedDriverId, selectedBookingId]);

  const filteredUnassigned = useMemo(() => {
    const filteredIds = new Set(filteredBookings.map((item) => item.id));
    return sync.viewModel.unassignedBookings.filter((item) => filteredIds.has(item.id));
  }, [filteredBookings, sync.viewModel.unassignedBookings]);

  const handleSelectDriver = useCallback((driverId: string, primaryBookingId?: string) => {
    setRequestedDriverId(driverId);
    setRequestedBookingId(primaryBookingId ?? null);
  }, []);

  const handleSelectBooking = useCallback((bookingId: string) => {
    setRequestedBookingId(bookingId);
    setRequestedDriverId(null);
  }, []);

  if (openBookings.length === 0 && sync.viewModel.drivers.length === 0) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface)] p-10 text-center">
        <MapPin className="mb-3 text-[var(--cs-text-muted)]" size={34} />
        <h3 className="font-bold text-[var(--cs-text)]">
          No active Home Service locations to map.
        </h3>
        <p className="mt-1 max-w-md text-sm text-[var(--cs-text-muted)]">
          There are no open Home Service bookings for this branch.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {sync.connectionState !== "connected" ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          <WifiOff size={15} />
          <span>
            Realtime connection interrupted — reconnecting to restore current journey state.
          </span>
        </div>
      ) : null}

      {openBookings.some((item) => !hasCustomerGps(item)) ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          Home Service bookings are active, but some customer locations still need GPS.
        </p>
      ) : null}

      {sync.arrivalFeed.length > 0 ? (
        <div
          aria-label="Recent arrival updates"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-xs text-emerald-950"
        >
          <Bell size={14} className="shrink-0 text-emerald-700" />
          <span className="font-semibold">Latest arrival:</span>
          <span className="font-medium">{sync.arrivalFeed[0]!.copy.title}</span>
          <span className="text-emerald-800">— {sync.arrivalFeed[0]!.copy.body}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--cs-text)]">Live Home-Service Map</h2>
          <p className="mt-1 text-sm text-[var(--cs-text-secondary)]">
            Monitor active drivers, live GPS freshness, journey ETAs, and customer destinations.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid min-w-0 gap-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
              Search map bookings
            </span>
            <span className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cs-text-muted)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search driver, client, therapist, area..."
                className="h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] pl-9 pr-3 text-sm outline-none transition focus:border-[#1F4E33] sm:w-[290px]"
              />
            </span>
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => (onRefresh ? onRefresh() : window.location.reload())}
          >
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="h-[calc(100vh-235px)] min-h-[620px] overflow-hidden rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[var(--cs-text)]">Drivers &amp; Visits</h3>
              <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                {filteredDrivers.length} {filteredDrivers.length === 1 ? "driver" : "drivers"} ·{" "}
                {filteredBookings.length} active stops
              </p>
            </div>
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              {filteredDrivers.length} active
            </Badge>
          </div>

          <div className="h-[calc(100%-58px)] space-y-4 overflow-y-auto pr-1">
            {filteredDrivers.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                  Active Drivers ({filteredDrivers.length})
                </p>
                {filteredDrivers.map((driver) => (
                  <DriverTrackCard
                    key={driver.driverKey}
                    driver={driver}
                    selected={selectedDriverId === driver.driverKey}
                    onSelect={() => handleSelectDriver(driver.driverKey, driver.nextStop?.bookingId)}
                  />
                ))}
              </div>
            ) : null}

            {filteredUnassigned.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                  Awaiting Driver ({filteredUnassigned.length})
                </p>
                {filteredUnassigned.map((item) => (
                  <UnassignedBookingCard
                    key={item.id}
                    item={item}
                    selected={!selectedDriverId && selectedBookingId === item.id}
                    onSelect={() => handleSelectBooking(item.id)}
                  />
                ))}
              </div>
            ) : null}

            {filteredDrivers.length === 0 && filteredUnassigned.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-8 text-center text-sm text-[var(--cs-text-muted)]">
                No matching active drivers or home-service bookings.
              </div>
            ) : null}
          </div>
        </aside>

        <MapCanvas
          bookings={filteredBookings}
          drivers={filteredDrivers}
          routesByDriver={sync.routesByDriver}
          businessDate={data.today}
          selectedDriverId={selectedDriverId}
          selectedBookingId={selectedBookingId}
          onSelectDriver={handleSelectDriver}
          onSelectBooking={handleSelectBooking}
        />
      </div>
    </section>
  );
}
