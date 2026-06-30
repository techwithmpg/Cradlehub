import { isBookingClosedForCrm, isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";

export type WorkQueueActionCategory = "confirmation" | "follow_up" | "exception" | "ready" | "closed";
export type WorkQueuePrimaryKind = "booking" | "driver" | "payment" | "status";

export type WorkQueueActionInput = {
  status: string;
  type: string;
  paymentStatus?: string | null;
  staffName?: string | null;
  resourceName?: string | null;
  dispatchWarning?: string | null;
  needsLocationReview?: boolean;
  noDriverWarning?: boolean;
};

export type WorkQueueNextAction = {
  category: WorkQueueActionCategory;
  instruction: string;
  detail: string;
  primaryKind: WorkQueuePrimaryKind;
  primaryLabel: string;
  priority: number;
};

function isHomeService(type: string): boolean {
  return type === "home_service";
}

function needsPaymentFollowUp(paymentStatus?: string | null): boolean {
  const normalized = paymentStatus ?? "unpaid";
  return normalized === "unpaid" || normalized === "pending" || normalized === "pending_payment";
}

export function getWorkQueueNextAction(input: WorkQueueActionInput): WorkQueueNextAction {
  if (input.needsLocationReview || input.dispatchWarning) {
    return {
      category: "exception",
      instruction: "Review the home-service address before dispatch.",
      detail: input.dispatchWarning ?? "Location needs review before the team leaves.",
      primaryKind: "booking",
      primaryLabel: "Review booking",
      priority: 100,
    };
  }

  if (isHomeService(input.type) && input.noDriverWarning) {
    return {
      category: "exception",
      instruction: "Assign a driver before dispatch.",
      detail: "Home-service bookings need a driver before the trip can be tracked.",
      primaryKind: "driver",
      primaryLabel: "Assign driver",
      priority: 95,
    };
  }

  if (!input.staffName && !isBookingClosedForCrm(input.status)) {
    return {
      category: "exception",
      instruction: "Assign a service provider before the appointment.",
      detail: isHomeService(input.type)
        ? "No assigned staff member is shown for this home-service booking."
        : "No assigned staff member is shown for this booking.",
      primaryKind: "booking",
      primaryLabel: "Assign staff",
      priority: 90,
    };
  }

  if (!input.resourceName && !isHomeService(input.type) && input.status === "confirmed") {
    return {
      category: "exception",
      instruction: "Choose a room or chair before the client arrives.",
      detail: "The booking is confirmed but no branch resource is assigned.",
      primaryKind: "booking",
      primaryLabel: "Assign resource",
      priority: 82,
    };
  }

  if (input.status === "pending") {
    return {
      category: "confirmation",
      instruction: "Confirm the booking details with the client.",
      detail: "Check the schedule, staff, and payment before moving it into today's flow.",
      primaryKind: "status",
      primaryLabel: "Confirm",
      priority: 75,
    };
  }

  if (isCrmPendingBookingStatus(input.status)) {
    return {
      category: "confirmation",
      instruction: "Review confirmation details before the visit.",
      detail: "CRM confirmation is still pending for this booking.",
      primaryKind: "booking",
      primaryLabel: "Review booking",
      priority: 72,
    };
  }

  if (needsPaymentFollowUp(input.paymentStatus) && !isBookingClosedForCrm(input.status)) {
    return {
      category: "follow_up",
      instruction: "Collect or confirm payment.",
      detail: "Payment is not marked paid yet.",
      primaryKind: "payment",
      primaryLabel: "Collect payment",
      priority: 68,
    };
  }

  if (input.status === "confirmed") {
    return {
      category: "ready",
      instruction: "Prepare for arrival and start service when ready.",
      detail: isHomeService(input.type)
        ? "Driver, location, and service progress can be managed here."
        : "Client is confirmed for today's schedule.",
      primaryKind: "status",
      primaryLabel: "Start service",
      priority: 50,
    };
  }

  if (input.status === "in_progress") {
    return {
      category: "follow_up",
      instruction: "Complete the booking when service is finished.",
      detail: "The appointment is currently in service.",
      primaryKind: "status",
      primaryLabel: "Complete",
      priority: 45,
    };
  }

  if (isBookingClosedForCrm(input.status)) {
    return {
      category: "closed",
      instruction: "No front-desk action needed.",
      detail: "This booking is already closed for CRM work.",
      primaryKind: "booking",
      primaryLabel: "Open booking",
      priority: 5,
    };
  }

  return {
    category: "ready",
    instruction: "Review the booking details.",
    detail: "No urgent issue is flagged, but this booking is still part of today's queue.",
    primaryKind: "booking",
    primaryLabel: "Open booking",
    priority: 20,
  };
}
