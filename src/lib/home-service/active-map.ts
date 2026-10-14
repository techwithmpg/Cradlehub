import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import { isCrmOperationalBookingStatus } from "@/lib/bookings/crm-booking-status";

const ACTIVE_OVERDUE_PROGRESS = ["travel_started", "arrived", "session_started"] as const;
const ACTIVE_BOOKING_STATUS = "in_progress";

type OperationalMapBooking = Pick<
  RealDispatchItem,
  "bookingDate" | "bookingStatus" | "bookingProgressStatus"
>;

// Keep this database prefilter aligned with isOpenHomeServiceBooking so pagination
// happens after stale past bookings have been excluded.
export function activeMapRelevanceFilter(businessDate: string): string {
  return `booking_date.gte.${businessDate},booking_progress_status.in.(${ACTIVE_OVERDUE_PROGRESS.join(",")}),status.eq.${ACTIVE_BOOKING_STATUS}`;
}

export function isOpenHomeServiceBooking(
  item: OperationalMapBooking,
  businessDate: string
): boolean {
  return (
    isCrmOperationalBookingStatus(item.bookingStatus) &&
    !["completed", "no_show"].includes(item.bookingProgressStatus) &&
    (item.bookingDate >= businessDate ||
      item.bookingStatus === ACTIVE_BOOKING_STATUS ||
      ACTIVE_OVERDUE_PROGRESS.some((progress) => progress === item.bookingProgressStatus))
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

export function eligibleCustomerDestinations(
  items: RealDispatchItem[],
  businessDate: string
): RealDispatchItem[] {
  return items.filter(
    (item) => isOpenHomeServiceBooking(item, businessDate) && hasCustomerGps(item)
  );
}
