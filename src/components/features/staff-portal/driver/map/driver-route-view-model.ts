import { formatTime12h } from "@/lib/utils/time-format";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export type DriverRouteState =
  | "no_route"
  | "upcoming"
  | "on_route"
  | "arrived"
  | "in_progress"
  | "completed";

export type DriverRouteStopViewModel = {
  id: string;
  stopNumber: number;
  customerName: string;
  customerInitials: string;
  serviceName: string;
  address: string;
  area: string | null;
  startTimeLabel: string;
  routeState: DriverRouteState;
  dispatchStatus: RealDispatchItem["dispatchStatus"];
  isNextStop: boolean;
  isCompleted: boolean;
  isActive: boolean;
  needsLocationReview: boolean;
  etaMinutes: number | null;
  etaLabel: string;
  distanceLabel: string;
  navigationUrl: string | null;
  mapSearchUrl: string | null;
  detailsHref: string;
};

export type DriverRoutePageViewModel = {
  routeState: DriverRouteState;
  dateLabel: string;
  stops: DriverRouteStopViewModel[];
  nextStop: DriverRouteStopViewModel | null;
  totalStops: number;
  completedStops: number;
  activeStops: number;
  attentionCount: number;
  etaLabel: string;
  distanceLabel: string;
  trafficLabel: string;
  liveLocationLabel: string;
  openRouteUrl: string | null;
};

type BuildDriverRoutePageViewModelOptions = {
  detailsBasePath: string;
  today?: Date;
};

const ACTIVE_STATUSES: ReadonlySet<RealDispatchItem["dispatchStatus"]> = new Set([
  "in_route",
  "arrived_at_customer",
  "service_started",
]);

function isCompleted(status: RealDispatchItem["dispatchStatus"]): boolean {
  return status === "completed";
}

function isRouteCandidate(status: RealDispatchItem["dispatchStatus"]): boolean {
  return status !== "completed" && status !== "cancelled";
}

function getRouteState(status: RealDispatchItem["dispatchStatus"]): DriverRouteState {
  if (status === "in_route") return "on_route";
  if (status === "arrived_at_customer") return "arrived";
  if (status === "service_started") return "in_progress";
  if (status === "completed") return "completed";
  return "upcoming";
}

function sortByStartTime(a: RealDispatchItem, b: RealDispatchItem): number {
  return `${a.bookingDate}T${a.startTime}`.localeCompare(`${b.bookingDate}T${b.startTime}`);
}

function buildMapUrl(item: RealDispatchItem, mode: "search" | "directions"): string | null {
  if (item.lat !== null && item.lng !== null) {
    const destination = `${item.lat},${item.lng}`;
    return mode === "directions"
      ? `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${destination}`;
  }

  const query = item.formattedAddress ?? item.area;
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return mode === "directions"
    ? `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

function initialsFor(name: string): string {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "C";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

function distanceKm(item: RealDispatchItem): number | null {
  if (!item.currentLocation || item.lat === null || item.lng === null) return null;

  const earthKm = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(item.lat - item.currentLocation.lat);
  const dLng = toRad(item.lng - item.currentLocation.lng);
  const startLat = toRad(item.currentLocation.lat);
  const endLat = toRad(item.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(item: RealDispatchItem): string {
  const km = distanceKm(item);
  if (km === null) return "Distance pending";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

function formatDateLabel(today: Date): string {
  return today.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

export function buildDriverRoutePageViewModel(
  items: RealDispatchItem[],
  options: BuildDriverRoutePageViewModelOptions
): DriverRoutePageViewModel {
  const routeItems = items
    .filter((item) => item.dispatchStatus !== "cancelled")
    .sort(sortByStartTime);

  const activeItem = routeItems.find((item) => ACTIVE_STATUSES.has(item.dispatchStatus)) ?? null;
  const nextItem = activeItem ?? routeItems.find((item) => isRouteCandidate(item.dispatchStatus)) ?? null;
  const allCompleted = routeItems.length > 0 && routeItems.every((item) => isCompleted(item.dispatchStatus));
  const routeState = nextItem
    ? getRouteState(nextItem.dispatchStatus)
    : allCompleted
      ? "completed"
      : "no_route";

  const stops = routeItems.map((item, index): DriverRouteStopViewModel => {
    const navigationUrl = buildMapUrl(item, "directions");
    return {
      id: item.id,
      stopNumber: index + 1,
      customerName: item.customerName,
      customerInitials: initialsFor(item.customerName),
      serviceName: item.serviceName,
      address: item.formattedAddress ?? item.area ?? "Address pending",
      area: item.area,
      startTimeLabel: formatTime12h(item.startTime),
      routeState: getRouteState(item.dispatchStatus),
      dispatchStatus: item.dispatchStatus,
      isNextStop: item.id === nextItem?.id,
      isCompleted: isCompleted(item.dispatchStatus),
      isActive: ACTIVE_STATUSES.has(item.dispatchStatus),
      needsLocationReview: item.needsLocationReview || (!item.formattedAddress && !item.area),
      etaMinutes: item.etaMinutes,
      etaLabel: item.etaMinutes !== null ? `${item.etaMinutes} min` : "ETA pending",
      distanceLabel: formatDistance(item),
      navigationUrl,
      mapSearchUrl: buildMapUrl(item, "search"),
      detailsHref: `${options.detailsBasePath}/${item.id}`,
    };
  });

  const nextStop = stops.find((stop) => stop.id === nextItem?.id) ?? null;

  return {
    routeState,
    dateLabel: formatDateLabel(options.today ?? new Date()),
    stops,
    nextStop,
    totalStops: stops.length,
    completedStops: stops.filter((stop) => stop.isCompleted).length,
    activeStops: stops.filter((stop) => stop.isActive).length,
    attentionCount: stops.filter((stop) => stop.needsLocationReview).length,
    etaLabel: nextStop?.etaLabel ?? "ETA pending",
    distanceLabel: nextStop?.distanceLabel ?? "Distance pending",
    trafficLabel: "Traffic pending",
    liveLocationLabel: nextItem?.currentLocation ? "Live location updated" : "Live location pending",
    openRouteUrl: nextStop?.navigationUrl ?? nextStop?.mapSearchUrl ?? null,
  };
}
