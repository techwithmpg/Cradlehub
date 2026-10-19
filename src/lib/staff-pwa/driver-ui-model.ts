import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

// A driver is transporting staff only while en route. Arrival releases the
// outbound trip without completing the therapist's home-service booking.
const activeStatuses = new Set(["in_route"]);

export function isDriverTripClosed(item: RealDispatchItem): boolean {
  return item.dispatchStatus === "completed" || item.dispatchStatus === "cancelled";
}

export function getDriverPrimaryTrip(items: RealDispatchItem[]): RealDispatchItem | null {
  const open = items
    .filter((item) => !isDriverTripClosed(item))
    .sort((a, b) =>
      `${a.bookingDate}T${a.startTime}`.localeCompare(`${b.bookingDate}T${b.startTime}`)
    );
  return (
    open.find((item) => activeStatuses.has(item.dispatchStatus)) ??
    open.find((item) => item.dispatchStatus === "ready") ??
    open[0] ??
    null
  );
}

export function getDriverTripSummary(items: RealDispatchItem[]) {
  return {
    today: items.filter((item) => item.dispatchStatus !== "cancelled").length,
    completed: items.filter((item) => item.dispatchStatus === "completed").length,
    remaining: items.filter((item) => !isDriverTripClosed(item)).length,
  };
}

export function getDriverProgressLabel(item: RealDispatchItem): string {
  switch (item.bookingProgressStatus) {
    case "travel_started":
      return "En route";
    case "arrived":
      return "Arrived";
    case "session_started":
      return "Service in progress";
    case "completed":
      return "Completed";
    default:
      return item.bookingStatus === "completed" ? "Completed" : "Ready to travel";
  }
}

export function getNextDriverAction(
  item: RealDispatchItem
): { label: string; nextStatus: "travel_started" | "arrived" } | null {
  if (item.bookingStatus !== "confirmed" && item.bookingStatus !== "in_progress") return null;
  if (item.bookingProgressStatus === "not_started") {
    return { label: "Start travel", nextStatus: "travel_started" };
  }
  if (item.bookingProgressStatus === "travel_started") {
    return { label: "Mark arrived", nextStatus: "arrived" };
  }
  return null;
}

export function getDriverNavigationUrl(item: RealDispatchItem): string | null {
  if (
    item.lat !== null &&
    item.lng !== null &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lng) &&
    Math.abs(item.lat) <= 90 &&
    Math.abs(item.lng) <= 180
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`;
  }
  if (item.formattedAddress) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.formattedAddress)}&travelmode=driving`;
  }
  return null;
}
