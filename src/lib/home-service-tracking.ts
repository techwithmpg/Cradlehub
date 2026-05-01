/**
 * Home service tracking state machine.
 *
 * Pure helpers for validating transitions and deriving UI state.
 * No side effects — safe to use in components and tests.
 */

export const HOME_SERVICE_TRACKING_STATUSES = [
  "not_started",
  "travel_started",
  "arrived",
  "session_started",
  "completed",
] as const;

export type HomeServiceTrackingStatus =
  (typeof HOME_SERVICE_TRACKING_STATUSES)[number];

export const HOME_SERVICE_TRACKING_LABELS: Record<
  HomeServiceTrackingStatus,
  string
> = {
  not_started: "Not started",
  travel_started: "Travel started",
  arrived: "Arrived",
  session_started: "Session in progress",
  completed: "Completed",
};

const VALID_TRANSITIONS: Record<
  HomeServiceTrackingStatus,
  HomeServiceTrackingStatus[]
> = {
  not_started: ["travel_started"],
  travel_started: ["arrived"],
  arrived: ["session_started"],
  session_started: ["completed"],
  completed: [],
};

/**
 * Returns the next valid tracking status, or null if already completed.
 */
export function getNextHomeServiceTrackingStatus(
  current: HomeServiceTrackingStatus
): HomeServiceTrackingStatus | null {
  const next = VALID_TRANSITIONS[current];
  return next[0] ?? null;
}

/**
 * Checks whether a transition from `current` to `next` is allowed.
 */
export function canTransitionHomeServiceTracking(
  current: HomeServiceTrackingStatus,
  next: HomeServiceTrackingStatus
): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * Human-readable label for a tracking status.
 */
export function getHomeServiceTrackingLabel(
  status: HomeServiceTrackingStatus
): string {
  return HOME_SERVICE_TRACKING_LABELS[status] ?? status;
}

/**
 * Checks if tracking is already finished.
 */
export function isHomeServiceTrackingComplete(
  status: HomeServiceTrackingStatus
): boolean {
  return status === "completed";
}

/**
 * Maps tracking status to the timestamp column that records when it began.
 */
export function getTimestampFieldForTrackingStatus(
  status: HomeServiceTrackingStatus
): string | null {
  switch (status) {
    case "travel_started":
      return "travel_started_at";
    case "arrived":
      return "arrived_at";
    case "session_started":
      return "session_started_at";
    case "completed":
      return "completed_at";
    default:
      return null;
  }
}
