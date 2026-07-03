import { isBookingClosedForCrm, isCrmPendingBookingStatus } from "@/lib/bookings/crm-booking-status";

export type SelectedBookingActionId =
  | "confirm"
  | "call"
  | "copy_message"
  | "no_answer"
  | "reschedule"
  | "mark_arrived"
  | "assign_room"
  | "change_room"
  | "keep_waiting"
  | "start_service"
  | "open_dispatch"
  | "track_dispatch"
  | "review_record";

export type SelectedBookingOverflowActionId =
  | "cancel"
  | "change_status"
  | "assign_staff"
  | "take_payment"
  | "view_audit_log";

export type SelectedBookingAction = {
  id: SelectedBookingActionId;
  label: string;
  tone: "primary" | "secondary";
};

export type SelectedBookingOverflowAction = {
  id: SelectedBookingOverflowActionId;
  label: string;
  danger?: boolean;
  disabled?: boolean;
};

export type SelectedBookingPanelState = {
  status: string;
  bookingProgressStatus?: string | null;
  type?: string | null;
  deliveryType?: string | null;
  resourceId?: string | null;
  hasStaff: boolean;
  hasDriver?: boolean;
  hasDispatchHref?: boolean;
};

export type SelectedBookingActionPlan = {
  mode: "normal" | "active_service" | "closed";
  primary: SelectedBookingAction | null;
  secondary: SelectedBookingAction[];
  overflow: SelectedBookingOverflowAction[];
};

export type SelectedBookingRecommendationState = {
  needsTherapist: boolean;
  needsDriver: boolean;
  shouldShow: boolean;
};

export const SELECTED_BOOKING_PRIMARY_DETAIL_KEYS = [
  "customer",
  "service",
  "date",
  "time",
  "therapist",
  "staff",
  "room",
  "duration",
] as const;

export function isSelectedBookingHomeService(input: {
  type?: string | null;
  deliveryType?: string | null;
  metadataType?: unknown;
  metadataDeliveryType?: unknown;
}): boolean {
  return (
    input.deliveryType === "home_service" ||
    input.type === "home_service" ||
    input.metadataDeliveryType === "home_service" ||
    input.metadataType === "home_service"
  );
}

export function isSelectedBookingClosed(input: {
  status: string;
  bookingProgressStatus?: string | null;
}): boolean {
  return (
    isBookingClosedForCrm(input.status) ||
    input.status === "completed" ||
    input.status === "cancelled" ||
    input.status === "no_show" ||
    input.bookingProgressStatus === "completed" ||
    input.bookingProgressStatus === "no_show"
  );
}

export function isSelectedBookingActiveService(input: {
  status: string;
  bookingProgressStatus?: string | null;
  sessionStartedAt?: string | null;
}): boolean {
  return (
    (input.status === "in_progress" || input.bookingProgressStatus === "session_started") &&
    Boolean(input.sessionStartedAt)
  );
}

export function getSelectedBookingRecommendationState(
  input: SelectedBookingPanelState
): SelectedBookingRecommendationState {
  const isHomeService = isSelectedBookingHomeService(input);
  const isClosed = isSelectedBookingClosed(input);
  const needsTherapist = !isClosed && !input.hasStaff;
  const needsDriver = !isClosed && isHomeService && input.hasDriver !== true;

  return {
    needsTherapist,
    needsDriver,
    shouldShow: needsTherapist || needsDriver,
  };
}

export function shouldShowSelectedBookingFullDetail(key: string): boolean {
  return !SELECTED_BOOKING_PRIMARY_DETAIL_KEYS.includes(
    key as (typeof SELECTED_BOOKING_PRIMARY_DETAIL_KEYS)[number]
  );
}

export function getSelectedBookingActionPlan(
  input: SelectedBookingPanelState
): SelectedBookingActionPlan {
  const progress = input.bookingProgressStatus ?? null;
  const isHomeService = isSelectedBookingHomeService(input);
  const isClosed = isSelectedBookingClosed(input);
  const isPendingConfirmation = isCrmPendingBookingStatus(input.status);
  const resourceAssigned = Boolean(input.resourceId);

  const overflow: SelectedBookingOverflowAction[] = [
    { id: "cancel", label: "Cancel Booking", danger: true, disabled: isClosed },
    { id: "change_status", label: "Change Status" },
    { id: "assign_staff", label: "Assign / Reassign Staff" },
    { id: "take_payment", label: "Take Payment" },
    { id: "view_audit_log", label: "View Audit Log", disabled: true },
  ];

  if (isClosed) {
    return {
      mode: "closed",
      primary: { id: "review_record", label: "Review Record", tone: "primary" },
      secondary: [],
      overflow,
    };
  }

  if (input.status === "in_progress" || progress === "session_started") {
    return {
      mode: "active_service",
      primary: null,
      secondary: [],
      overflow,
    };
  }

  if (isPendingConfirmation) {
    return {
      mode: "normal",
      primary: { id: "confirm", label: "Mark Booking Confirmed", tone: "primary" },
      secondary: [
        { id: "call", label: "Call Customer", tone: "secondary" },
        { id: "copy_message", label: "Copy Message", tone: "secondary" },
        { id: "no_answer", label: "No Answer", tone: "secondary" },
        { id: "reschedule", label: "Reschedule", tone: "secondary" },
      ],
      overflow,
    };
  }

  if (isHomeService) {
    if (input.status === "confirmed" && (!progress || progress === "not_started")) {
      return {
        mode: "normal",
        primary: { id: "open_dispatch", label: "Open Dispatch", tone: "primary" },
        secondary: [
          { id: "call", label: "Call Customer", tone: "secondary" },
          { id: "copy_message", label: "Copy Message", tone: "secondary" },
          { id: "reschedule", label: "Reschedule", tone: "secondary" },
        ],
        overflow,
      };
    }

    if (progress === "travel_started" || progress === "arrived") {
      return {
        mode: "normal",
        primary: { id: "track_dispatch", label: "Track Dispatch", tone: "primary" },
        secondary: [
          { id: "call", label: "Call Customer", tone: "secondary" },
          { id: "copy_message", label: "Copy Message", tone: "secondary" },
        ],
        overflow,
      };
    }
  }

  if (input.status === "confirmed" && (!progress || progress === "not_started")) {
    return {
      mode: "normal",
      primary: { id: "mark_arrived", label: "Customer Arrived", tone: "primary" },
      secondary: [
        { id: "call", label: "Call Customer", tone: "secondary" },
        { id: "copy_message", label: "Copy Message", tone: "secondary" },
        { id: "reschedule", label: "Reschedule", tone: "secondary" },
      ],
      overflow,
    };
  }

  if (progress === "checked_in") {
    return {
      mode: "normal",
      primary: {
        id: resourceAssigned ? "start_service" : "assign_room",
        label: resourceAssigned ? "Start Service" : "Assign Room",
        tone: "primary",
      },
      secondary: resourceAssigned
        ? [
            { id: "change_room", label: "Change Room", tone: "secondary" },
            { id: "copy_message", label: "Copy Message", tone: "secondary" },
          ]
        : [
            { id: "keep_waiting", label: "Keep Waiting", tone: "secondary" },
            { id: "copy_message", label: "Copy Message", tone: "secondary" },
          ],
      overflow,
    };
  }

  return {
    mode: "normal",
    primary: { id: "call", label: "Follow Up", tone: "primary" },
    secondary: [
      { id: "copy_message", label: "Copy Message", tone: "secondary" },
      { id: "reschedule", label: "Reschedule", tone: "secondary" },
    ],
    overflow,
  };
}
