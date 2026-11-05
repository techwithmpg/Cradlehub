import type { BookingActionFn, WorkspaceBookingRow } from "./booking-workspace-types";
import type { CrmBookingGroup } from "@/lib/bookings/crm-booking-groups";
import { BookingDetailsModal } from "./booking-details-modal";
import { CustomerArrivedModal } from "./customer-arrived-modal";
import { RescheduleBookingModal } from "./reschedule-booking-modal";
import { RoomAssignmentModal } from "./room-assignment-modal";

export type BookingModalState =
  | { type: "arrival"; booking: WorkspaceBookingRow }
  | { type: "room"; booking: WorkspaceBookingRow }
  | { type: "reschedule"; booking: WorkspaceBookingRow }
  | { type: "details"; group: CrmBookingGroup; selectedLineId?: string }
  | null;

export function BookingsModalStack({
  state,
  onStateChange,
  onChanged,
  onArrived,
  paymentAction,
}: {
  state: BookingModalState;
  onStateChange: (state: BookingModalState) => void;
  onChanged?: () => void;
  onArrived: () => void;
  paymentAction?: BookingActionFn;
}) {
  return (
    <>
      <BookingDetailsModal
        key={state?.type === "details" ? state.group.primaryBookingId : "details-closed"}
        open={state?.type === "details"}
        group={state?.type === "details" ? state.group : null}
        initialSelectedLineId={state?.type === "details" ? state.selectedLineId : undefined}
        onOpenChange={(open) => { if (!open) onStateChange(null); }}
        onChanged={onChanged}
        onReschedule={(booking) => onStateChange({ type: "reschedule", booking })}
        onArrive={(booking) => onStateChange({ type: "arrival", booking })}
        paymentAction={paymentAction}
      />
      <CustomerArrivedModal
        key={state?.type === "arrival" ? state.booking.id : "arrival-closed"}
        open={state?.type === "arrival"}
        booking={state?.type === "arrival" ? state.booking : null}
        onOpenChange={(open) => { if (!open) onStateChange(null); }}
        onMarkedArrived={onArrived}
      />
      <RoomAssignmentModal
        key={state?.type === "room" ? state.booking.id : "room-closed"}
        open={state?.type === "room"}
        booking={state?.type === "room" ? state.booking : null}
        onOpenChange={(open) => { if (!open) onStateChange(null); }}
        onAssigned={() => onChanged?.()}
      />
      <RescheduleBookingModal
        key={state?.type === "reschedule" ? state.booking.id : "reschedule-closed"}
        open={state?.type === "reschedule"}
        booking={state?.type === "reschedule" ? state.booking : null}
        onOpenChange={(open) => { if (!open) onStateChange(null); }}
        onRescheduled={() => onChanged?.()}
      />
    </>
  );
}
