import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";

export function isOpenHomeServiceBooking(item: RealDispatchItem): boolean {
  return (
    !["cancelled", "no_show", "completed"].includes(item.bookingStatus) &&
    !["completed", "no_show"].includes(item.bookingProgressStatus)
  );
}

export function hasCustomerGps(item: RealDispatchItem): boolean {
  return (
    typeof item.lat === "number" &&
    Number.isFinite(item.lat) &&
    Math.abs(item.lat) <= 90 &&
    typeof item.lng === "number" &&
    Number.isFinite(item.lng) &&
    Math.abs(item.lng) <= 180
  );
}

export function eligibleCustomerDestinations(items: RealDispatchItem[]): RealDispatchItem[] {
  return items.filter((item) => isOpenHomeServiceBooking(item) && hasCustomerGps(item));
}
