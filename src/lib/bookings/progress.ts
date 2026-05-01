/**
 * Unified booking progress state machine.
 *
 * Supports home_service, walkin (in-spa), and online booking types.
 * Pure helpers — no side effects. Safe in components and tests.
 */

export const BOOKING_PROGRESS_STATUSES = [
  "not_started",
  "checked_in",
  "travel_started",
  "arrived",
  "session_started",
  "completed",
  "no_show",
] as const;

export type BookingProgressStatus =
  (typeof BOOKING_PROGRESS_STATUSES)[number];

export type BookingTypeForProgress = "home_service" | "walkin" | "online";

export const BOOKING_PROGRESS_LABELS: Record<BookingProgressStatus, string> = {
  not_started: "Not started",
  checked_in: "Checked in",
  travel_started: "Travel started",
  arrived: "Arrived",
  session_started: "Session in progress",
  completed: "Completed",
  no_show: "No show",
};

// ── Transition tables by booking type ───────────────────────────────────────

const HOME_SERVICE_TRANSITIONS: Record<
  BookingProgressStatus,
  BookingProgressStatus[]
> = {
  not_started: ["travel_started"],
  travel_started: ["arrived"],
  arrived: ["session_started"],
  session_started: ["completed"],
  completed: [],
  checked_in: [],
  no_show: [],
};

const WALKIN_TRANSITIONS: Record<
  BookingProgressStatus,
  BookingProgressStatus[]
> = {
  not_started: ["checked_in", "no_show"],
  checked_in: ["session_started", "no_show"],
  session_started: ["completed"],
  completed: [],
  travel_started: [],
  arrived: [],
  no_show: [],
};

const ONLINE_TRANSITIONS: Record<
  BookingProgressStatus,
  BookingProgressStatus[]
> = {
  not_started: ["session_started"],
  session_started: ["completed"],
  completed: [],
  checked_in: [],
  travel_started: [],
  arrived: [],
  no_show: [],
};

function getTransitions(type: BookingTypeForProgress) {
  switch (type) {
    case "home_service":
      return HOME_SERVICE_TRANSITIONS;
    case "walkin":
      return WALKIN_TRANSITIONS;
    case "online":
      return ONLINE_TRANSITIONS;
    default:
      return {} as Record<BookingProgressStatus, BookingProgressStatus[]>;
  }
}

// ── Public helpers ──────────────────────────────────────────────────────────

/**
 * Returns the valid transition table for a given booking type.
 */
export function getBookingProgressFlow(
  bookingType: BookingTypeForProgress
): Record<BookingProgressStatus, BookingProgressStatus[]> {
  return getTransitions(bookingType);
}

/**
 * Checks whether a transition is valid for the given booking type.
 */
export function canTransitionBookingProgress({
  bookingType,
  currentStatus,
  nextStatus,
}: {
  bookingType: BookingTypeForProgress;
  currentStatus: BookingProgressStatus;
  nextStatus: BookingProgressStatus;
}): boolean {
  const transitions = getTransitions(bookingType);
  return transitions[currentStatus]?.includes(nextStatus) ?? false;
}

/**
 * Returns all next allowed actions for a booking type + current status.
 */
export function getNextAllowedProgressActions({
  bookingType,
  currentStatus,
}: {
  bookingType: BookingTypeForProgress;
  currentStatus: BookingProgressStatus;
}): BookingProgressStatus[] {
  const transitions = getTransitions(bookingType);
  return transitions[currentStatus] ?? [];
}

/**
 * Human-readable label for a progress status.
 */
export function getBookingProgressLabel(
  status: BookingProgressStatus
): string {
  return BOOKING_PROGRESS_LABELS[status] ?? status;
}

/**
 * Checks if progress is already finished (completed or no_show).
 */
export function isBookingProgressTerminal(
  status: BookingProgressStatus
): boolean {
  return status === "completed" || status === "no_show";
}

/**
 * Maps a progress status to the timestamp column that records when it began.
 */
export function getTimestampFieldForProgressStatus(
  status: BookingProgressStatus
): string | null {
  switch (status) {
    case "checked_in":
      return "checked_in_at";
    case "travel_started":
      return "travel_started_at";
    case "arrived":
      return "arrived_at";
    case "session_started":
      return "session_started_at";
    case "completed":
      return "session_completed_at";
    case "no_show":
      return "no_show_at";
    default:
      return null;
  }
}

/**
 * Returns the next logical progress status for a booking,
 * or null if already terminal.
 */
export function getNextBookingProgressStatus({
  bookingType,
  currentStatus,
}: {
  bookingType: BookingTypeForProgress;
  currentStatus: BookingProgressStatus;
}): BookingProgressStatus | null {
  const actions = getNextAllowedProgressActions({ bookingType, currentStatus });
  return actions[0] ?? null;
}
