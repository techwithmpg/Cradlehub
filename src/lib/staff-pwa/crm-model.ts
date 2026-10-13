import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";

export type CrmMobileBooking = {
  id: string;
  branchId: string;
  date: string;
  time: string;
  status: string;
  progress: string | null;
  deliveryType: string | null;
  customerName: string;
  serviceName: string;
};

export type CrmBookingFilter = "today" | "upcoming" | "completed";

export function crmBookingCounts(bookings: readonly CrmMobileBooking[], today: string) {
  const current = bookings.filter((booking) => booking.date === today);
  return {
    today: current.length,
    arrived: current.filter(
      (booking) => booking.progress === "checked_in" || booking.progress === "arrived"
    ).length,
    inService: current.filter(
      (booking) => booking.progress === "session_started" || booking.status === "in_progress"
    ).length,
    attention: current.filter((booking) => isCrmPendingBookingStatus(booking.status)).length,
  };
}

export function filterCrmBookings(
  bookings: readonly CrmMobileBooking[],
  today: string,
  filter: CrmBookingFilter
) {
  if (filter === "completed") {
    return bookings.filter((booking) => booking.date === today && booking.status === "completed");
  }
  if (filter === "upcoming") {
    return bookings.filter((booking) => booking.date > today && booking.status !== "completed");
  }
  return bookings.filter((booking) => booking.date === today && booking.status !== "completed");
}

export function crmBookingStatusLabel(booking: CrmMobileBooking): string {
  if (booking.status === "completed" || booking.progress === "completed") return "Completed";
  if (booking.progress === "session_started" || booking.status === "in_progress")
    return "In service";
  if (booking.progress === "checked_in") return "Checked in";
  if (booking.progress === "arrived") return "Arrived";
  if (isCrmPendingBookingStatus(booking.status)) return "Needs review";
  if (booking.status === "confirmed") return "Confirmed";
  return booking.status.replaceAll("_", " ");
}
