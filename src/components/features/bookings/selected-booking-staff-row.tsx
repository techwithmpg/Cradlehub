"use client";

import { useState } from "react";
import { Truck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { SelectedBookingOverviewRow, overviewActionClass } from "./selected-booking-overview-row";
import { assignBookingTherapistAction } from "@/app/(dashboard)/crm/bookings/actions";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import { getAssignmentRecommendationsAction, getDriverRecommendationsAction } from "@/lib/actions/assignment-recommendations";
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
  const [localExpanded, setLocalExpanded] = useState(false);
  const [driverExpanded, setDriverExpanded] = useState(false);
  const isExpanded = expanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;
  const staff = firstBookingRelation(booking.staff);
  const homeService = isHomeServiceBooking(booking);
  const driver = firstBookingRelation(booking.driver);

  return (
    <>
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
          }}
          currentTherapistId={staff?.id ?? null}
          showTherapists
          showDrivers={false}
        />
      ) : null}
    </SelectedBookingOverviewRow>
    {homeService ? (
      <SelectedBookingOverviewRow
        icon={<Truck className="size-4" />}
        label="Driver"
        summary={driver?.full_name ?? (booking.driver_id ? "Assigned driver" : "Not assigned")}
        action={canEdit ? <button type="button" onClick={() => setDriverExpanded(!driverExpanded)} className={overviewActionClass}>{driverExpanded ? "Close" : booking.driver_id ? "Change" : "Assign Driver"}</button> : undefined}
      >
        {canEdit && driverExpanded ? (
          <AssignmentRecommendationPanel
            key={`${booking.id}-driver`}
            bookingId={booking.id}
            fetchRecommendations={getDriverRecommendationsAction}
            onAssignDriver={async (driverId) => {
              const result = await assignBookingDriverAction({ bookingId: booking.id, driverId });
              if (!result.success) {
                toast.error(result.error ?? "Could not assign driver.");
                return;
              }
              toast.success(booking.driver_id ? "Driver changed." : "Driver assigned.");
              onChanged?.();
            }}
            currentDriverId={booking.driver_id ?? null}
            showTherapists={false}
            showDrivers
          />
        ) : null}
      </SelectedBookingOverviewRow>
    ) : null}
    </>
  );
}
