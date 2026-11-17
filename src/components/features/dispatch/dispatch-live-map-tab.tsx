"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ExternalLink,
  MapPin,
  Radio,
  WifiOff,
  X,
} from "lucide-react";
import type { DispatchData } from "@/lib/queries/dispatch-queries";
import { isOpenHomeServiceBooking } from "@/lib/home-service/active-map";
import type { DriverTrack } from "@/lib/dispatch/crm-live-map-model";
import {
  decodeEncodedPolyline,
  formatDurationMinutes,
  isValidGeoPoint,
} from "@/lib/dispatch/route-eta";
import type { LiveMapTripItem, TripFilterKey } from "@/lib/dispatch/trip-presentation";
import { ContextualJourneyPanel } from "./contextual-journey-panel";
import { FloatingTripRail } from "./floating-trip-rail";
import { LiveMapFilterBar } from "./live-map-filter-bar";
import { TRIP_STAGE_STYLES } from "./trip-stage-styles";
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
  opacity?: number;
};

type GoogleInfoWindowInstance = {
  open: (options: { map: GoogleMapInstance; anchor: GoogleMarkerInstance }) => void;
};

type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
};

type GooglePolylineOptions = {
  map: GoogleMapInstance;
  path: LatLngLiteral[];
  geodesic?: boolean;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  zIndex?: number;
};

type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance;
  Marker: new (options: GoogleMarkerOptions) => GoogleMarkerInstance;
  InfoWindow: new (options: { content: string }) => GoogleInfoWindowInstance;
  LatLngBounds: new () => GoogleLatLngBounds;
  Polyline?: new (options: GooglePolylineOptions) => GooglePolylineInstance;
};

declare global {
  interface Window {
    google?: {
      maps: GoogleMapsNamespace;
    };
    __cradleGoogleMapsPromise?: Promise<void>;
  }
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

function destinationMarkerIcon(trip: LiveMapTripItem): string {
  if (trip.stageKey === "in_service") {
    return "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
  }
  if (trip.stageKey === "collection" || trip.stageKey === "returning") {
    return "https://maps.google.com/mapfiles/ms/icons/orange-dot.png";
  }
  if (trip.stageKey === "arrived") {
    return "https://maps.google.com/mapfiles/ms/icons/purple-dot.png";
  }
  return "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
}

function SharedGoogleMapLayer({
  allTrips,
  filteredTrips,
  drivers,
  routesByDriver,
  selectedTrip,
  hasActiveFilter,
  onSelectTrip,
}: {
  allTrips: LiveMapTripItem[];
  filteredTrips: LiveMapTripItem[];
  drivers: DriverTrack[];
  routesByDriver: ReadonlyMap<string, { encodedPolyline: string | null }>;
  selectedTrip: LiveMapTripItem | null;
  hasActiveFilter: boolean;
  onSelectTrip: (bookingId: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<GoogleMarkerInstance[]>([]);
  const polylineRefs = useRef<GooglePolylineInstance[]>([]);
  const initialFitDoneRef = useRef(false);
  const lastFittedBookingRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
  const mapError = apiKey ? mapLoadError : "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is missing.";

  const filteredIds = useMemo(
    () => new Set(filteredTrips.map((t) => t.bookingId)),
    [filteredTrips]
  );

  // Mount the single Google Map instance once — never remount when trips or filters change
  useEffect(() => {
    if (!apiKey || !mapContainerRef.current) return;
    let cancelled = false;

    async function initMap() {
      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !mapContainerRef.current || !window.google?.maps) return;
        const maps = window.google.maps;

        if (!mapInstanceRef.current) {
          const firstDest = allTrips.find((t) => t.hasCustomerGps && t.lat !== null && t.lng !== null);
          const firstDriver = drivers.find((d) => d.location);
          const defaultCenter: LatLngLiteral = firstDest
            ? { lat: firstDest.lat as number, lng: firstDest.lng as number }
            : firstDriver?.location
              ? { lat: firstDriver.location.lat, lng: firstDriver.location.lng }
              : { lat: 10.6765, lng: 122.9509 };

          mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
            center: defaultCenter,
            zoom: 13,
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
    // Mount map instance cleanly once when apiKey & container exist
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Synchronize markers & genuine Google route polylines smoothly
  useEffect(() => {
    const map = mapInstanceRef.current;
    const maps = window.google?.maps;
    if (!mapReady || !map || !maps) return;

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
    polylineRefs.current.forEach((polyline) => polyline.setMap(null));
    polylineRefs.current = [];

    const selectedDriverId = selectedTrip?.driverId ?? null;
    const overviewBounds = new maps.LatLngBounds();
    let overviewCount = 0;

    // 1. Booking destination markers (emphasized if selected or matches filter, dimmed if filtered out)
    for (const trip of allTrips) {
      if (!trip.hasCustomerGps || trip.lat === null || trip.lng === null) continue;
      const pos = { lat: trip.lat, lng: trip.lng };
      const isSelected = selectedTrip?.bookingId === trip.bookingId;
      const matchesFilter = !hasActiveFilter || filteredIds.has(trip.bookingId);
      const isSameVehicle = Boolean(selectedDriverId && trip.driverId === selectedDriverId);

      if (matchesFilter || isSelected) {
        overviewBounds.extend(pos);
        overviewCount += 1;
      }

      const opacity = isSelected ? 1 : selectedTrip ? (isSameVehicle ? 0.85 : 0.45) : matchesFilter ? 1 : 0.3;
      const marker = new maps.Marker({
        map,
        position: pos,
        title: `${trip.bookingNumber} · ${trip.customerName} (${trip.detailedStatusLabel})`,
        label: trip.bookingNumber.replace(/^#/, ""),
        icon: destinationMarkerIcon(trip),
        zIndex: isSelected ? 90 : isSameVehicle ? 50 : matchesFilter ? 20 : 5,
        opacity,
      });

      const infoWindow = new maps.InfoWindow({
        content: `
          <div style="min-width: 220px; font-family: system-ui, sans-serif;">
            <div style="font-size: 12px; color: #64748b;">${escapeHtml(trip.bookingNumber)} · ${escapeHtml(trip.stageBadgeLabel)}</div>
            <div style="font-weight: 700; font-size: 14px; margin-top: 2px;">${escapeHtml(trip.customerName)}</div>
            <div style="font-size: 12px; color: #475569; margin-top: 3px;">${escapeHtml(trip.serviceName)} · ${escapeHtml(trip.locationSummary)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 5px;">Driver: ${escapeHtml(trip.driverName ?? "Needs driver")}</div>
          </div>
        `,
      });

      marker.addListener("click", () => {
        onSelectTrip(trip.bookingId);
        infoWindow.open({ map, anchor: marker });
      });

      markerRefs.current.push(marker);
    }

    // 2. Physical driver vehicle markers (ONE per driverId — never duplicated across shared trips)
    for (const driver of drivers) {
      const driverPos =
        driver.location && isValidGeoPoint({ lat: driver.location.lat, lng: driver.location.lng })
          ? { lat: driver.location.lat, lng: driver.location.lng }
          : null;

      if (driverPos) {
        overviewBounds.extend(driverPos);
        overviewCount += 1;

        const isSelectedDriver = Boolean(selectedDriverId && driver.driverId === selectedDriverId);
        const primaryBookingId = driver.nextStop?.bookingId ?? driver.stops[0]?.bookingId ?? null;
        const opacity = selectedTrip ? (isSelectedDriver ? 1 : 0.65) : 1;

        const marker = new maps.Marker({
          map,
          position: driverPos,
          title: `${driver.driverName} · ${driver.currentStatusLabel} · ${driver.reliability.label}`,
          label: driverInitials(driver.driverName),
          icon: driverMarkerIcon(driver.reliability.state),
          zIndex: isSelectedDriver ? 100 : 40,
          opacity,
        });

        const nextLabel = driver.nextStop
          ? `${driver.nextStop.customerName} (${driver.nextStop.destinationLabel})`
          : "Active assignment";
        const infoWindow = new maps.InfoWindow({
          content: `
            <div style="min-width: 220px; font-family: system-ui, sans-serif;">
              <div style="font-size: 11px; color: #155A33; font-weight: 700;">${escapeHtml(driver.reliability.label)}</div>
              <div style="font-weight: 700; font-size: 14px; margin-top: 2px;">${escapeHtml(driver.driverName)}</div>
              <div style="font-size: 12px; color: #334155; margin-top: 4px;">${escapeHtml(driver.currentStatusLabel)} · ${escapeHtml(formatDurationMinutes(driver.etaMinutes))}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Next: ${escapeHtml(nextLabel)}</div>
            </div>
          `,
        });

        marker.addListener("click", () => {
          if (primaryBookingId) onSelectTrip(primaryBookingId);
          infoWindow.open({ map, anchor: marker });
        });

        markerRefs.current.push(marker);
      }

      // 3. Genuine Google Routes API Polylines ONLY — never fabricate straight-line geometry as navigation
      if (maps.Polyline && driver.driverId) {
        const cachedRoute = routesByDriver.get(driver.driverId);
        if (cachedRoute?.encodedPolyline) {
          const decodedPath = decodeEncodedPolyline(cachedRoute.encodedPolyline);
          if (decodedPath.length >= 2) {
            const isSelectedRoute = Boolean(selectedTrip && driver.driverId === selectedDriverId);
            const selectedColor = selectedTrip
              ? TRIP_STAGE_STYLES[selectedTrip.stageKey].accentHex
              : "#155A33";

            const polyline = new maps.Polyline({
              map,
              path: decodedPath,
              geodesic: true,
              strokeColor: isSelectedRoute ? selectedColor : "#64748b",
              strokeOpacity: isSelectedRoute ? 0.96 : selectedTrip ? 0.18 : 0.34,
              strokeWeight: isSelectedRoute ? 6 : 2.5,
              zIndex: isSelectedRoute ? 60 : 5,
            });
            polylineRefs.current.push(polyline);
          }
        }
      }
    }

    // Only adjust map bounds on initial mount OR explicit booking selection change (never on GPS ticks!)
    if (!initialFitDoneRef.current && !selectedTrip && overviewCount > 0) {
      initialFitDoneRef.current = true;
      if (overviewCount > 1) {
        map.fitBounds(overviewBounds, 96);
      } else {
        const single =
          allTrips.find((t) => t.hasCustomerGps && t.lat !== null && t.lng !== null)
            ? {
              lat: allTrips.find((t) => t.hasCustomerGps)!.lat as number,
              lng: allTrips.find((t) => t.hasCustomerGps)!.lng as number,
            }
            : { lat: 10.6765, lng: 122.9509 };
        map.setCenter(single);
        map.setZoom(14);
      }
    }

    if (selectedTrip && lastFittedBookingRef.current !== selectedTrip.bookingId) {
      initialFitDoneRef.current = true;
      lastFittedBookingRef.current = selectedTrip.bookingId;
      const focusBounds = new maps.LatLngBounds();
      let focusCount = 0;

      if (selectedTrip.hasCustomerGps && selectedTrip.lat !== null && selectedTrip.lng !== null) {
        focusBounds.extend({ lat: selectedTrip.lat, lng: selectedTrip.lng });
        focusCount += 1;
      }

      const assignedDriver = selectedDriverId
        ? drivers.find((d) => d.driverId === selectedDriverId)
        : null;
      if (
        assignedDriver?.location &&
        isValidGeoPoint({ lat: assignedDriver.location.lat, lng: assignedDriver.location.lng })
      ) {
        focusBounds.extend({
          lat: assignedDriver.location.lat,
          lng: assignedDriver.location.lng,
        });
        focusCount += 1;
      }

      if (focusCount > 1) {
        map.fitBounds(focusBounds, 110);
      } else if (
        focusCount === 1 &&
        selectedTrip.hasCustomerGps &&
        selectedTrip.lat !== null &&
        selectedTrip.lng !== null
      ) {
        map.setCenter({ lat: selectedTrip.lat, lng: selectedTrip.lng });
        map.setZoom(15);
      }
    } else if (!selectedTrip) {
      lastFittedBookingRef.current = null;
    }
  }, [
    allTrips,
    drivers,
    filteredIds,
    hasActiveFilter,
    mapReady,
    onSelectTrip,
    routesByDriver,
    selectedTrip,
  ]);

  if (mapError) {
    const fallbackUrl =
      selectedTrip?.hasCustomerGps && selectedTrip.lat !== null && selectedTrip.lng !== null
        ? `https://www.google.com/maps/dir/?api=1&destination=${selectedTrip.lat},${selectedTrip.lng}&travelmode=driving`
        : "https://www.google.com/maps";

    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--cs-surface-warm)] p-8 text-center">
        <MapPin className="mb-3 text-[var(--cs-text-muted)]" size={38} />
        <h3 className="text-lg font-bold text-[var(--cs-text)]">Live Google Map is not ready</h3>
        <p className="mt-2 max-w-md text-sm text-[var(--cs-text-secondary)]">{mapError}</p>
        {selectedTrip ? (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#155A33] px-4 text-xs font-bold text-white hover:bg-[#104728]"
          >
            Open selected customer in Google Maps
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
    );
  }

  return <div ref={mapContainerRef} data-testid="shared-google-map" className="h-full w-full" />;
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
  const [activeFilter, setActiveFilter] = useState<TripFilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    initialSelectedBookingId ?? null
  );
  const [detailsOpen, setDetailsOpen] = useState<boolean>(Boolean(initialSelectedBookingId));
  const [dismissedArrivalKey, setDismissedArrivalKey] = useState<string | null>(null);

  const handleSelectTrip = useCallback((bookingId: string) => {
    setSelectedBookingId(bookingId);
    setDetailsOpen(true);
  }, []);

  const sync = useLiveCrmMapSync({
    data,
    branchId,
    onRefresh,
    onSelectBooking: handleSelectTrip,
  });

  const openBookings = useMemo(() => {
    const byOpen = data.items.filter((item) => isOpenHomeServiceBooking(item, data.today));
    const trackedIds = new Set(sync.tripsViewModel.trips.map((t) => t.bookingId));
    const extras = data.items.filter(
      (item) => trackedIds.has(item.id) && !byOpen.some((existing) => existing.id === item.id)
    );
    return [...byOpen, ...extras];
  }, [data.items, data.today, sync.tripsViewModel.trips]);

  const filteredTrips = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return sync.tripsViewModel.trips.filter((trip) => {
      if (activeFilter !== "all" && trip.stageKey !== activeFilter) {
        return false;
      }
      if (!normalized) return true;
      return [
        trip.bookingNumber,
        trip.customerName,
        trip.serviceName,
        trip.locationSummary,
        trip.driverName ?? "",
        trip.therapistName ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [activeFilter, searchQuery, sync.tripsViewModel.trips]);

  // Keep selected trip intact across realtime location/stage updates (clear only if trip becomes terminal/missing)
  const selectedTrip = useMemo(() => {
    if (!selectedBookingId) return null;
    return (
      sync.tripsViewModel.trips.find((trip) => trip.bookingId === selectedBookingId) ?? null
    );
  }, [selectedBookingId, sync.tripsViewModel.trips]);

  const selectedDriverId = selectedTrip?.driverId ?? null;

  const sharedDriverStops = useMemo(() => {
    if (!selectedDriverId) return [];
    return sync.tripsViewModel.trips.filter(
      (trip) => trip.driverId === selectedDriverId
    );
  }, [selectedDriverId, sync.tripsViewModel.trips]);

  const selectedRoute = useMemo(() => {
    if (!selectedDriverId) return null;
    return sync.routesByDriver.get(selectedDriverId) ?? null;
  }, [selectedDriverId, sync.routesByDriver]);

  const latestArrival = useMemo(() => {
    const top = sync.arrivalFeed[0] ?? null;
    if (!top) return null;
    if (dismissedArrivalKey === top.semanticKey) return null;
    return top;
  }, [dismissedArrivalKey, sync.arrivalFeed]);

  const liveGpsDriverCount = useMemo(
    () => sync.viewModel.drivers.filter((d) => d.reliability.isLive).length,
    [sync.viewModel.drivers]
  );

  if (openBookings.length === 0 && sync.tripsViewModel.trips.length === 0) {
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

  const refreshAction = onRefresh ?? (() => window.location.reload());

  return (
    <section className="space-y-3">
      {sync.connectionState !== "connected" ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900"
        >
          <WifiOff size={14} />
          <span>
            Realtime connection interrupted — reconnecting to restore current journey state.
          </span>
        </div>
      ) : null}

      <LiveMapFilterBar
        activeFilter={activeFilter}
        counts={sync.tripsViewModel.counts}
        onSelectFilter={setActiveFilter}
        onRefresh={refreshAction}
      />

      {sync.tripsViewModel.trips.some((t) => !t.hasCustomerGps) ? (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs text-amber-900"
        >
          Home Service bookings are active, but some customer locations still need GPS.
        </p>
      ) : null}

      <div className="relative h-[calc(100vh-205px)] min-h-[600px] w-full overflow-hidden rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-sm lg:min-h-[660px]">
        <SharedGoogleMapLayer
          allTrips={sync.tripsViewModel.trips}
          filteredTrips={filteredTrips}
          drivers={sync.viewModel.drivers}
          routesByDriver={sync.routesByDriver}
          selectedTrip={selectedTrip}
          hasActiveFilter={activeFilter !== "all" || Boolean(searchQuery.trim())}
          onSelectTrip={handleSelectTrip}
        />

        <FloatingTripRail
          trips={filteredTrips}
          totalCount={sync.tripsViewModel.counts.all}
          selectedBookingId={selectedTrip?.bookingId ?? null}
          collapsed={railCollapsed}
          hiddenOnMobile={Boolean(selectedTrip && detailsOpen)}
          searchQuery={searchQuery}
          hasActiveFilter={activeFilter !== "all"}
          onToggleCollapsed={() => setRailCollapsed((prev) => !prev)}
          onSearchChange={setSearchQuery}
          onClearFilter={() => setActiveFilter("all")}
          onSelectTrip={handleSelectTrip}
        />

        <ContextualJourneyPanel
          trip={selectedTrip}
          sharedStops={sharedDriverStops}
          route={selectedRoute}
          open={Boolean(selectedTrip && detailsOpen)}
          onClose={() => setDetailsOpen(false)}
          onReopen={() => setDetailsOpen(true)}
          onSelectTrip={handleSelectTrip}
        />

        {/* Bottom-left automated arrival notification card */}
        {latestArrival ? (
          <div
            role="status"
            aria-label="Latest driver arrival notification"
            className="pointer-events-auto absolute bottom-14 left-3 z-20 flex max-w-[330px] items-start gap-2.5 rounded-2xl border border-[var(--cs-border)] bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-3 md:left-4"
          >
            <Bell size={15} className="mt-0.5 shrink-0 text-[#155A33]" />
            <div className="min-w-0 flex-1 text-xs">
              <button
                type="button"
                onClick={() => handleSelectTrip(latestArrival.event.bookingId)}
                className="text-left font-bold text-[var(--cs-text)] hover:underline"
              >
                {latestArrival.copy.title}
              </button>
              <p className="mt-0.5 line-clamp-2 text-[0.7rem] text-[var(--cs-text-secondary)]">
                {latestArrival.copy.body}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close arrival alert"
              onClick={() => setDismissedArrivalKey(latestArrival.semanticKey)}
              className="shrink-0 rounded-md p-0.5 text-[var(--cs-text-muted)] hover:bg-[var(--cs-surface-warm)] hover:text-[var(--cs-text)]"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}

        {/* Bottom-center compact legend pill */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 hidden justify-center px-4 md:flex">
          <div className="flex items-center gap-3 rounded-full border border-white/80 bg-white/95 px-4 py-1.5 text-[0.7rem] font-medium text-[var(--cs-text-secondary)] shadow-md backdrop-blur">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-600" />
              Driver
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-purple-600" />
              Customer
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-600" />
              Service
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-orange-600" />
              Collection
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[2.5px] w-4 rounded-full bg-[#155A33]" />
              Active Route
            </span>
          </div>
        </div>

        {/* Bottom-right live tracking status pill */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-20 md:right-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#103824]/95 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
            <Radio
              size={13}
              className={
                sync.connectionState !== "connected"
                  ? "text-amber-400"
                  : liveGpsDriverCount > 0
                    ? "text-emerald-400"
                    : "text-slate-300"
              }
            />
            <span>
              {sync.connectionState !== "connected"
                ? "Reconnecting live sync"
                : sync.viewModel.drivers.length === 0
                  ? "Tracking Status: Awaiting driver assignment"
                  : liveGpsDriverCount > 0
                    ? `Live Tracking: ${sync.viewModel.drivers.length} Drivers (${liveGpsDriverCount} live GPS)`
                    : `Tracking Status: ${sync.viewModel.drivers.length} Drivers (GPS pending/stale)`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
