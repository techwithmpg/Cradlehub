"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime12h } from "@/lib/utils/time-format";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";

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
};

type GoogleInfoWindowInstance = {
  open: (options: { map: GoogleMapInstance; anchor: GoogleMarkerInstance }) => void;
};

type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance;
  Marker: new (options: GoogleMarkerOptions) => GoogleMarkerInstance;
  InfoWindow: new (options: { content: string }) => GoogleInfoWindowInstance;
  LatLngBounds: new () => GoogleLatLngBounds;
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

type StaffMarker = {
  booking: RealDispatchItem;
  position: LatLngLiteral;
  label: string;
};

function isOpenHomeServiceBooking(item: RealDispatchItem): boolean {
  return !["cancelled", "no_show", "completed"].includes(item.bookingStatus);
}

function hasCustomerGps(item: RealDispatchItem): boolean {
  return (
    typeof item.lat === "number" &&
    Number.isFinite(item.lat) &&
    typeof item.lng === "number" &&
    Number.isFinite(item.lng)
  );
}
function hasStaffGps(item: RealDispatchItem): boolean {
  return Boolean(item.currentLocation);
}

function locationLabel(item: RealDispatchItem): string {
  return item.area ?? item.formattedAddress ?? "Customer GPS saved";
}

function statusLabel(item: RealDispatchItem): string {
  if (!hasCustomerGps(item)) return "GPS Missing";
  if (!item.driverId) return "Needs Driver";
  if (item.dispatchStatus === "scheduled") return "Scheduled";
  if (item.dispatchStatus === "released_to_driver") return "Released";
  if (item.dispatchStatus === "in_route") return "En Route";
  if (item.dispatchStatus === "arrived_at_customer") return "Arrived";
  if (item.dispatchStatus === "service_started") return "In Service";
  return "Ready";
}

function statusClass(item: RealDispatchItem): string {
  if (!hasCustomerGps(item)) return "border-red-300 bg-red-50 text-red-700";
  if (!item.driverId) return "border-amber-300 bg-amber-50 text-amber-700";
  if (item.dispatchStatus === "scheduled") return "border-blue-300 bg-blue-50 text-blue-700";
  if (item.dispatchStatus === "released_to_driver") {
    return "border-purple-300 bg-purple-50 text-purple-700";
  }
  if (["in_route", "arrived_at_customer", "service_started"].includes(item.dispatchStatus)) {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
  return "border-green-300 bg-green-50 text-green-700";
}

function formatCoord(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(5);
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

function BookingSummaryCard({
  item,
  selected,
  onSelect,
}: {
  item: RealDispatchItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const gpsReady = hasCustomerGps(item);
  const staffGpsReady = hasStaffGps(item);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:border-[#155A33] hover:shadow-md ${
        selected
          ? "border-[#155A33] bg-green-50"
          : "border-[var(--cs-border)] bg-[var(--cs-surface)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[var(--cs-text-muted)]">{item.number}</p>
          <h3 className="mt-1 truncate text-base font-bold text-[var(--cs-text)]">
            {item.customerName}
          </h3>
          <p className="mt-0.5 truncate text-sm text-[var(--cs-text-secondary)]">
            {item.serviceName}
          </p>
        </div>

        <Badge variant="outline" className={`shrink-0 text-[0.68rem] ${statusClass(item)}`}>
          {statusLabel(item)}
        </Badge>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-[var(--cs-text-secondary)]">
        <div className="flex items-center gap-1.5">
          <Clock size={13} />
          <span>
            {formatTime12h(item.startTime)}
            {item.endTime ? ` – ${formatTime12h(item.endTime)}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <MapPin size={13} />
          <span className="truncate">{locationLabel(item)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {gpsReady ? (
            <CheckCircle2 size={13} className="text-green-600" />
          ) : (
            <AlertCircle size={13} className="text-red-600" />
          )}
          <span>{gpsReady ? "Customer GPS ready" : "Customer GPS missing"}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {staffGpsReady ? (
            <CheckCircle2 size={13} className="text-blue-600" />
          ) : (
            <Car size={13} />
          )}
          <span>{staffGpsReady ? "Driver/staff GPS live" : "No live driver GPS yet"}</span>
        </div>
      </div>
    </button>
  );
}

function MapCanvas({
  bookings,
  selectedId,
  onSelect,
}: {
  bookings: RealDispatchItem[];
  selectedId: string | null;
  onSelect: (bookingId: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<GoogleMarkerInstance[]>([]);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "";
  const mapError = apiKey ? mapLoadError : "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is missing.";

  const customerMarkers: CustomerMarker[] = useMemo(
    () =>
      bookings
        .filter(hasCustomerGps)
        .map((booking, index) => ({
          booking,
          position: {
            lat: booking.lat as number,
            lng: booking.lng as number,
          },
          label: String(index + 1),
        })),
    [bookings]
  );

  const staffMarkers: StaffMarker[] = useMemo(
    () =>
      bookings
        .filter((booking) => booking.currentLocation)
        .map((booking, index) => ({
          booking,
          position: {
            lat: booking.currentLocation?.lat as number,
            lng: booking.currentLocation?.lng as number,
          },
          label: String(index + 1),
        })),
    [bookings]
  );

  useEffect(() => {
    if (!apiKey) return;

    if (!mapRef.current) return;

    let cancelled = false;

    async function renderMap() {
      try {
        await loadGoogleMaps(apiKey);

        if (cancelled || !mapRef.current || !window.google?.maps) return;

        const maps = window.google.maps;
        const defaultCenter = customerMarkers[0]?.position ?? {
          lat: 10.6765,
          lng: 122.9509,
        };

        const map = new maps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: customerMarkers.length > 0 ? 13 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: true,
        });

        markerRefs.current.forEach((marker) => marker.setMap(null));
        markerRefs.current = [];

        const bounds = new maps.LatLngBounds();

        customerMarkers.forEach((marker) => {
          bounds.extend(marker.position);

          const markerInstance = new maps.Marker({
            map,
            position: marker.position,
            title: marker.booking.customerName,
            label: marker.label,
            icon: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          });

          const infoWindow = new maps.InfoWindow({
            content: `
              <div style="min-width: 220px; font-family: system-ui, sans-serif;">
                <div style="font-size: 12px; color: #6b5b4b;">${escapeHtml(marker.booking.number)}</div>
                <div style="font-weight: 700; font-size: 15px; margin-top: 2px;">${escapeHtml(marker.booking.customerName)}</div>
                <div style="font-size: 13px; color: #5f5146; margin-top: 4px;">${escapeHtml(marker.booking.serviceName)} · ${escapeHtml(formatTime12h(marker.booking.startTime))}</div>
                <div style="font-size: 12px; color: #6b5b4b; margin-top: 8px;">${escapeHtml(locationLabel(marker.booking))}</div>
              </div>
            `,
          });

          markerInstance.addListener("click", () => {
            onSelect(marker.booking.id);
            infoWindow.open({ map, anchor: markerInstance });
          });

          markerRefs.current.push(markerInstance);
        });

        staffMarkers.forEach((marker) => {
          bounds.extend(marker.position);

          const markerInstance = new maps.Marker({
            map,
            position: marker.position,
            title: marker.booking.driverName ?? marker.booking.therapistName ?? "Driver/staff",
            label: "D",
            icon: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          });

          markerInstance.addListener("click", () => {
            onSelect(marker.booking.id);
          });

          markerRefs.current.push(markerInstance);
        });

        const totalVisibleMarkers = customerMarkers.length + staffMarkers.length;

        if (totalVisibleMarkers > 1) {
          map.fitBounds(bounds, 80);
        } else if (totalVisibleMarkers === 1) {
          map.setCenter(customerMarkers[0]?.position ?? staffMarkers[0]?.position ?? defaultCenter);
          map.setZoom(15);
        } else {
          map.setCenter(defaultCenter);
          map.setZoom(12);
        }

        setMapLoadError(null);
      } catch {
        setMapLoadError("Google Maps could not load.");
      }
    }

    void renderMap();

    return () => {
      cancelled = true;
      markerRefs.current.forEach((marker) => marker.setMap(null));
      markerRefs.current = [];
    };
  }, [apiKey, customerMarkers, staffMarkers, onSelect]);

  const selectedBooking = bookings.find((booking) => booking.id === selectedId) ?? null;
  const selectedRouteUrl = selectedBooking ? buildRouteUrl(selectedBooking) : "https://www.google.com/maps";

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
        <div ref={mapRef} className="h-full w-full" />
      )}

      <div className="pointer-events-none absolute left-5 top-5 rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-sm font-bold text-[var(--cs-text)]">Live Home-Service Map</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[var(--cs-text-secondary)]">
            <span className="size-3 rounded-full bg-red-500" />
            Customer booking locations
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--cs-text-secondary)]">
            <span className="size-3 rounded-full bg-blue-500" />
            Driver/staff live GPS
          </span>
        </div>
      </div>

      {selectedBooking ? (
        <div className="absolute bottom-5 right-5 w-[320px] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-[var(--cs-text-muted)]">{selectedBooking.number}</p>
              <h3 className="mt-1 truncate text-base font-bold text-[var(--cs-text)]">
                {selectedBooking.customerName}
              </h3>
              <p className="mt-1 text-xs text-[var(--cs-text-secondary)]">
                {selectedBooking.serviceName} · {formatTime12h(selectedBooking.startTime)}
              </p>
            </div>
            <Badge variant="outline" className={`shrink-0 text-[0.68rem] ${statusClass(selectedBooking)}`}>
              {statusLabel(selectedBooking)}
            </Badge>
          </div>

          <div className="mt-3 space-y-1.5 text-xs text-[var(--cs-text-secondary)]">
            <div className="flex items-center gap-1.5">
              <MapPin size={13} />
              <span className="truncate">{locationLabel(selectedBooking)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Navigation size={13} />
              <span>
                {formatCoord(selectedBooking.lat)}, {formatCoord(selectedBooking.lng)}
              </span>
            </div>
          </div>

          <a
            href={selectedRouteUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#155A33] px-4 text-sm font-bold text-white hover:bg-[#104728]"
          >
            Open Customer Route
            <ExternalLink size={13} />
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function DispatchLiveMapTab({ data }: { data: DispatchData }) {
  const [query, setQuery] = useState("");
  const openBookings = useMemo(() => data.items.filter(isOpenHomeServiceBooking), [data.items]);

  const filteredBookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return openBookings;

    return openBookings.filter((item) => {
      return [
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
        .includes(normalized);
    });
  }, [openBookings, query]);

  const [requestedSelectedId, setRequestedSelectedId] = useState<string | null>(null);
  const selectedId = useMemo(() => {
    if (filteredBookings.length === 0) return null;
    if (requestedSelectedId && filteredBookings.some((item) => item.id === requestedSelectedId)) {
      return requestedSelectedId;
    }
    return filteredBookings[0]?.id ?? null;
  }, [filteredBookings, requestedSelectedId]);
  const handleMapSelect = useCallback((bookingId: string) => {
    setRequestedSelectedId(bookingId);
  }, []);

  if (openBookings.length === 0) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface)] p-10 text-center">
        <MapPin className="mb-3 text-[var(--cs-text-muted)]" size={34} />
        <h3 className="font-bold text-[var(--cs-text)]">No home-service bookings to map</h3>
        <p className="mt-1 max-w-md text-sm text-[var(--cs-text-muted)]">
          Pending, confirmed, scheduled, and released home-service bookings will appear here when
          customer GPS coordinates are saved.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--cs-text)]">Live Home-Service Map</h2>
          <p className="mt-1 text-sm text-[var(--cs-text-secondary)]">
            Every home-service booking with saved customer GPS appears directly on the live map.
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
                placeholder="Search client, service, area..."
                className="h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] pl-9 pr-3 text-sm outline-none transition focus:border-[#155A33] sm:w-[280px]"
              />
            </span>
          </label>

          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="h-[calc(100vh-235px)] min-h-[620px] overflow-hidden rounded-3xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[var(--cs-text)]">Home-Service Bookings</h3>
              <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
                {filteredBookings.length} shown · {openBookings.length} total
              </p>
            </div>
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              {openBookings.length}
            </Badge>
          </div>

          <div className="h-[calc(100%-62px)] space-y-3 overflow-y-auto pr-1">
            {filteredBookings.map((item) => (
              <BookingSummaryCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={() => setRequestedSelectedId(item.id)}
              />
            ))}

            {filteredBookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--cs-border)] px-4 py-8 text-center text-sm text-[var(--cs-text-muted)]">
                No matching home-service bookings.
              </div>
            ) : null}
          </div>
        </aside>

        <MapCanvas
          bookings={filteredBookings}
          selectedId={selectedId}
          onSelect={handleMapSelect}
        />
      </div>
    </section>
  );
}
