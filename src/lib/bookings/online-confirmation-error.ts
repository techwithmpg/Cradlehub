type ConfirmationDatabaseError = { message: string; details?: string | null } | null;

/** Only translate known database contract errors; never show raw SQL details. */
export function onlineConfirmationErrorMessage(error: ConfirmationDatabaseError): string {
  switch (error?.message) {
    case "BOOKING_ROOM_CAPACITY_UNAVAILABLE": {
      const counts = /^available=(\d+);required=(\d+)$/.exec(error.details ?? "");
      return counts
        ? `Only ${counts[1]} treatment spaces remain available at the requested time. Your group requires ${counts[2]}. Please choose another time.`
        : "There are not enough treatment spaces for this group at the requested time. Please choose another time.";
    }
    case "BOOKING_STAFF_TIME_CONFLICT":
      return "An assigned therapist is already booked at the requested time. Please choose another time.";
    case "BOOKING_STAFF_NOT_QUALIFIED":
      return "An assigned therapist is no longer qualified for a requested service. Please review the group assignment.";
    case "BOOKING_STAFF_SCHEDULE_UNAVAILABLE":
      return "An assigned therapist is no longer scheduled or is unavailable at the requested time. Please choose another time.";
    case "BOOKING_RESOURCE_TIME_CONFLICT":
    case "BOOKING_RESOURCE_INVALID_FOR_BRANCH":
      return "An assigned treatment space is no longer available at the requested time. Please choose another time.";
    case "BOOKING_PROVIDER_OR_SERVICE_UNAVAILABLE":
    case "BOOKING_SERVICE_NOT_AVAILABLE_AT_BRANCH":
      return "A requested service or therapist is no longer available at this branch. Please review the booking.";
    case "BOOKING_REQUEST_EXPIRED":
      return "This booking request has expired. Please ask the customer to choose another time.";
    case "BOOKING_ORDER_STATE_CHANGED":
      return "This group booking changed while it was being confirmed. Refresh it and review the current status.";
    default:
      return "This booking request could not be confirmed. Review its schedule and current status, then try again.";
  }
}
