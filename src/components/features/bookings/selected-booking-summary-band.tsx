import { BedDouble, Clock3, CreditCard, UserRound } from "lucide-react";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import {
  getBookingDurationMinutes,
  getBookingRoomLabel,
  getBookingStaffName,
  readBookingPrice,
} from "@/lib/bookings/booking-display";
import {
  isBookingOperationallyClosed,
  isHomeServiceBooking,
} from "@/lib/bookings/bookings-workspace-filters";
import { canUpdateBooking } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import type { CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import { TherapistProvenanceBadge } from "./therapist-provenance-badge";

function SummaryCell({
  icon,
  label,
  value,
  badge,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center px-3 py-4 text-center [&:not(:last-child)]:border-r [&:not(:last-child)]:border-[var(--cs-border-soft)]">
      <span className="text-[var(--cs-sand-dark)]">{icon}</span>
      <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--cs-text-muted)]">
        {label}
      </span>
      <span
        className="mt-1 max-w-full truncate text-sm font-semibold text-[var(--cs-text)]"
        title={value}
      >
        {value}
        {badge}
      </span>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
const actionClass =
  "inline-flex h-8 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-white px-3 text-xs font-semibold text-[var(--cs-text)] hover:bg-[var(--cs-surface-warm)]";

export function SelectedBookingSummaryBand({
  booking,
  group,
  viewerRole,
  onChangeStaff,
  onChangeRoom,
}: {
  booking: WorkspaceBookingRow;
  group?: CrmBookingGroup;
  viewerRole: string;
  onChangeStaff: () => void;
  onChangeRoom: () => void;
}) {
  const price = readBookingPrice(booking.metadata);
  const balance = Math.max(0, price - Number(booking.amount_paid ?? 0));
  const canEdit = canUpdateBooking(viewerRole) && !isBookingOperationallyClosed(booking);
  const canEditRoom = canEdit && !isHomeServiceBooking(booking);
  const duration = getBookingDurationMinutes(booking);

  return (
    <section className="mx-5 grid grid-cols-4 overflow-visible rounded-xl border border-[var(--cs-border-soft)] bg-white">
      <SummaryCell
        icon={<UserRound className="size-5" />}
        label="Staff"
        value={getBookingStaffName(booking)}
        badge={<TherapistProvenanceBadge booking={booking} />}
      >
        {canEdit ? (
          <button type="button" onClick={onChangeStaff} className={actionClass}>
            Change
          </button>
        ) : null}
      </SummaryCell>
      <SummaryCell
        icon={<BedDouble className="size-5" />}
        label="Room"
        value={getBookingRoomLabel(booking)}
      >
        {canEditRoom ? (
          <button type="button" onClick={onChangeRoom} className={actionClass}>
            {booking.resource_id ? "Change" : "Assign"}
          </button>
        ) : null}
      </SummaryCell>
      <SummaryCell
        icon={<Clock3 className="size-5" />}
        label="Duration"
        value={duration > 0 ? `${duration} min` : "TBD"}
      />
      <SummaryCell
        icon={<CreditCard className="size-5" />}
        label={group ? "Order payment" : "Payment"}
        value={
          group
            ? group.payment.due === null
              ? "Unavailable"
              : `${formatCurrency(group.payment.due)} due`
            : `${formatCurrency(balance)} due`
        }
      >
        <span className="text-xs text-[var(--cs-text-secondary)]">
          {group
            ? group.payment.paid === null
              ? "Unavailable"
              : formatCurrency(group.payment.paid)
            : formatCurrency(booking.amount_paid ?? 0)}{" "}
          paid
        </span>
      </SummaryCell>
    </section>
  );
}
