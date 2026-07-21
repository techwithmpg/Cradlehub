import type {
  OneOrMany,
  WorkspaceBookingRow,
} from "@/components/features/bookings/booking-workspace-types";
import { isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";
import {
  isBookingOperationallyClosed,
  isHomeServiceBooking,
} from "@/lib/bookings/bookings-workspace-filters";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { formatTime } from "@/lib/utils";

export type BookingOperationalTone =
  | "pending"
  | "confirmed"
  | "waiting"
  | "service"
  | "completed"
  | "neutral"
  | "danger";

export function firstBookingRelation<T>(value: OneOrMany<T> | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function readBookingPrice(
  metadata: Record<string, unknown> | null | undefined
): number {
  const value = Number(metadata?.price_paid ?? 0);
  return Number.isFinite(value) ? value : 0;
}
export function readBookingAddOns(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const raw = metadata?.addons ?? metadata?.add_ons;
  if (!Array.isArray(raw)) return null;
  const labels = raw.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object" || !("name" in item)) return [];
    const name = (item as { name?: unknown }).name;
    return typeof name === "string" ? [name] : [];
  });
  return labels.length > 0 ? labels.join(", ") : null;
}
export function getBookingSourceLabel(booking: WorkspaceBookingRow): string {
  const crmMode = booking.metadata?.crm_booking_mode;
  if (crmMode === "phone") return "Phone";
  if (crmMode === "standard_future") return "Future";
  if (crmMode === "walkin") return "Walk-in";
  if (booking.type === "online") return "Online";
  if (booking.type === "walkin") return "Walk-in";
  return booking.type ? booking.type.replaceAll("_", " ") : "Booking";
}
export function getBookingDeliveryLabel(booking: WorkspaceBookingRow): string {
  return isHomeServiceBooking(booking) ? "Home Service" : "In-Spa";
}

export function getBookingCustomerInitials(name?: string | null): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "CH";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts.at(-1)?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase() || "CH";
}

export function getBookingStaffName(booking: WorkspaceBookingRow): string {
  const staff = firstBookingRelation(booking.staff);
  return staff ? getStaffAdminName(staff) : "Unassigned";
}

export function getBookingRoomLabel(booking: WorkspaceBookingRow): string {
  const resource = firstBookingRelation(booking.branch_resources);
  if (resource?.name) return resource.name;
  return isHomeServiceBooking(booking) ? "Home service" : "Room TBD";
}

export function getBookingDurationMinutes(booking: WorkspaceBookingRow): number {
  if (
    booking.session_duration_minutes_snapshot &&
    booking.session_duration_minutes_snapshot > 0
  ) {
    return booking.session_duration_minutes_snapshot;
  }

  const service = firstBookingRelation(booking.services);
  if (service?.duration_minutes && service.duration_minutes > 0) {
    return service.duration_minutes;
  }
  if (booking.end_time) {
    const start = new Date(`2000-01-01T${booking.start_time}`).getTime();
    const end = new Date(`2000-01-01T${booking.end_time}`).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return Math.round((end - start) / 60_000);
    }
  }
  return 0;
}

export function getBookingTimeRange(booking: WorkspaceBookingRow): string {
  const start = formatTime(booking.start_time);
  return booking.end_time ? `${start}–${formatTime(booking.end_time)}` : start;
}

export function formatBookingDisplayDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function getBookingOperationalStatus(booking: WorkspaceBookingRow): {
  label: string;
  tone: BookingOperationalTone;
} {
  const progress = booking.booking_progress_status ?? null;
  if (isCrmPendingBookingStatus(booking.status)) {
    return { label: "Pending Call", tone: "pending" };
  }
  if (booking.status === "cancelled") return { label: "Cancelled", tone: "danger" };
  if (booking.status === "no_show" || progress === "no_show") {
    return { label: "No-show", tone: "danger" };
  }
  if (booking.status === "completed" || progress === "completed") {
    return { label: "Completed", tone: "completed" };
  }
  if (booking.status === "in_progress" || progress === "session_started") {
    return { label: "In Service", tone: "service" };
  }
  if (progress === "travel_started") return { label: "Travel Started", tone: "service" };
  if (progress === "arrived") return { label: "Arrived", tone: "waiting" };
  if (progress === "checked_in") return { label: "Checked In", tone: "waiting" };
  if (booking.status === "confirmed") return { label: "Confirmed", tone: "confirmed" };
  if (isBookingOperationallyClosed(booking)) return { label: "Closed", tone: "neutral" };
  return { label: booking.status.replaceAll("_", " "), tone: "neutral" };
}

export function buildBookingConfirmationMessage(
  booking: WorkspaceBookingRow
): string {
  const customer = firstBookingRelation(booking.customers);
  const service = firstBookingRelation(booking.services);
  const branch = firstBookingRelation(booking.branches);
  return [
    `Hi ${customer?.full_name ?? "there"}, this is CradleHub confirming your booking.`,
    `Service: ${service?.name ?? "your selected service"}.`,
    `Schedule: ${new Date(`${booking.booking_date}T00:00:00`).toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
    })} at ${formatTime(booking.start_time)}.`,
    branch?.name ? `Branch: ${branch.name}.` : null,
    "Please reply to confirm or let us know if you need to reschedule.",
  ]
    .filter(Boolean)
    .join(" ");
}
