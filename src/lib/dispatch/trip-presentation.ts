import type { DispatchJourney } from "@/lib/driver/dispatch";
import type { RealDispatchItem } from "@/lib/queries/dispatch-queries";
import type { AcceptedArrivalRecord, CrmArrivalEventKind } from "./arrival-events";
import {
  classifyDriverLocation,
  computeCrmServiceTimerSummary,
  mergeMonotonicGpsLocation,
  parseCollectionRequirement,
  presentCrmJourneyStatus,
  type CollectionRequirementInfo,
  type CrmJourneyDisplayStatus,
  type CrmServiceTimerSummary,
  type DriverGpsSnapshot,
  type DriverReliabilityInfo,
  type DriverTrack,
  type RealtimeConnectionState,
} from "./crm-live-map-model";
import { isValidGeoPoint } from "./route-eta";

export type TripStageKey =
  | "pickup"
  | "dispatched"
  | "en_route"
  | "arrived"
  | "in_service"
  | "collection"
  | "returning"
  | "completed";

export type TripFilterKey = "all" | Exclude<TripStageKey, "completed">;

export interface TripMiniStep {
  key: Exclude<TripStageKey, "completed">;
  shortLabel: string;
  label: string;
  state: "completed" | "current" | "upcoming" | "attention" | "skipped";
  tooltip: string;
}

export interface TripTimelineStep {
  key: TripStageKey | "collection_ready";
  label: string;
  detail: string | null;
  timestampIso: string | null;
  status: "completed" | "current" | "upcoming" | "attention" | "skipped";
  tooltip: string;
}

export interface LiveMapTripItem {
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  serviceName: string;
  locationSummary: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  driverId: string | null;
  driverName: string | null;
  driverReliability: DriverReliabilityInfo;
  therapistId: string;
  therapistName: string | null;
  stageKey: TripStageKey;
  stageBadgeLabel: string;
  detailedStatusLabel: CrmJourneyDisplayStatus;
  miniSteps: TripMiniStep[];
  timeline: TripTimelineStep[];
  etaMinutes: number | null;
  estimatedArrivalIso: string | null;
  distanceMeters: number | null;
  serviceTimer: CrmServiceTimerSummary;
  collection: CollectionRequirementInfo;
  lat: number | null;
  lng: number | null;
  hasCustomerGps: boolean;
  needsLocationReview: boolean;
  hasConfirmedPickupArrival: boolean;
  hasConfirmedCustomerArrival: boolean;
  hasConfirmedCollectionArrival: boolean;
  sharedDriverTripCount: number;
}

export type TripFilterCounts = Record<TripFilterKey, number>;

const STAGE_ORDER: Array<Exclude<TripStageKey, "completed">> = [
  "pickup",
  "dispatched",
  "en_route",
  "arrived",
  "in_service",
  "collection",
  "returning",
];

const SHORT_STEP_LABELS: Record<Exclude<TripStageKey, "completed">, { short: string; full: string }> = {
  pickup: { short: "Pick", full: "Pickup" },
  dispatched: { short: "Dispatch", full: "Dispatched" },
  en_route: { short: "En Route", full: "En Route" },
  arrived: { short: "Arrived", full: "Arrived" },
  in_service: { short: "In Service", full: "In Service" },
  collection: { short: "Collect", full: "Collection" },
  returning: { short: "Return", full: "Returning" },
};

function resolveStageKey(input: {
  bookingStatus: string;
  bookingProgressStatus: string;
  driverId: string | null;
  transportJourney: DispatchJourney | null;
  arrivals: Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>> | null;
  serviceTimer: CrmServiceTimerSummary;
  collection: CollectionRequirementInfo;
}): TripStageKey {
  const stage = input.transportJourney?.journey.stage ?? null;

  if (stage === "complete") return "completed";
  if (input.serviceTimer.isCompleted && input.collection.decision === "not_required" && input.collection.hasValidApproval) {
    return "completed";
  }
  if (stage === "return_pending" || stage === "return_enroute" || stage === "return_arrived" || input.collection.collectionConfirmed) {
    return "returning";
  }
  if (
    stage === "collection_pending" ||
    stage === "collection_enroute" ||
    stage === "collection_arrived" ||
    input.arrivals?.collection_arrival ||
    input.arrivals?.collection_ready ||
    input.serviceTimer.isCompleted
  ) {
    return "collection";
  }
  if (input.serviceTimer.isActive || stage === "service_active" || input.bookingProgressStatus === "session_started") {
    return "in_service";
  }
  if (stage === "customer_arrived" || input.bookingProgressStatus === "arrived" || input.arrivals?.customer_arrival) {
    return "arrived";
  }
  if (stage === "delivery_enroute" || input.bookingProgressStatus === "travel_started") {
    return "en_route";
  }
  if (stage === "pickup_pending" || stage === "pickup_enroute" || stage === "pickup_arrived" || input.arrivals?.pickup_arrival) {
    return "pickup";
  }
  if (stage === "delivery_pending" || input.driverId) {
    return "dispatched";
  }
  return "dispatched";
}

function stageBadgeForKey(key: TripStageKey, collection: CollectionRequirementInfo, driverId: string | null): string {
  switch (key) {
    case "pickup":
      return "Pickup";
    case "dispatched":
      return driverId ? "Dispatched" : "Unassigned";
    case "en_route":
      return "En Route";
    case "arrived":
      return "Arrived";
    case "in_service":
      return "In Service";
    case "collection":
      return collection.requiresResolution ? "Collection ?" : "Collection";
    case "returning":
      return "Returning";
    case "completed":
      return "Completed";
  }
}

function buildMiniSteps(input: {
  stageKey: TripStageKey;
  driverId: string | null;
  collection: CollectionRequirementInfo;
  hasConfirmedPickupArrival: boolean;
  hasConfirmedCustomerArrival: boolean;
  serviceTimer: CrmServiceTimerSummary;
}): TripMiniStep[] {
  const activeIdx =
    input.stageKey === "completed" ? STAGE_ORDER.length : STAGE_ORDER.indexOf(input.stageKey);

  return STAGE_ORDER.map((stepKey, idx) => {
    const meta = SHORT_STEP_LABELS[stepKey];
    const exemptCollection =
      (stepKey === "collection" || stepKey === "returning") &&
      input.collection.decision === "not_required" &&
      input.collection.hasValidApproval;

    let state: TripMiniStep["state"] = "upcoming";
    if (exemptCollection) {
      state = "skipped";
    } else if (
      stepKey === "collection" &&
      input.serviceTimer.isCompleted &&
      input.collection.requiresResolution
    ) {
      state = "attention";
    } else if (idx < activeIdx) {
      state = "completed";
    } else if (idx === activeIdx) {
      state = "current";
    }

    let tooltip = meta.full;
    if (stepKey === "pickup") {
      tooltip = input.hasConfirmedPickupArrival
        ? "Driver arrived at pickup — boarding confirmed separately by staff/driver workflow"
        : "Pickup stage — GPS arrival does not confirm therapist boarding";
    } else if (stepKey === "arrived") {
      tooltip = input.hasConfirmedCustomerArrival
        ? "Driver arrived at customer — service starts separately when therapist confirms"
        : "Customer arrival — GPS arrival does not confirm drop-off or service start";
    } else if (stepKey === "collection") {
      tooltip = exemptCollection
        ? "Independent departure approved — no collection needed"
        : input.collection.requiresResolution
          ? "Collection undecided — CRM resolution needed"
          : "Therapist collection — confirmation separate from driver GPS arrival";
    } else if (stepKey === "returning" && exemptCollection) {
      tooltip = "Independent departure approved — no return trip scheduled";
    }

    return {
      key: stepKey,
      shortLabel: meta.short,
      label: meta.full,
      state,
      tooltip,
    };
  });
}

function buildAuthoritativeTimeline(input: {
  item: RealDispatchItem;
  transportJourney: DispatchJourney | null;
  arrivals: Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>> | null;
  stageKey: TripStageKey;
  serviceTimer: CrmServiceTimerSummary;
  collection: CollectionRequirementInfo;
}): TripTimelineStep[] {
  const { item, transportJourney, arrivals, stageKey, serviceTimer, collection } = input;
  const stageIdx =
    stageKey === "completed" ? STAGE_ORDER.length : STAGE_ORDER.indexOf(stageKey);
  const exemptCollection =
    collection.decision === "not_required" && collection.hasValidApproval;
  const pickupObserved =
    transportJourney?.journey.stage === "pickup_arrived"
      ? transportJourney.journey.observedAt
      : arrivals?.pickup_arrival?.event.observedAt ?? null;
  const customerArrivalIso = item.arrivedAt ?? arrivals?.customer_arrival?.event.observedAt ?? null;
  const collectionArrivalIso =
    transportJourney?.journey.stage === "collection_arrived"
      ? transportJourney.journey.observedAt
      : arrivals?.collection_arrival?.event.observedAt ?? null;
  const completedIso =
    serviceTimer.isCompleted && item.sessionCompletionSource !== "auto_due"
      ? item.sessionCompletedAt ?? item.completedAt
      : null;

  const stepStatus = (
    orderKey: Exclude<TripStageKey, "completed">,
    isDone: boolean
  ): TripTimelineStep["status"] => {
    if (isDone) return "completed";
    if (stageKey === orderKey) return "current";
    return stageIdx > STAGE_ORDER.indexOf(orderKey) ? "completed" : "upcoming";
  };

  return [
    {
      key: "pickup",
      label: pickupObserved ? "Arrived at Pickup" : "Pickup",
      detail: pickupObserved ? "Driver GPS at pickup (boarding separate)" : null,
      timestampIso: pickupObserved,
      status: stepStatus(
        "pickup",
        Boolean(
          pickupObserved ||
            item.travelStartedAt ||
            ["delivery_pending", "delivery_enroute", "customer_arrived", "service_active", "collection_pending", "collection_enroute", "collection_arrived", "return_pending", "return_enroute", "return_arrived", "complete"].includes(
              transportJourney?.journey.stage ?? ""
            )
        )
      ),
      tooltip: "Driver reaching pickup stays separate from confirming therapists boarded.",
    },
    {
      key: "dispatched",
      label: "Dispatched",
      detail: item.driverName ? `Driver ${item.driverName}` : "Awaiting driver assignment",
      timestampIso: null,
      status: item.driverId ? (stageIdx >= 1 ? "completed" : "current") : "attention",
      tooltip: "Driver assignment confirmed in dispatch.",
    },
    {
      key: "en_route",
      label: "En Route",
      detail: item.travelStartedAt ? "Travelling to customer" : null,
      timestampIso: item.travelStartedAt ?? null,
      status: stepStatus("en_route", Boolean(item.arrivedAt || item.sessionStartedAt || serviceTimer.isCompleted)),
      tooltip: "Timestamp recorded when driver confirmed departure.",
    },
    {
      key: "arrived",
      label: "Arrived (Customer)",
      detail: customerArrivalIso ? "Vehicle at customer location (service start separate)" : null,
      timestampIso: customerArrivalIso,
      status: stepStatus("arrived", Boolean(item.sessionStartedAt || serviceTimer.isCompleted)),
      tooltip: "Arrival at customer does not automatically mark therapist exited or started service.",
    },
    {
      key: "in_service",
      label: "In Service",
      detail: serviceTimer.label,
      timestampIso: item.sessionStartedAt ?? null,
      status: stepStatus("in_service", serviceTimer.isCompleted),
      tooltip: "Started and completed exclusively by Staff Portal therapist events.",
    },
    {
      key: "collection",
      label: exemptCollection
        ? "Independent Departure Approved"
        : collection.requiresResolution
          ? "Collection Decision Needed"
          : collectionArrivalIso
            ? "Arrived for Collection"
            : "Ready for Collection",
      detail: exemptCollection
        ? "No company collection required"
        : collection.label,
      timestampIso: exemptCollection
        ? collection.approvedAt
        : collectionArrivalIso ?? completedIso,
      status: exemptCollection
        ? "skipped"
        : collection.requiresResolution && serviceTimer.isCompleted
          ? "attention"
          : stepStatus("collection", stageIdx > STAGE_ORDER.indexOf("collection") || collection.collectionConfirmed),
      tooltip: exemptCollection
        ? "Therapist authorized to depart independently after appointment."
        : "Collection driver arrival is tracked separately from actual therapist collection confirmation.",
    },
    {
      key: "returning",
      label: exemptCollection ? "Return Not Required" : "Returning",
      detail: exemptCollection
        ? "Skipped — independent departure approved"
        : stageKey === "returning"
          ? "Therapist collected — returning / onward leg"
          : null,
      timestampIso: null,
      status: exemptCollection
        ? "skipped"
        : stepStatus("returning", stageKey === "completed"),
      tooltip: "Return leg is not assumed unless collection/return is required.",
    },
    {
      key: "completed",
      label: "Completed",
      detail: serviceTimer.isCompleted ? "Confirmed service completion" : null,
      timestampIso: completedIso,
      status: stageKey === "completed" ? "completed" : "upcoming",
      tooltip: "Journey complete once service and required transport conclude.",
    },
  ];
}

/**
 * Projects Dispatch items + DriverTracks into trip cards, filter counts, and
 * authoritative journey timelines for the map-first dispatch UI.
 */
export function buildLiveMapTripsViewModel(input: {
  items: RealDispatchItem[];
  transportJourneys?: DispatchJourney[];
  drivers: DriverTrack[];
  arrivalsByBooking?: ReadonlyMap<string, Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>>>;
  connectionState?: RealtimeConnectionState;
  nowMs?: number;
}): {
  trips: LiveMapTripItem[];
  counts: TripFilterCounts;
} {
  const nowMs = input.nowMs ?? Date.now();
  const journeyByBookingId = new Map(
    (input.transportJourneys ?? []).map((entry) => [entry.journey.bookingId, entry])
  );
  const driverTrackById = new Map<string, DriverTrack>();
  for (const track of input.drivers) {
    if (track.driverId) driverTrackById.set(track.driverId, track);
  }

  const trips: LiveMapTripItem[] = [];

  for (const item of input.items) {
    if (["cancelled", "no_show", "expired"].includes(item.bookingStatus)) continue;
    if (item.bookingProgressStatus === "no_show") continue;

    const journey = journeyByBookingId.get(item.id) ?? null;
    const collection = parseCollectionRequirement({
      rawRequirement: item.collectionRequirement,
      transportJourney: journey,
    });
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

    const arrivals = input.arrivalsByBooking?.get(item.id) ?? null;
    const detailedPresentation = presentCrmJourneyStatus({
      bookingStatus: item.bookingStatus,
      bookingProgressStatus: item.bookingProgressStatus,
      driverId: effectiveDriverId,
      transportJourney: journey,
      arrivals,
      serviceTimer,
      collection,
    });

    const stageKey = resolveStageKey({
      bookingStatus: item.bookingStatus,
      bookingProgressStatus: item.bookingProgressStatus,
      driverId: effectiveDriverId,
      transportJourney: journey,
      arrivals,
      serviceTimer,
      collection,
    });

    const driverTrack = effectiveDriverId ? driverTrackById.get(effectiveDriverId) ?? null : null;
    const rawLocation: DriverGpsSnapshot | null = driverTrack?.location ??
      (item.currentLocation
        ? mergeMonotonicGpsLocation(null, {
            lat: item.currentLocation.lat,
            lng: item.currentLocation.lng,
            recordedAt: item.currentLocation.recorded_at,
            accuracyMeters: item.currentLocation.accuracyMeters ?? null,
            source: item.currentLocation.source ?? null,
            staffId: item.currentLocation.staffId ?? effectiveDriverId,
          })
        : null);

    const driverReliability =
      driverTrack?.reliability ??
      classifyDriverLocation(rawLocation, {
        nowMs,
        connectionState: input.connectionState,
      });

    const hasConfirmedPickupArrival = Boolean(
      arrivals?.pickup_arrival ||
        journey?.journey.stage === "pickup_arrived" ||
        Boolean(item.travelStartedAt)
    );
    const hasConfirmedCustomerArrival = Boolean(
      arrivals?.customer_arrival ||
        journey?.journey.stage === "customer_arrived" ||
        Boolean(item.arrivedAt) ||
        item.bookingProgressStatus === "arrived"
    );
    const hasConfirmedCollectionArrival = Boolean(
      arrivals?.collection_arrival || journey?.journey.stage === "collection_arrived"
    );

    const hasCustomerGps =
      !item.needsLocationReview &&
      item.lat !== null &&
      item.lng !== null &&
      isValidGeoPoint({ lat: item.lat, lng: item.lng });

    trips.push({
      bookingId: item.id,
      bookingNumber: item.number,
      customerName: item.customerName,
      serviceName: item.serviceName,
      locationSummary: item.area ?? item.formattedAddress ?? "Location needs confirmation",
      scheduledDate: item.bookingDate,
      startTime: item.startTime,
      endTime: item.endTime,
      driverId: effectiveDriverId,
      driverName: effectiveDriverName,
      driverReliability,
      therapistId: item.therapistId,
      therapistName: item.therapistName ?? journey?.journey.therapistName ?? null,
      stageKey,
      stageBadgeLabel: stageBadgeForKey(stageKey, collection, effectiveDriverId),
      detailedStatusLabel: detailedPresentation.statusLabel,
      miniSteps: buildMiniSteps({
        stageKey,
        driverId: effectiveDriverId,
        collection,
        hasConfirmedPickupArrival,
        hasConfirmedCustomerArrival,
        serviceTimer,
      }),
      timeline: buildAuthoritativeTimeline({
        item,
        transportJourney: journey,
        arrivals,
        stageKey,
        serviceTimer,
        collection,
      }),
      etaMinutes: driverTrack?.etaMinutes ?? item.eta?.minutes ?? item.etaMinutes ?? null,
      estimatedArrivalIso: driverTrack?.estimatedArrivalIso ?? null,
      distanceMeters: driverTrack?.distanceMeters ?? null,
      serviceTimer,
      collection,
      lat: item.lat,
      lng: item.lng,
      hasCustomerGps,
      needsLocationReview: item.needsLocationReview,
      hasConfirmedPickupArrival,
      hasConfirmedCustomerArrival,
      hasConfirmedCollectionArrival,
      sharedDriverTripCount: driverTrack?.stops.length ?? (effectiveDriverId ? 1 : 0),
    });
  }

  // Include active enrolled transportJourneys omitted from open booking items (e.g. completed service pending collection)
  const seenIds = new Set(trips.map((t) => t.bookingId));
  for (const journeyEntry of input.transportJourneys ?? []) {
    const j = journeyEntry.journey;
    if (seenIds.has(j.bookingId) || j.stage === "complete") continue;
    const collection = parseCollectionRequirement({ transportJourney: journeyEntry });
    const serviceTimer = computeCrmServiceTimerSummary({
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      nowMs,
    });
    const arrivals = input.arrivalsByBooking?.get(j.bookingId) ?? null;
    const driverTrack = input.drivers.find((d) =>
      d.stops.some((stop) => stop.bookingId === j.bookingId)
    );
    const stageKey = resolveStageKey({
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      driverId: driverTrack?.driverId ?? null,
      transportJourney: journeyEntry,
      arrivals,
      serviceTimer,
      collection,
    });
    const detailedPresentation = presentCrmJourneyStatus({
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      driverId: driverTrack?.driverId ?? null,
      transportJourney: journeyEntry,
      arrivals,
      serviceTimer,
      collection,
    });

    const fallbackItem = {
      id: j.bookingId,
      number: j.bookingId.slice(0, 6).toUpperCase(),
      bookingDate: j.bookingDate ?? "",
      startTime: j.startTime ?? "00:00:00",
      endTime: j.startTime ?? "00:00:00",
      customerName: j.customerName ?? "Home Service",
      serviceName: "Therapist Collection",
      area: j.destination?.label ?? null,
      formattedAddress: j.customerAddress ?? null,
      lat: j.destination?.lat ?? null,
      lng: j.destination?.lng ?? null,
      branchName: j.branchName ?? null,
      branchLat: null,
      branchLng: null,
      needsLocationReview: !j.destination,
      driverId: driverTrack?.driverId ?? null,
      driverName: journeyEntry.driverName ?? driverTrack?.driverName ?? null,
      therapistId: "",
      therapistName: j.therapistName ?? null,
      dispatchStatus: "completed" as const,
      bookingStatus: "completed",
      bookingProgressStatus: "completed",
      paymentStatus: "paid",
      etaMinutes: null,
      travelStartedAt: null,
      arrivedAt: null,
      sessionStartedAt: null,
      completedAt: j.observedAt,
      rating: null,
      currentLocation: null,
    };

    trips.push({
      bookingId: j.bookingId,
      bookingNumber: fallbackItem.number,
      customerName: fallbackItem.customerName,
      serviceName: fallbackItem.serviceName,
      locationSummary: j.destination?.label ?? j.customerAddress ?? "Collection location",
      scheduledDate: fallbackItem.bookingDate,
      startTime: fallbackItem.startTime,
      endTime: fallbackItem.endTime,
      driverId: driverTrack?.driverId ?? null,
      driverName: journeyEntry.driverName ?? driverTrack?.driverName ?? null,
      driverReliability:
        driverTrack?.reliability ??
        classifyDriverLocation(
          journeyEntry.location
            ? {
                lat: journeyEntry.location.lat,
                lng: journeyEntry.location.lng,
                recordedAt: journeyEntry.location.recordedAt,
              }
            : null,
          { nowMs, connectionState: input.connectionState }
        ),
      therapistId: "",
      therapistName: j.therapistName ?? null,
      stageKey,
      stageBadgeLabel: stageBadgeForKey(stageKey, collection, driverTrack?.driverId ?? null),
      detailedStatusLabel: detailedPresentation.statusLabel,
      miniSteps: buildMiniSteps({
        stageKey,
        driverId: driverTrack?.driverId ?? null,
        collection,
        hasConfirmedPickupArrival: true,
        hasConfirmedCustomerArrival: true,
        serviceTimer,
      }),
      timeline: buildAuthoritativeTimeline({
        item: fallbackItem,
        transportJourney: journeyEntry,
        arrivals,
        stageKey,
        serviceTimer,
        collection,
      }),
      etaMinutes: driverTrack?.etaMinutes ?? null,
      estimatedArrivalIso: driverTrack?.estimatedArrivalIso ?? null,
      distanceMeters: driverTrack?.distanceMeters ?? null,
      serviceTimer,
      collection,
      lat: j.destination?.lat ?? null,
      lng: j.destination?.lng ?? null,
      hasCustomerGps: Boolean(j.destination && isValidGeoPoint(j.destination)),
      needsLocationReview: !j.destination,
      hasConfirmedPickupArrival: true,
      hasConfirmedCustomerArrival: true,
      hasConfirmedCollectionArrival: j.stage === "collection_arrived",
      sharedDriverTripCount: driverTrack?.stops.length ?? 1,
    });
  }

  trips.sort((a, b) =>
    `${a.scheduledDate}T${a.startTime}:${a.bookingNumber}`.localeCompare(
      `${b.scheduledDate}T${b.startTime}:${b.bookingNumber}`
    )
  );

  const counts: TripFilterCounts = {
    all: trips.length,
    pickup: 0,
    dispatched: 0,
    en_route: 0,
    arrived: 0,
    in_service: 0,
    collection: 0,
    returning: 0,
  };

  for (const trip of trips) {
    if (trip.stageKey !== "completed") {
      counts[trip.stageKey] += 1;
    }
  }

  return { trips, counts };
}
