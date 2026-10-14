import { addDaysToYmd } from "@/lib/engine/slot-time";
import { CRM_OPERATIONAL_BOOKING_STATUSES } from "@/lib/bookings/crm-booking-status";

// Match the established Staff work planning window.
export const UPCOMING_BOOKING_DAYS = 14;
export const UPCOMING_BOOKING_STATUSES = CRM_OPERATIONAL_BOOKING_STATUSES;

export function upcomingBookingEndDate(businessDate: string): string {
  return addDaysToYmd(businessDate, UPCOMING_BOOKING_DAYS);
}

export function isUpcomingBookingDate(date: string, businessDate: string): boolean {
  return date > businessDate && date <= upcomingBookingEndDate(businessDate);
}
