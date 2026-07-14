import { AlertTriangle } from "lucide-react";
import { BookingStatusPill } from "./booking-status-pill";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import {
  firstBookingRelation,
  getBookingCustomerInitials,
  getBookingDurationMinutes,
} from "@/lib/bookings/booking-display";
import { isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";
import { getOpenStaffScheduleException } from "@/lib/bookings/staff-schedule-exception";
import { isHomeServiceBooking } from "@/lib/bookings/bookings-workspace-filters";
import { getRequiredResourceType } from "@/lib/schedule/live-schedule-conflicts";
import { cn, formatTime } from "@/lib/utils";

export function getBookingListIssueLabel(booking: WorkspaceBookingRow): string | null {
  if (isBookingClosedForCrm(booking.status)) return null;

  const issues: string[] = [];
  const customer = firstBookingRelation(booking.customers);
  const service = firstBookingRelation(booking.services);
  const requiredResourceType = getRequiredResourceType({
    id: booking.id,
    start_time: booking.start_time,
    end_time: booking.end_time ?? booking.start_time,
    service_id: service?.id ?? null,
    service: service?.name ?? "Service",
    service_metadata: service?.metadata ?? null,
    customer: customer?.full_name ?? "Customer",
    status: booking.status,
    type: booking.type,
    delivery_type: booking.delivery_type,
    resource_id: booking.resource_id ?? null,
    resource_name: firstBookingRelation(booking.branch_resources)?.name ?? null,
  });
  if (["unpaid", "pending", "pending_payment"].includes(booking.payment_status)) {
    issues.push("payment review");
  }
  if (
    !isHomeServiceBooking(booking) &&
    requiredResourceType &&
    !booking.resource_id &&
    (booking.status === "confirmed" || booking.booking_progress_status === "checked_in")
  ) {
    issues.push("room assignment");
  }
  if (getOpenStaffScheduleException(booking.metadata)) {
    issues.push("staff schedule exception");
  }
  if (!firstBookingRelation(booking.staff) && booking.status === "confirmed") {
    issues.push("staff assignment");
  }

  const followup = booking.metadata?.crm_followup;
  const followupResult =
    followup && typeof followup === "object" && !Array.isArray(followup)
      ? (followup as { result?: unknown }).result
      : null;
  if (["no_answer", "reschedule", "confirm_later"].includes(String(followupResult))) {
    issues.push("follow-up required");
  }

  return issues.length > 0 ? `Needs ${issues.join(", ")}` : null;
}

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
  const duration = getBookingDurationMinutes(booking);
  const issueLabel = getBookingListIssueLabel(booking);

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
        "focus-visible:bg-amber-50/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-800"
      )}
    >
      <td className={cn("border-b border-[var(--cs-border-soft)] py-4 pr-2 pl-4 align-middle", selected ? "border-l-4 border-l-emerald-800" : "border-l-4 border-l-transparent")}>
        <div className="whitespace-nowrap text-sm font-bold text-[var(--cs-text)]">{formatTime(booking.start_time)}</div>
        <div className="mt-1 whitespace-nowrap text-xs text-[var(--cs-text-muted)]">{duration > 0 ? `${duration} min` : "Duration TBD"}</div>
      </td>
      <td className="min-w-0 border-b border-[var(--cs-border-soft)] px-2 py-4 align-middle">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cs-sand-mist)] text-xs font-bold text-[var(--cs-sand-dark)]">
            {getBookingCustomerInitials(customer?.full_name)}
          </span>
          <div className="min-w-0">
            <div className={cn("truncate text-sm text-[var(--cs-text)]", selected ? "font-bold" : "font-semibold")} title={customer?.full_name ?? undefined}>
              {customer?.full_name ?? "Customer"}
            </div>
            <div className="mt-1 truncate text-xs text-[var(--cs-text-muted)]" title={customer?.phone ?? undefined}>
              {customer?.phone ?? `#${booking.id.slice(0, 8).toUpperCase()}`}
            </div>
          </div>
        </div>
      </td>
      <td className="border-b border-[var(--cs-border-soft)] px-2 py-4 align-middle">
        <div className="flex min-w-0 items-center gap-1.5">
          <BookingStatusPill booking={booking} />
          {issueLabel ? (
            <span className="shrink-0" title={issueLabel}>
              <AlertTriangle className="size-4 text-amber-700" aria-label={issueLabel} />
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
