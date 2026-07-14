import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { BookingFollowupModal, type BookingFollowupResult } from "./booking-followup-modal";
import { CustomerArrivedModal } from "./customer-arrived-modal";
import { RescheduleBookingModal } from "./reschedule-booking-modal";
import { RoomAssignmentModal } from "./room-assignment-modal";

export type BookingModalState =
  | { type: "followup"; booking: WorkspaceBookingRow; initialResult: BookingFollowupResult }
  | { type: "arrival"; booking: WorkspaceBookingRow }
  | { type: "room"; booking: WorkspaceBookingRow }
  | { type: "reschedule"; booking: WorkspaceBookingRow }
  | null;

export function BookingsModalStack({
  state,
  onStateChange,
  onChanged,
  onArrived,
}: {
  state: BookingModalState;
  onStateChange: (state: BookingModalState) => void;
  onChanged?: () => void;
  onArrived: () => void;
}) {
  return (
    <>
      <BookingFollowupModal
        key={state?.type === "followup" ? `${state.booking.id}-${state.initialResult}` : "followup-closed"}
        open={state?.type === "followup"}
        booking={state?.type === "followup" ? state.booking : null}
        initialResult={state?.type === "followup" ? state.initialResult : "confirmed"}
        onOpenChange={(open) => { if (!open) onStateChange(null); }}
        onSuccess={() => onChanged?.()}
        onRescheduleRequested={(booking) => onStateChange({ type: "reschedule", booking })}
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
