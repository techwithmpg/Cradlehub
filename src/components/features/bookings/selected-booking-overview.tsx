import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import type { BookingFollowupResult } from "./booking-followup-modal";
import { SelectedBookingWarnings } from "./selected-booking-warnings";
import { SelectedBookingStaffRow } from "./selected-booking-staff-row";
import { SelectedBookingPaymentRow } from "./selected-booking-payment-row";
import { SelectedBookingNoteRow } from "./selected-booking-note-row";
import { SelectedBookingCustomerRow } from "./selected-booking-customer-row";
import { canUpdateBooking } from "@/lib/permissions";
import { isBookingOperationallyClosed } from "@/lib/bookings/bookings-workspace-filters";

export function SelectedBookingOverview({
  booking,
  viewerRole,
  paymentAction,
  confirmPaymentAction,
  staffExpanded,
  paymentExpanded,
  onStaffExpandedChange,
  onPaymentExpandedChange,
  onOpenRoom,
  onOpenReschedule,
  onOpenFollowup,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  viewerRole: string;
  paymentAction?: BookingActionFn;
  confirmPaymentAction?: BookingActionFn;
  staffExpanded: boolean;
  paymentExpanded: boolean;
  onStaffExpandedChange: (expanded: boolean) => void;
  onPaymentExpandedChange: (expanded: boolean) => void;
  onOpenRoom: () => void;
  onOpenReschedule: () => void;
  onOpenFollowup: (result: BookingFollowupResult) => void;
  onChanged?: () => void;
}) {
  const canEditBooking = canUpdateBooking(viewerRole) && !isBookingOperationallyClosed(booking);
  return (
    <div className="grid gap-3">
      <SelectedBookingWarnings booking={booking} onOpenRoom={onOpenRoom} onOpenPayment={() => onPaymentExpandedChange(true)} onOpenStaff={() => onStaffExpandedChange(true)} onOpenReschedule={onOpenReschedule} onOpenFollowup={onOpenFollowup} onChanged={onChanged} />
      <div className="overflow-visible rounded-xl border border-[var(--cs-border-soft)] bg-white">
        <SelectedBookingStaffRow booking={booking} canEdit={canEditBooking} expanded={staffExpanded} onExpandedChange={onStaffExpandedChange} onChanged={onChanged} />
        <SelectedBookingPaymentRow booking={booking} paymentAction={paymentAction} confirmPaymentAction={confirmPaymentAction} expanded={paymentExpanded} onExpandedChange={onPaymentExpandedChange} onChanged={onChanged} />
        <SelectedBookingNoteRow booking={booking} canEdit={canEditBooking} onChanged={onChanged} />
        <SelectedBookingCustomerRow booking={booking} />
      </div>
    </div>
  );
}
