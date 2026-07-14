import { AlertTriangle, Home, MapPin } from "lucide-react";
import { BookingStatusPill } from "./booking-status-pill";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import {
  firstBookingRelation,
  getBookingCustomerInitials,
  getBookingDeliveryLabel,
  getBookingDurationMinutes,
  getBookingRoomLabel,
  getBookingSourceLabel,
  getBookingStaffName,
} from "@/lib/bookings/booking-display";
import { getOpenStaffScheduleException } from "@/lib/bookings/staff-schedule-exception";
import { isHomeServiceBooking } from "@/lib/bookings/bookings-workspace-filters";
import { cn, formatTime } from "@/lib/utils";

export function BookingListRow({
  booking,
  selected,
  onSelect,
}: {
  booking: WorkspaceBookingRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const customer = firstBookingRelation(booking.customers);
  const service = firstBookingRelation(booking.services);
  const duration = getBookingDurationMinutes(booking);
  const hasStaffWarning = Boolean(getOpenStaffScheduleException(booking.metadata));
  const SourceIcon = isHomeServiceBooking(booking) ? Home : MapPin;

  return (
    <tr
      tabIndex={0}
      aria-selected={selected}
      aria-label={`Select booking for ${customer?.full_name ?? "customer"} at ${formatTime(booking.start_time)}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className={cn(
        "group cursor-pointer outline-none transition-colors",
        selected ? "bg-amber-50/80" : "bg-white hover:bg-[var(--cs-surface-warm)]",
        "focus-visible:bg-amber-50/80"
      )}
    >
      <td className={cn("border-b border-[var(--cs-border-soft)] py-4 pr-3 pl-4 align-middle", selected ? "border-l-4 border-l-emerald-800" : "border-l-4 border-l-transparent")}>
        <div className="text-sm font-bold text-[var(--cs-text)]">{formatTime(booking.start_time)}</div>
        <div className="mt-1 text-xs text-[var(--cs-text-muted)]">{duration > 0 ? `${duration} min` : "Duration TBD"}</div>
      </td>
      <td className="border-b border-[var(--cs-border-soft)] px-3 py-4 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--cs-sand-mist)] text-xs font-bold text-[var(--cs-sand-dark)]">
            {getBookingCustomerInitials(customer?.full_name)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--cs-text)]" title={customer?.full_name ?? undefined}>
              {customer?.full_name ?? "Customer"}
            </div>
            <div className="mt-1 truncate text-xs text-[var(--cs-text-muted)]">
              {customer?.phone ?? `#${booking.id.slice(0, 8).toUpperCase()}`}
            </div>
          </div>
        </div>
      </td>
      <td className="border-b border-[var(--cs-border-soft)] px-3 py-4 align-middle">
        <div className="truncate text-sm font-medium text-[var(--cs-text)]" title={service?.name ?? undefined}>
          {service?.name ?? "Service"}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--cs-border)] bg-white px-2 py-1 text-[11px] text-[var(--cs-text-secondary)]">
          <SourceIcon className="size-3" />
          {getBookingSourceLabel(booking)} · {getBookingDeliveryLabel(booking)}
        </div>
      </td>
      <td className="border-b border-[var(--cs-border-soft)] px-3 py-4 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[var(--cs-text)]">{getBookingStaffName(booking)}</div>
            <div className="mt-1 truncate text-xs text-[var(--cs-text-muted)]">{getBookingRoomLabel(booking)}</div>
          </div>
          {hasStaffWarning ? (
            <AlertTriangle className="size-4 shrink-0 text-amber-700" aria-label="Staff schedule review required" />
          ) : null}
        </div>
      </td>
      <td className="border-b border-[var(--cs-border-soft)] px-3 py-4 align-middle">
        <BookingStatusPill booking={booking} />
      </td>
    </tr>
  );
}
