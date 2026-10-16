export type TherapistSelectionSource =
  | "customer_selected"
  | "system_assigned"
  | "front_desk_selected"
  | "legacy_unknown";

export type TherapistProvenance = {
  requested_staff_id: string | null;
  therapist_selection_source: TherapistSelectionSource;
};

export function bookingCreationProvenance({
  selectedStaffId,
  assignedStaffId,
  selectedBy,
}: {
  selectedStaffId?: string | null;
  assignedStaffId: string;
  selectedBy: "customer" | "front_desk";
}): TherapistProvenance {
  if (!selectedStaffId || selectedStaffId !== assignedStaffId) {
    return {
      requested_staff_id: selectedBy === "customer" ? (selectedStaffId ?? null) : null,
      therapist_selection_source: "system_assigned",
    };
  }
  return selectedBy === "customer"
    ? { requested_staff_id: selectedStaffId, therapist_selection_source: "customer_selected" }
    : { requested_staff_id: null, therapist_selection_source: "front_desk_selected" };
}

export function therapistProvenanceBadge(booking: {
  staff_id?: string | null;
  requested_staff_id?: string | null;
  therapist_selection_source?: string | null;
}): "customer_choice" | "auto_assigned" | null {
  if (
    booking.therapist_selection_source === "customer_selected" &&
    booking.staff_id &&
    booking.staff_id === booking.requested_staff_id
  ) return "customer_choice";
  if (booking.therapist_selection_source === "system_assigned") return "auto_assigned";
  return null;
}
