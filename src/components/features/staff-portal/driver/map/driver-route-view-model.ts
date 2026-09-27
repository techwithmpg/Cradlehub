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
  bookingProgressStatus: string;
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
  recordedLocation: RealDispatchItem["currentLocation"];
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
  if (item.lat !== null && item.lng !== null && Number.isFinite(item.lat) && Number.isFinite(item.lng) && Math.abs(item.lat) <= 90 && Math.abs(item.lng) <= 180) {
    const destination = `${item.lat},${item.lng}`;
    return mode === "directions"
      ? `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${destination}`;
  }

  const query = item.formattedAddress;
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
      bookingProgressStatus: item.bookingProgressStatus,
      isNextStop: item.id === nextItem?.id,
      isCompleted: isCompleted(item.dispatchStatus),
      isActive: ACTIVE_STATUSES.has(item.dispatchStatus),
      needsLocationReview: item.needsLocationReview || (!item.formattedAddress && !item.area),
      etaMinutes: item.eta?.source === "stored_routes_api" ? item.eta.minutes : null,
      etaLabel: item.eta?.source === "stored_routes_api" ? `Recorded ETA ${item.eta.minutes} min (${item.eta.calculatedAt ?? "time unavailable"})` : "ETA unavailable",
      distanceLabel: "Road distance unavailable",
      recordedLocation: item.currentLocation,
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
    etaLabel: nextStop?.etaLabel ?? "ETA unavailable",
    distanceLabel: nextStop?.distanceLabel ?? "Road distance unavailable",
    trafficLabel: "Traffic unavailable",
    liveLocationLabel: nextItem?.currentLocation ? `Location recorded ${nextItem.currentLocation.recorded_at}` : "Location unavailable",
    openRouteUrl: nextStop?.navigationUrl ?? nextStop?.mapSearchUrl ?? null,
  };
}
