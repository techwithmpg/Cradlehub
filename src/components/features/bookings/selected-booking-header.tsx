import { X } from "lucide-react";
import { BookingStatusPill } from "./booking-status-pill";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import {
  firstBookingRelation,
  formatBookingDisplayDate,
  getBookingCustomerInitials,
  getBookingDeliveryLabel,
  getBookingSourceLabel,
  getBookingTimeRange,
} from "@/lib/bookings/booking-display";

export function SelectedBookingHeader({
  booking,
  onClose,
}: {
  booking: WorkspaceBookingRow;
  onClose: () => void;
}) {
  const customer = firstBookingRelation(booking.customers);
  const service = firstBookingRelation(booking.services);

  return (
    <header className="px-5 pt-5 pb-4">
      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--cs-sand-mist)] text-lg font-bold text-[var(--cs-sand-dark)]">
          {getBookingCustomerInitials(customer?.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <h2 className="truncate text-xl font-bold tracking-[-0.02em] text-[var(--cs-text)]" title={customer?.full_name ?? undefined}>
              {customer?.full_name ?? "Customer"}
            </h2>
            <BookingStatusPill booking={booking} />
          </div>
          <p className="mt-1 truncate text-sm text-[var(--cs-text-secondary)]">
            {service?.name ?? "Service"} · {formatBookingDisplayDate(booking.booking_date)} · {getBookingTimeRange(booking)}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close selected booking" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]">
          <X className="size-5" />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--cs-text-secondary)]">
        <span className="font-medium">#{booking.id.slice(0, 8).toUpperCase()}</span>
        <span aria-hidden="true">·</span>
        <span>{getBookingSourceLabel(booking)}</span>
        <span aria-hidden="true">·</span>
        <span>{getBookingDeliveryLabel(booking)}</span>
      </div>
    </header>
  );
}
