import type { DispatchJourney } from "@/lib/driver/dispatch";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { AcceptedArrivalRecord, CrmArrivalEventKind } from "./arrival-events";
import { buildRouteCacheKey, isValidGeoPoint, type GeoPoint } from "./route-eta";

export const GPS_LIVE_THRESHOLD_MS = 2 * 60_000;
export const GPS_STALE_THRESHOLD_MS = 15 * 60_000;
export const GPS_MAX_ACCURACY_METERS = 100;
export const SERVICE_ENDING_SOON_SECS = 10 * 60;

export type GpsFreshnessState =
  | "live"
  | "delayed"
  | "stale"
  | "poor_accuracy"
  | "permission_missing"
  | "offline"
  | "unavailable";

export type RealtimeConnectionState = "connected" | "reconnecting" | "disconnected";

export type CollectionDecision = "required" | "not_required" | "undecided";

export type CrmJourneyDisplayStatus =
  | "Awaiting Travel"
  | "En route"
  | "Arrived at pickup"
  | "Picked up"
  | "Arrived at customer"
  | "Service in progress"
  | "Service completed"
  | "Ready for collection"
  | "Collection en route"
  | "Arrived for collection"
  | "Collected"
  | "Completed"
  | "Needs attention";

export type DriverActivityCategory =
  | "travelling"
  | "arriving"
  | "waiting"
  | "in_service"
  | "collecting"
  | "completed"
  | "unavailable";

export interface DriverGpsSnapshot {
  lat: number;
  lng: number;
  recordedAt: string;
  accuracyMeters?: number | null;
  source?: string | null;
  staffId?: string | null;
  permissionMissing?: boolean;
  driverOffline?: boolean;
}

export interface DriverReliabilityInfo {
  state: GpsFreshnessState;
  isLive: boolean;
  isStale: boolean;
  label: string;
  badgeText: string;
  ageMinutes: number | null;
  accuracyMeters: number | null;
  recordedAt: string | null;
  note: string;
}

export interface CollectionRequirementInfo {
  decision: CollectionDecision;
  hasValidApproval: boolean;
  reasonCode: string | null;
  source: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  collectionDriverId: string | null;
  collectionDriverName: string | null;
  collectionConfirmed: boolean;
  label: string;
  requiresResolution: boolean;
}

export interface CrmServiceTimerSummary {
  state: "not_started" | "in_progress" | "ending_soon" | "completed";
  isActive: boolean;
  isEndingSoon: boolean;
  isCompleted: boolean;
  remainingSeconds: number | null;
  overtimeSeconds: number;
  expectedEndIso: string | null;
  label: string;
  predictiveNote: string | null;
}

export interface DriverStopSummary {
  stopId: string;
  bookingId: string;
  bookingNumber: string;
  stopKind: "pickup" | "customer_dropoff" | "collection" | "return";
  customerName: string;
  therapistId: string;
  therapistName: string | null;
  serviceName: string;
  destinationLabel: string;
  lat: number | null;
  lng: number | null;
  hasAuthorizedDestination: boolean;
  scheduledStartTime: string;
  scheduledEndTime: string;
  statusLabel: CrmJourneyDisplayStatus;
  predictiveEndingSoon: boolean;
  serviceTimer: CrmServiceTimerSummary;
  collection: CollectionRequirementInfo;
  etaMinutes: number | null;
  boardingConfirmed: boolean;
  collectionConfirmed: boolean;
  latestArrival: AcceptedArrivalRecord | null;
}

export interface DriverTrack {
  driverKey: string;
  driverId: string | null;
  driverName: string;
  isAssignedDriver: boolean;
  location: DriverGpsSnapshot | null;
  reliability: DriverReliabilityInfo;
  currentStatusLabel: CrmJourneyDisplayStatus;
  predictiveEndingSoon: boolean;
  category: DriverActivityCategory;
  isOnline: boolean;
  nextStop: DriverStopSummary | null;
  stops: DriverStopSummary[];
  therapists: Array<{
    id: string;
    name: string;
    bookingId: string;
    customerName: string;
    statusLabel: CrmJourneyDisplayStatus;
    collectionLabel: string;
  }>;
  collectionSummary: CollectionRequirementInfo | null;
  routeKey: string;
  etaMinutes: number | null;
  estimatedArrivalIso: string | null;
  distanceMeters: number | null;
}

export interface LiveMapDriversViewModel {
  drivers: DriverTrack[];
  unassignedBookings: RealDispatchItem[];
  terminalBookingIds: string[];
  activeBookingCount: number;
}

/**
 * Merges incoming GPS snapshots monotonically so delayed/out-of-order packets
 * never move a driver marker backward. Never confuses invalid coords as valid.
 */
export function mergeMonotonicGpsLocation(
  current: DriverGpsSnapshot | null | undefined,
  incoming: DriverGpsSnapshot | null | undefined
): DriverGpsSnapshot | null {
  if (!incoming || !isValidGeoPoint({ lat: incoming.lat, lng: incoming.lng })) {
    return current ?? null;
  }
  const incomingMs = Date.parse(incoming.recordedAt);
  if (!Number.isFinite(incomingMs)) {
    return current ?? null;
  }
  if (!current) return incoming;

  const currentMs = Date.parse(current.recordedAt);
  if (!Number.isFinite(currentMs) || incomingMs > currentMs) {
    return incoming;
  }
  if (incomingMs === currentMs && incoming.accuracyMeters !== undefined) {
    return {
      ...current,
      accuracyMeters: current.accuracyMeters ?? incoming.accuracyMeters,
    };
  }
  return current;
}

/**
 * Classifies driver GPS freshness and reliability without ever labeling stale
 * GPS data as live or claiming missing GPS means the driver stopped working.
 */
export function classifyDriverLocation(
  location: DriverGpsSnapshot | null | undefined,
  options?: {
    nowMs?: number;
    permissionMissing?: boolean;
    driverOffline?: boolean;
    connectionState?: RealtimeConnectionState;
  }
): DriverReliabilityInfo {
  const nowMs = options?.nowMs ?? Date.now();
  const permissionMissing = options?.permissionMissing || location?.permissionMissing;
  const driverOffline = options?.driverOffline || location?.driverOffline;

  if (permissionMissing) {
    return {
      state: "permission_missing",
      isLive: false,
      isStale: true,
      label: "Location permission missing",
      badgeText: "Permission missing",
      ageMinutes: null,
      accuracyMeters: location?.accuracyMeters ?? null,
      recordedAt: location?.recordedAt ?? null,
      note: "Driver device has not granted location access. Missing GPS does not mean work stopped.",
    };
  }

  if (!location || !isValidGeoPoint({ lat: location.lat, lng: location.lng })) {
    return {
      state: driverOffline ? "offline" : "unavailable",
      isLive: false,
      isStale: true,
      label: driverOffline ? "Driver offline — GPS unavailable" : "Driver GPS not yet shared",
      badgeText: driverOffline ? "Offline" : "No GPS yet",
      ageMinutes: null,
      accuracyMeters: null,
      recordedAt: null,
      note: "Awaiting valid location snapshot. Verify status before acting.",
    };
  }

  const recordedMs = Date.parse(location.recordedAt);
  if (!Number.isFinite(recordedMs)) {
    return {
      state: "unavailable",
      isLive: false,
      isStale: true,
      label: "Driver GPS time unavailable (not live)",
      badgeText: "Time unavailable",
      ageMinutes: null,
      accuracyMeters: location.accuracyMeters ?? null,
      recordedAt: null,
      note: "Recorded GPS timestamp could not be verified.",
    };
  }

  const ageMs = Math.max(0, nowMs - recordedMs);
  const ageMinutes = Math.floor(ageMs / 60_000);
  const accuracy =
    typeof location.accuracyMeters === "number" && Number.isFinite(location.accuracyMeters)
      ? location.accuracyMeters
      : null;

  if (driverOffline) {
    return {
      state: "offline",
      isLive: false,
      isStale: true,
      label: `Offline · last GPS ${ageMinutes} min ago (not live)`,
      badgeText: `Offline · ${ageMinutes}m ago`,
      ageMinutes,
      accuracyMeters: accuracy,
      recordedAt: location.recordedAt,
      note: "Driver device appears offline. Last known position is shown.",
    };
  }

  if (ageMs > GPS_STALE_THRESHOLD_MS) {
    return {
      state: "stale",
      isLive: false,
      isStale: true,
      label: `Stale GPS · ${ageMinutes} min ago (not live)`,
      badgeText: `Stale · ${ageMinutes}m ago`,
      ageMinutes,
      accuracyMeters: accuracy,
      recordedAt: location.recordedAt,
      note: "Signal is delayed/stale; missing updates do not mean the driver stopped working.",
    };
  }

  if (ageMs > GPS_LIVE_THRESHOLD_MS) {
    return {
      state: "delayed",
      isLive: false,
      isStale: true,
      label: `Delayed GPS · ${ageMinutes} min ago (not live)`,
      badgeText: `Delayed · ${ageMinutes}m ago`,
      ageMinutes,
      accuracyMeters: accuracy,
      recordedAt: location.recordedAt,
      note: "Last update exceeded the 2-minute live window (not live).",
    };
  }

  if (accuracy !== null && accuracy > GPS_MAX_ACCURACY_METERS) {
    return {
      state: "poor_accuracy",
      isLive: false,
      isStale: false,
      label: `Low GPS accuracy (±${Math.round(accuracy)}m)`,
      badgeText: `Low accuracy (±${Math.round(accuracy)}m)`,
      ageMinutes,
      accuracyMeters: accuracy,
      recordedAt: location.recordedAt,
      note: "Recent GPS fix has coarse accuracy; arrival will still be confirmed independently.",
    };
  }

  const reconnectingNote =
    options?.connectionState && options.connectionState !== "connected"
      ? "Realtime reconnecting — verifying latest server state."
      : accuracy !== null
        ? `Live GPS (±${Math.round(accuracy)}m)`
        : "Live GPS (within 2 min)";

  return {
    state: "live",
    isLive: true,
    isStale: false,
    label: ageMinutes === 0 ? "Live GPS · just now" : `Live GPS · ${ageMinutes} min ago`,
    badgeText: ageMinutes === 0 ? "Live GPS" : `Live · ${ageMinutes}m`,
    ageMinutes,
    accuracyMeters: accuracy,
    recordedAt: location.recordedAt,
    note: reconnectingNote,
  };
}

/**
 * Extracts and validates conditional therapist collection obligations.
 * Never invents `not_required` without authoritative approval metadata, and
 * forces `undecided` when approval signals conflict.
 */
export function parseCollectionRequirement(input: {
  rawRequirement?: RealDispatchItem["collectionRequirement"] | null;
  transportJourney?: DispatchJourney | null;
}): CollectionRequirementInfo {
  const raw = input.rawRequirement ?? null;
  const stage = input.transportJourney?.journey.stage ?? null;
  const confirmedStages = new Set(["return_pending", "return_enroute", "return_arrived", "complete"]);

  if (raw) {
    const hasApprovalMetadata = Boolean(raw.approvedBy || raw.approvedAt || raw.source);
    if (raw.conflictingApproval) {
      return {
        decision: "undecided",
        hasValidApproval: false,
        reasonCode: raw.reasonCode ?? "CONFLICTING_APPROVAL",
        source: raw.source ?? null,
        approvedBy: null,
        approvedAt: null,
        collectionDriverId: raw.collectionDriverId ?? null,
        collectionDriverName: raw.collectionDriverName ?? null,
        collectionConfirmed: false,
        label: "Collection undecided — resolve conflicting approval",
        requiresResolution: true,
      };
    }

    if (raw.decision === "not_required") {
      if (!hasApprovalMetadata) {
        return {
          decision: "undecided",
          hasValidApproval: false,
          reasonCode: raw.reasonCode ?? "APPROVAL_UNVERIFIED",
          source: null,
          approvedBy: null,
          approvedAt: null,
          collectionDriverId: raw.collectionDriverId ?? null,
          collectionDriverName: raw.collectionDriverName ?? null,
          collectionConfirmed: false,
          label: "Collection undecided — independent departure unconfirmed",
          requiresResolution: true,
        };
      }
      return {
        decision: "not_required",
        hasValidApproval: true,
        reasonCode: raw.reasonCode ?? "APPROVED_INDEPENDENT_DEPARTURE",
        source: raw.source ?? "schedule",
        approvedBy: raw.approvedBy ?? null,
        approvedAt: raw.approvedAt ?? null,
        collectionDriverId: null,
        collectionDriverName: null,
        collectionConfirmed: false,
        label: "Collection not required (approved independent departure)",
        requiresResolution: false,
      };
    }

    if (raw.decision === "required") {
      const confirmed =
        Boolean(raw.collectionConfirmed) || (stage !== null && confirmedStages.has(stage));
      return {
        decision: "required",
        hasValidApproval: false,
        reasonCode: raw.reasonCode ?? null,
        source: raw.source ?? null,
        approvedBy: raw.approvedBy ?? null,
        approvedAt: raw.approvedAt ?? null,
        collectionDriverId: raw.collectionDriverId ?? null,
        collectionDriverName: raw.collectionDriverName ?? null,
        collectionConfirmed: confirmed,
        label: raw.collectionDriverName
          ? `Collection required · ${raw.collectionDriverName}`
          : "Collection required",
        requiresResolution: false,
      };
    }
  }

  if (
    stage &&
    [
      "collection_pending",
      "collection_enroute",
      "collection_arrived",
      "return_pending",
      "return_enroute",
      "return_arrived",
      "complete",
    ].includes(stage)
  ) {
    return {
      decision: "required",
      hasValidApproval: false,
      reasonCode: "ACTIVE_COLLECTION_JOURNEY",
      source: "driver_unified_journey",
      approvedBy: null,
      approvedAt: null,
      collectionDriverId: null,
      collectionDriverName: input.transportJourney?.driverName ?? null,
      collectionConfirmed: confirmedStages.has(stage),
      label: input.transportJourney?.driverName
        ? `Collection required · ${input.transportJourney.driverName}`
        : "Collection required",
      requiresResolution: false,
    };
  }

  return {
    decision: "undecided",
    hasValidApproval: false,
    reasonCode: raw?.reasonCode ?? null,
    source: raw?.source ?? null,
    approvedBy: null,
    approvedAt: null,
    collectionDriverId: raw?.collectionDriverId ?? null,
    collectionDriverName: raw?.collectionDriverName ?? null,
    collectionConfirmed: false,
    label: "Collection undecided — confirmation required",
    requiresResolution: true,
  };
}

/**
 * Reuses existing authoritative Staff Portal timestamps (`sessionStartedAt`,
 * `sessionDueAt`, `sessionCompletedAt`) to show service countdown & predictive
 * "Ending soon" indicator without ever auto-completing when countdown hits 0.
 */
export function computeCrmServiceTimerSummary(input: {
  bookingStatus: string;
  bookingProgressStatus: string;
  sessionStartedAt?: string | null;
  sessionDueAt?: string | null;
  sessionCompletedAt?: string | null;
  completedAt?: string | null;
  sessionCompletionSource?: string | null;
  durationMinutes?: number | null;
  nowMs?: number;
}): CrmServiceTimerSummary {
  const nowMs = input.nowMs ?? Date.now();
  const hasConfirmedCompletion =
    input.bookingStatus === "completed" ||
    input.bookingProgressStatus === "completed" ||
    (Boolean(input.sessionCompletedAt ?? input.completedAt) &&
      input.sessionCompletionSource !== "auto_due");

  if (hasConfirmedCompletion) {
    return {
      state: "completed",
      isActive: false,
      isEndingSoon: false,
      isCompleted: true,
      remainingSeconds: 0,
      overtimeSeconds: 0,
      expectedEndIso: input.sessionCompletedAt ?? input.completedAt ?? null,
      label: "Service completed (confirmed)",
      predictiveNote: null,
    };
  }

  const isInService =
    input.bookingProgressStatus === "session_started" || input.bookingStatus === "in_progress";
  if (!isInService) {
    return {
      state: "not_started",
      isActive: false,
      isEndingSoon: false,
      isCompleted: false,
      remainingSeconds: null,
      overtimeSeconds: 0,
      expectedEndIso: input.sessionDueAt ?? null,
      label: "Service not started",
      predictiveNote: null,
    };
  }

  const startedMs = input.sessionStartedAt ? Date.parse(input.sessionStartedAt) : NaN;
  const authoritativeDueMs = input.sessionDueAt ? Date.parse(input.sessionDueAt) : NaN;
  const fallbackDueMs =
    Number.isFinite(startedMs) && typeof input.durationMinutes === "number" && input.durationMinutes > 0
      ? startedMs + input.durationMinutes * 60_000
      : NaN;
  const dueMs = Number.isFinite(authoritativeDueMs) ? authoritativeDueMs : fallbackDueMs;

  if (!Number.isFinite(dueMs)) {
    return {
      state: "in_progress",
      isActive: true,
      isEndingSoon: false,
      isCompleted: false,
      remainingSeconds: null,
      overtimeSeconds: 0,
      expectedEndIso: null,
      label: "Service in progress",
      predictiveNote: null,
    };
  }

  const diffSeconds = Math.floor((dueMs - nowMs) / 1_000);
  const expectedEndIso = new Date(dueMs).toISOString();
  if (diffSeconds <= 0) {
    const overtimeSeconds = Math.abs(diffSeconds);
    const overtimeMins = Math.max(0, Math.floor(overtimeSeconds / 60));
    return {
      state: "ending_soon",
      isActive: true,
      isEndingSoon: true,
      isCompleted: false,
      remainingSeconds: 0,
      overtimeSeconds,
      expectedEndIso,
      label: `Expected end reached (${overtimeMins}m past) · awaiting therapist completion`,
      predictiveNote: "Predictive timer reached 0 — therapist confirmation still required.",
    };
  }

  const remainingMins = Math.ceil(diffSeconds / 60);
  const endingSoon = diffSeconds <= SERVICE_ENDING_SOON_SECS;

  return {
    state: endingSoon ? "ending_soon" : "in_progress",
    isActive: true,
    isEndingSoon: endingSoon,
    isCompleted: false,
    remainingSeconds: diffSeconds,
    overtimeSeconds: 0,
    expectedEndIso,
    label: endingSoon
      ? `Service ending soon (${remainingMins} min left)`
      : `Service in progress (${remainingMins} min left)`,
    predictiveNote: endingSoon
      ? "Predictive estimate — collection becomes ready only after therapist confirms completion."
      : null,
  };
}

/**
 * Maps authoritative booking progress, unified journey stages, accepted
 * arrival events, service timer, and collection requirement into Section 7 labels.
 */
export function presentCrmJourneyStatus(input: {
  bookingStatus: string;
  bookingProgressStatus: string;
  driverId: string | null;
  transportJourney?: DispatchJourney | null;
  arrivals?: Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>> | null;
  serviceTimer: CrmServiceTimerSummary;
  collection: CollectionRequirementInfo;
}): {
  statusLabel: CrmJourneyDisplayStatus;
  category: DriverActivityCategory;
  boardingConfirmed: boolean;
  collectionConfirmed: boolean;
} {
  const stage = input.transportJourney?.journey.stage ?? null;
  const arrivals = input.arrivals ?? null;

  // Collection & completion stages take precedence once service has completed
  if (input.serviceTimer.isCompleted || stage === "complete" || stage === "collection_pending" || stage === "collection_enroute" || stage === "collection_arrived" || stage === "return_pending" || stage === "return_enroute" || stage === "return_arrived") {
    if (stage === "complete") {
      return {
        statusLabel: "Completed",
        category: "completed",
        boardingConfirmed: true,
        collectionConfirmed: input.collection.decision === "required",
      };
    }

    if (input.collection.decision === "not_required" && input.collection.hasValidApproval) {
      return {
        statusLabel: "Completed",
        category: "completed",
        boardingConfirmed: true,
        collectionConfirmed: false,
      };
    }

    if (stage === "return_pending" || stage === "return_enroute" || stage === "return_arrived" || input.collection.collectionConfirmed) {
      return {
        statusLabel: "Collected",
        category: "collecting",
        boardingConfirmed: true,
        collectionConfirmed: true,
      };
    }

    if (stage === "collection_arrived" || arrivals?.collection_arrival) {
      return {
        statusLabel: "Arrived for collection",
        category: "arriving",
        boardingConfirmed: true,
        collectionConfirmed: false,
      };
    }

    if (stage === "collection_enroute") {
      return {
        statusLabel: "Collection en route",
        category: "collecting",
        boardingConfirmed: true,
        collectionConfirmed: false,
      };
    }

    if (stage === "collection_pending" || arrivals?.collection_ready || input.collection.decision === "required") {
      return {
        statusLabel: "Ready for collection",
        category: "collecting",
        boardingConfirmed: true,
        collectionConfirmed: false,
      };
    }

    return {
      statusLabel: "Service completed",
      category: "waiting",
      boardingConfirmed: true,
      collectionConfirmed: false,
    };
  }

  // Active service always outranks travel/arrival labels
  if (input.serviceTimer.isActive || stage === "service_active") {
    return {
      statusLabel: "Service in progress",
      category: "in_service",
      boardingConfirmed: true,
      collectionConfirmed: false,
    };
  }

  if (stage === "review") {
    return {
      statusLabel: "Needs attention",
      category: "unavailable",
      boardingConfirmed: false,
      collectionConfirmed: false,
    };
  }

  if (stage === "customer_arrived" || input.bookingProgressStatus === "arrived" || arrivals?.customer_arrival) {
    return {
      statusLabel: "Arrived at customer",
      category: "arriving",
      boardingConfirmed: true,
      collectionConfirmed: false,
    };
  }

  if (stage === "delivery_enroute" || input.bookingProgressStatus === "travel_started") {
    return {
      statusLabel: "En route",
      category: "travelling",
      boardingConfirmed: true,
      collectionConfirmed: false,
    };
  }

  if (stage === "delivery_pending") {
    return {
      statusLabel: "Picked up",
      category: "waiting",
      boardingConfirmed: true,
      collectionConfirmed: false,
    };
  }

  if (stage === "pickup_arrived" || arrivals?.pickup_arrival) {
    return {
      statusLabel: "Arrived at pickup",
      category: "arriving",
      boardingConfirmed: false,
      collectionConfirmed: false,
    };
  }

  if (stage === "pickup_enroute") {
    return {
      statusLabel: "En route",
      category: "travelling",
      boardingConfirmed: false,
      collectionConfirmed: false,
    };
  }

  if (!input.driverId) {
    return {
      statusLabel: "Needs attention",
      category: "waiting",
      boardingConfirmed: false,
      collectionConfirmed: false,
    };
  }

  return {
    statusLabel: "Awaiting Travel",
    category: "waiting",
    boardingConfirmed: false,
    collectionConfirmed: false,
  };
}

function isStopTerminal(
  item: RealDispatchItem,
  collection: CollectionRequirementInfo,
  journey?: DispatchJourney | null
): boolean {
  if (["cancelled", "no_show", "expired"].includes(item.bookingStatus)) return true;
  if (item.bookingProgressStatus === "no_show") return true;
  if (journey?.journey.stage === "complete") return true;

  const serviceCompleted =
    item.bookingStatus === "completed" ||
    item.bookingProgressStatus === "completed";

  if (!serviceCompleted) return false;

  if (journey) return false;
  if (collection.decision === "not_required" && collection.hasValidApproval) return true;
  if (collection.collectionConfirmed) return true;
  return false;
}

function resolveStopDestination(
  item: RealDispatchItem,
  journey: DispatchJourney | null,
  statusLabel: CrmJourneyDisplayStatus
): {
  stopKind: DriverStopSummary["stopKind"];
  label: string;
  lat: number | null;
  lng: number | null;
} {
  if (statusLabel === "Arrived at pickup" || journey?.journey.stage === "pickup_enroute" || journey?.journey.stage === "pickup_pending") {
    const label = journey?.journey.pickupLabel || item.branchName || "Branch Pickup";
    return {
      stopKind: "pickup",
      label,
      lat: journey?.journey.destination?.lat ?? item.branchLat ?? item.lat,
      lng: journey?.journey.destination?.lng ?? item.branchLng ?? item.lng,
    };
  }

  if (
    journey?.journey.leg === "collection" ||
    statusLabel === "Ready for collection" ||
    statusLabel === "Collection en route" ||
    statusLabel === "Arrived for collection"
  ) {
    return {
      stopKind: "collection",
      label:
        journey?.journey.destination?.label ||
        item.area ||
        item.formattedAddress ||
        item.customerName,
      lat: journey?.journey.destination?.lat ?? item.lat,
      lng: journey?.journey.destination?.lng ?? item.lng,
    };
  }

  if (journey?.journey.leg === "return" || statusLabel === "Collected") {
    return {
      stopKind: "return",
      label: item.branchName || journey?.journey.branchName || "Branch Return",
      lat: journey?.journey.destination?.lat ?? item.branchLat ?? null,
      lng: journey?.journey.destination?.lng ?? item.branchLng ?? null,
    };
  }

  return {
    stopKind: "customer_dropoff",
    label: item.area ?? item.formattedAddress ?? item.customerName ?? "Customer location",
    lat: !item.needsLocationReview ? item.lat : null,
    lng: !item.needsLocationReview ? item.lng : null,
  };
}

export interface DriverRouteDisplayMetrics {
  etaMinutes: number | null;
  distanceMeters: number | null;
  estimatedArrivalIso: string | null;
}

/**
 * Builds the unified multi-driver + multi-therapist Live Map view model.
 * Keeps customer pins distinct from vehicle GPS, isolates drivers from each other,
 * removes cancelled/terminal trips, and preserves individual therapist/stop states.
 */
export function buildLiveMapDriversViewModel(input: {
  items: RealDispatchItem[];
  transportJourneys?: DispatchJourney[];
  locationOverrides?: ReadonlyMap<string, DriverGpsSnapshot>;
  arrivalsByBooking?: ReadonlyMap<string, Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>>>;
  driverPermissions?: ReadonlyMap<string, { permissionMissing?: boolean; offline?: boolean }>;
  routeMetricsByDriver?: ReadonlyMap<string, DriverRouteDisplayMetrics>;
  connectionState?: RealtimeConnectionState;
  nowMs?: number;
}): LiveMapDriversViewModel {
  const nowMs = input.nowMs ?? Date.now();
  const journeyByBookingId = new Map(
    (input.transportJourneys ?? []).map((entry) => [entry.journey.bookingId, entry])
  );

  const groupedStops = new Map<
    string,
    {
      driverId: string;
      driverName: string;
      latestLocation: DriverGpsSnapshot | null;
      stops: DriverStopSummary[];
      latestStatusPriority: number;
    }
  >();

  const unassignedBookings: RealDispatchItem[] = [];
  const terminalBookingIds: string[] = [];

  for (const item of input.items) {
    const journey = journeyByBookingId.get(item.id) ?? null;
    const collection = parseCollectionRequirement({
      rawRequirement: item.collectionRequirement,
      transportJourney: journey,
    });

    if (isStopTerminal(item, collection, journey)) {
      terminalBookingIds.push(item.id);
      continue;
    }

    // Active collection may be assigned to a collection driver different from delivery driver
    const activeServiceCompleted =
      item.bookingStatus === "completed" || item.bookingProgressStatus === "completed";
    const effectiveDriverId =
      activeServiceCompleted && collection.decision === "required" && collection.collectionDriverId
        ? collection.collectionDriverId
        : item.driverId;
    const effectiveDriverName =
      activeServiceCompleted &&
      collection.decision === "required" &&
      collection.collectionDriverId &&
      collection.collectionDriverName
        ? collection.collectionDriverName
        : item.driverName ?? journey?.driverName ?? null;

    if (!effectiveDriverId) {
      unassignedBookings.push(item);
      continue;
    }

    const serviceTimer = computeCrmServiceTimerSummary({
      bookingStatus: item.bookingStatus,
      bookingProgressStatus: item.bookingProgressStatus,
      sessionStartedAt: item.sessionStartedAt,
      sessionDueAt: item.sessionDueAt,
      sessionCompletedAt: item.sessionCompletedAt ?? item.completedAt,
      completedAt: item.completedAt,
      sessionCompletionSource: item.sessionCompletionSource,
      durationMinutes: item.durationMinutes,
      nowMs,
    });

    const arrivals = input.arrivalsByBooking?.get(item.id) ?? null;
    const presentation = presentCrmJourneyStatus({
      bookingStatus: item.bookingStatus,
      bookingProgressStatus: item.bookingProgressStatus,
      driverId: effectiveDriverId,
      transportJourney: journey,
      arrivals,
      serviceTimer,
      collection,
    });

    const destination = resolveStopDestination(item, journey, presentation.statusLabel);
    const hasAuthorizedDestination = isValidGeoPoint(
      destination.lat !== null && destination.lng !== null
        ? { lat: destination.lat, lng: destination.lng }
        : null
    );

    const latestArrival =
      arrivals?.collection_arrival ??
      arrivals?.customer_arrival ??
      arrivals?.pickup_arrival ??
      arrivals?.collection_ready ??
      null;

    const stopSummary: DriverStopSummary = {
      stopId: `${item.id}:${destination.stopKind}`,
      bookingId: item.id,
      bookingNumber: item.number,
      stopKind: destination.stopKind,
      customerName: item.customerName,
      therapistId: item.therapistId,
      therapistName: item.therapistName ?? journey?.journey.therapistName ?? null,
      serviceName: item.serviceName,
      destinationLabel: destination.label,
      lat: destination.lat,
      lng: destination.lng,
      hasAuthorizedDestination,
      scheduledStartTime: item.startTime,
      scheduledEndTime: item.endTime,
      statusLabel: presentation.statusLabel,
      predictiveEndingSoon: serviceTimer.isEndingSoon,
      serviceTimer,
      collection,
      etaMinutes: item.eta?.minutes ?? item.etaMinutes ?? null,
      boardingConfirmed: presentation.boardingConfirmed,
      collectionConfirmed: presentation.collectionConfirmed,
      latestArrival,
    };

    const bookingLocation: DriverGpsSnapshot | null = item.currentLocation
      ? {
          lat: item.currentLocation.lat,
          lng: item.currentLocation.lng,
          recordedAt: item.currentLocation.recorded_at,
          accuracyMeters: item.currentLocation.accuracyMeters ?? null,
          source: item.currentLocation.source ?? null,
          staffId: item.currentLocation.staffId ?? effectiveDriverId,
        }
      : null;

    const journeyLocation: DriverGpsSnapshot | null = journey?.location
      ? {
          lat: journey.location.lat,
          lng: journey.location.lng,
          recordedAt: journey.location.recordedAt,
          staffId: effectiveDriverId,
        }
      : null;

    const overrideByBooking = input.locationOverrides?.get(`booking:${item.id}`);
    const overrideByDriver = input.locationOverrides?.get(`driver:${effectiveDriverId}`);
    let mergedLocation = mergeMonotonicGpsLocation(bookingLocation, journeyLocation);
    mergedLocation = mergeMonotonicGpsLocation(mergedLocation, overrideByBooking);
    mergedLocation = mergeMonotonicGpsLocation(mergedLocation, overrideByDriver);

    let group = groupedStops.get(effectiveDriverId);
    if (!group) {
      group = {
        driverId: effectiveDriverId,
        driverName: effectiveDriverName ?? "Assigned driver",
        latestLocation: mergedLocation,
        stops: [],
        latestStatusPriority: 0,
      };
      groupedStops.set(effectiveDriverId, group);
    } else {
      group.latestLocation = mergeMonotonicGpsLocation(group.latestLocation, mergedLocation);
    }
    group.stops.push(stopSummary);
  }

  // Include active enrolled transportJourneys whose booking is not already represented in items
  const representedIds = new Set(input.items.map((item) => item.id));
  for (const journeyEntry of input.transportJourneys ?? []) {
    const j = journeyEntry.journey;
    if (representedIds.has(j.bookingId) || j.stage === "complete") continue;
    const driverIdKey = `journey-driver:${journeyEntry.driverName ?? j.bookingId}`;
    const serviceTimer = computeCrmServiceTimerSummary({
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      nowMs,
    });
    const collection = parseCollectionRequirement({ transportJourney: journeyEntry });
    const arrivals = input.arrivalsByBooking?.get(j.bookingId) ?? null;
    const presentation = presentCrmJourneyStatus({
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      driverId: driverIdKey,
      transportJourney: journeyEntry,
      arrivals,
      serviceTimer,
      collection,
    });

    const stopSummary: DriverStopSummary = {
      stopId: `${j.bookingId}:${j.leg ?? "collection"}`,
      bookingId: j.bookingId,
      bookingNumber: j.bookingId.slice(0, 8),
      stopKind: j.leg === "return" ? "return" : "collection",
      customerName: j.customerName ?? "Home Service",
      therapistId: "",
      therapistName: j.therapistName ?? null,
      serviceName: "Collection leg",
      destinationLabel: j.destination?.label ?? j.customerAddress ?? "Collection point",
      lat: j.destination?.lat ?? null,
      lng: j.destination?.lng ?? null,
      hasAuthorizedDestination: isValidGeoPoint(j.destination),
      scheduledStartTime: j.startTime ?? "00:00",
      scheduledEndTime: j.startTime ?? "00:00",
      statusLabel: presentation.statusLabel,
      predictiveEndingSoon: false,
      serviceTimer,
      collection,
      etaMinutes: null,
      boardingConfirmed: presentation.boardingConfirmed,
      collectionConfirmed: presentation.collectionConfirmed,
      latestArrival: arrivals?.collection_arrival ?? arrivals?.collection_ready ?? null,
    };

    const loc = journeyEntry.location
      ? {
          lat: journeyEntry.location.lat,
          lng: journeyEntry.location.lng,
          recordedAt: journeyEntry.location.recordedAt,
        }
      : null;

    groupedStops.set(driverIdKey, {
      driverId: driverIdKey,
      driverName: journeyEntry.driverName ?? "Assigned driver",
      latestLocation: loc,
      stops: [stopSummary],
      latestStatusPriority: 0,
    });
  }

  const drivers: DriverTrack[] = [];
  for (const group of groupedStops.values()) {
    group.stops.sort((a, b) =>
      `${a.scheduledStartTime}:${a.bookingId}`.localeCompare(
        `${b.scheduledStartTime}:${b.bookingId}`
      )
    );
    const activeStop = pickPrimaryActiveStop(group.stops);
    const perms = input.driverPermissions?.get(group.driverId);
    const reliability = classifyDriverLocation(group.latestLocation, {
      nowMs,
      permissionMissing: perms?.permissionMissing,
      driverOffline: perms?.offline,
      connectionState: input.connectionState,
    });

    const routeKey = buildRouteCacheKey({
      driverId: group.driverId,
      stops: group.stops.map((stop) => ({
        stopId: stop.stopId,
        lat: stop.hasAuthorizedDestination ? stop.lat : null,
        lng: stop.hasAuthorizedDestination ? stop.lng : null,
      })),
    });

    const routeMetrics = input.routeMetricsByDriver?.get(group.driverId);
    const etaMinutes = routeMetrics?.etaMinutes ?? activeStop?.etaMinutes ?? null;
    const estimatedArrivalIso =
      routeMetrics?.estimatedArrivalIso ??
      (etaMinutes !== null ? new Date(nowMs + etaMinutes * 60_000).toISOString() : null);

    const statusLabel = activeStop?.statusLabel ?? "Awaiting Travel";
    const category = statusCategoryForLabel(statusLabel, reliability.state);

    drivers.push({
      driverKey: group.driverId,
      driverId: group.driverId,
      driverName: group.driverName,
      isAssignedDriver: true,
      location: group.latestLocation,
      reliability,
      currentStatusLabel: statusLabel,
      predictiveEndingSoon: group.stops.some((stop) => stop.predictiveEndingSoon),
      category,
      isOnline: reliability.state !== "offline" && reliability.state !== "permission_missing",
      nextStop: activeStop,
      stops: group.stops,
      therapists: group.stops.map((stop) => ({
        id: stop.therapistId || stop.bookingId,
        name: stop.therapistName ?? "Assigned therapist",
        bookingId: stop.bookingId,
        customerName: stop.customerName,
        statusLabel: stop.statusLabel,
        collectionLabel: stop.collection.label,
      })),
      collectionSummary: activeStop?.collection ?? null,
      routeKey,
      etaMinutes,
      estimatedArrivalIso,
      distanceMeters: routeMetrics?.distanceMeters ?? null,
    });
  }

  drivers.sort((a, b) => a.driverName.localeCompare(b.driverName));

  return {
    drivers,
    unassignedBookings,
    terminalBookingIds,
    activeBookingCount:
      drivers.reduce((sum, driver) => sum + driver.stops.length, 0) + unassignedBookings.length,
  };
}

function pickPrimaryActiveStop(stops: DriverStopSummary[]): DriverStopSummary | null {
  const rank = (label: CrmJourneyDisplayStatus): number => {
    switch (label) {
      case "Arrived for collection":
        return 1;
      case "Collection en route":
        return 2;
      case "Arrived at customer":
        return 3;
      case "En route":
        return 4;
      case "Arrived at pickup":
        return 5;
      case "Picked up":
        return 6;
      case "Ready for collection":
        return 7;
      case "Service in progress":
        return 8;
      case "Service completed":
        return 9;
      default:
        return 10;
    }
  };
  return [...stops].sort((a, b) => rank(a.statusLabel) - rank(b.statusLabel))[0] ?? null;
}

function statusCategoryForLabel(
  label: CrmJourneyDisplayStatus,
  gpsState: GpsFreshnessState
): DriverActivityCategory {
  if (gpsState === "offline" || gpsState === "permission_missing") return "unavailable";
  switch (label) {
    case "En route":
      return "travelling";
    case "Arrived at pickup":
    case "Arrived at customer":
    case "Arrived for collection":
      return "arriving";
    case "Ready for collection":
    case "Collection en route":
    case "Collected":
      return "collecting";
    case "Service in progress":
      return "in_service";
    case "Completed":
      return "completed";
    default:
      return "waiting";
  }
}

export function extractLatLng(
  stop: Pick<DriverStopSummary, "lat" | "lng" | "hasAuthorizedDestination"> | null | undefined
): GeoPoint | null {
  if (!stop || !stop.hasAuthorizedDestination || stop.lat === null || stop.lng === null) {
    return null;
  }
  const point = { lat: stop.lat, lng: stop.lng };
  return isValidGeoPoint(point) ? point : null;
}
