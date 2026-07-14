"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { SelectedBookingOverviewRow, overviewActionClass } from "./selected-booking-overview-row";
import { assignBookingTherapistAction } from "@/app/(dashboard)/crm/bookings/actions";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import { getAssignmentRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import { firstBookingRelation, getBookingRoomLabel, getBookingStaffName } from "@/lib/bookings/booking-display";
import { isHomeServiceBooking } from "@/lib/bookings/bookings-workspace-filters";

export function SelectedBookingStaffRow({
  booking,
  canEdit,
  expanded,
  onExpandedChange,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  canEdit: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = expanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;
  const staff = firstBookingRelation(booking.staff);

  return (
    <SelectedBookingOverviewRow
      icon={<UserRound className="size-4" />}
      label="Staff assignment"
      summary={`${getBookingStaffName(booking)} · ${getBookingRoomLabel(booking)}`}
      action={canEdit ? <button type="button" onClick={() => setExpanded(!isExpanded)} className={overviewActionClass}>{isExpanded ? "Close" : "Change"}</button> : undefined}
    >
      {canEdit && isExpanded ? (
        <AssignmentRecommendationPanel
          key={booking.id}
          bookingId={booking.id}
          fetchRecommendations={getAssignmentRecommendationsAction}
          onAssignTherapist={async (therapistId, overrideReason) => {
            const result = await assignBookingTherapistAction({ bookingId: booking.id, staffId: therapistId, overrideReason });
            if (!result.success) {
              toast.error(result.error ?? "Could not assign therapist.");
              return;
            }
            toast.success("Therapist assigned.");
            onChanged?.();
            router.refresh();
          }}
          onAssignDriver={async (driverId) => {
            await assignBookingDriverAction({ bookingId: booking.id, driverId });
            onChanged?.();
            router.refresh();
          }}
          currentTherapistId={staff?.id ?? null}
          currentDriverId={null}
          showTherapists
          showDrivers={isHomeServiceBooking(booking)}
        />
      ) : null}
    </SelectedBookingOverviewRow>
  );
}
