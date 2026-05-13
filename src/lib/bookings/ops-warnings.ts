// Pure operational warning computation — no DB calls.
// Used by control console cards and live ops panel.

export type LiveEtaData = {
  eta_minutes: number;
  calculated_at: string;
  source: "routes_api";
  origin: "driver_location" | "therapist_location" | "branch" | "unknown";
};

export type OperationalWarning = {
  type:
    | "missing_driver"
    | "missing_location"
    | "location_stale"
    | "missing_destination_coordinates"
    | "traffic_delay"
    | "next_booking_conflict"
    | "location_review_required";
  severity: "info" | "warning" | "critical";
  message: string;
};

export type WarningSeverity = "info" | "warning" | "critical";

const STALE_LOCATION_MINS = 15;

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hr = h ?? 0;
  const ampm = hr >= 12 ? "PM" : "AM";
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

export type WarningInputs = {
  isHomeService: boolean;
  driverId?: string | null;
  /** Only needs recorded_at for staleness check */
  location?: { recorded_at: string } | null;
  destLat?: number | null;
  destLng?: number | null;
  needsLocationReview?: boolean;
  liveEta?: LiveEtaData | null;
  nextBookingStartTime?: string | null;
  bookingEndTime: string;
  travelBufferMins?: number | null;
};

export function computeOperationalWarnings(inputs: WarningInputs): OperationalWarning[] {
  if (!inputs.isHomeService) return [];

  const warnings: OperationalWarning[] = [];

  // Missing driver
  if (!inputs.driverId) {
    warnings.push({
      type: "missing_driver",
      severity: "warning",
      message: "No driver assigned to this home-service trip.",
    });
  }

  // Missing destination coords — ETA impossible
  if (!inputs.destLat || !inputs.destLng) {
    warnings.push({
      type: "missing_destination_coordinates",
      severity: "warning",
      message: "Destination coordinates missing — live ETA unavailable.",
    });
  }

  // Dispatch zone flagged for review
  if (inputs.needsLocationReview) {
    warnings.push({
      type: "location_review_required",
      severity: "warning",
      message: "Dispatch zone not confirmed — requires CSR review.",
    });
  }

  // No location at all
  if (!inputs.location) {
    warnings.push({
      type: "missing_location",
      severity: "info",
      message: "No live location received yet for this trip.",
    });
  } else {
    // Stale location
    const minsAgo = Math.floor(
      (Date.now() - new Date(inputs.location.recorded_at).getTime()) / 60000
    );
    if (minsAgo > STALE_LOCATION_MINS) {
      warnings.push({
        type: "location_stale",
        severity: "warning",
        message: `Location is ${minsAgo}m old — may not reflect current position.`,
      });
    }
  }

  if (inputs.liveEta) {
    const buffer = inputs.travelBufferMins ?? 30;

    // Traffic delay: ETA significantly exceeds planned buffer
    if (
      inputs.liveEta.eta_minutes > buffer * 1.5 &&
      inputs.liveEta.eta_minutes > buffer + 10
    ) {
      warnings.push({
        type: "traffic_delay",
        severity: "warning",
        message: `Live ETA ${inputs.liveEta.eta_minutes}m exceeds planned buffer ${buffer}m.`,
      });
    }

    // Next booking conflict: estimated return time overlaps next appointment
    if (inputs.nextBookingStartTime) {
      const endMins = timeToMins(inputs.bookingEndTime);
      const nextStartMins = timeToMins(inputs.nextBookingStartTime);
      // Return time = service end + ETA back (assume symmetrical journey)
      const estimatedReturn = endMins + inputs.liveEta.eta_minutes;
      if (estimatedReturn > nextStartMins) {
        warnings.push({
          type: "next_booking_conflict",
          severity: "critical",
          message: `Return ETA may conflict with next booking at ${formatTime12(inputs.nextBookingStartTime)}.`,
        });
      }
    }
  }

  return warnings;
}

/** Returns the highest severity across a list of warnings, or null if none. */
export function maxWarningSeverity(
  warnings: OperationalWarning[]
): WarningSeverity | null {
  if (warnings.some((w) => w.severity === "critical")) return "critical";
  if (warnings.some((w) => w.severity === "warning")) return "warning";
  if (warnings.some((w) => w.severity === "info")) return "info";
  return null;
}

/** Parse a raw metadata dispatch.live_eta blob into LiveEtaData or null. */
export function parseLiveEta(raw: unknown): LiveEtaData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.eta_minutes !== "number" ||
    typeof r.calculated_at !== "string" ||
    r.source !== "routes_api"
  ) {
    return null;
  }
  const validOrigins = ["driver_location", "therapist_location", "branch", "unknown"] as const;
  const origin = validOrigins.includes(r.origin as LiveEtaData["origin"])
    ? (r.origin as LiveEtaData["origin"])
    : "unknown";
  return {
    eta_minutes: r.eta_minutes,
    calculated_at: r.calculated_at,
    source: "routes_api",
    origin,
  };
}
