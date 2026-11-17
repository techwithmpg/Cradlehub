import { z } from "zod";
import type { DispatchJourney } from "@/lib/driver/dispatch";
import type { DispatchData, RealDispatchItem } from "@/lib/queries/dispatch-queries";

export const CRM_ARRIVAL_MAX_ACCURACY_METERS = 100;

export const crmArrivalEventKinds = [
  "pickup_arrival",
  "customer_arrival",
  "collection_arrival",
  "collection_ready",
] as const;

export type CrmArrivalEventKind = (typeof crmArrivalEventKinds)[number];

export const crmArrivalEventSources = [
  "server_journey_transition",
  "server_booking_arrived",
  "server_service_completion",
  "synthetic_test_event",
] as const;

export type CrmArrivalEventSource = (typeof crmArrivalEventSources)[number];

export const crmArrivalEventSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  source: z.enum(crmArrivalEventSources),
  authorizedByServer: z.literal(true),
  branchId: z.string().trim().min(1).max(120),
  driverId: z.string().trim().min(1).max(120).nullable(),
  driverName: z.string().trim().min(1).max(160).nullable(),
  bookingId: z.string().trim().min(1).max(120),
  journeyId: z.string().trim().min(1).max(120).nullable().optional(),
  legId: z.string().trim().min(1).max(120).nullable().optional(),
  stopId: z.string().trim().min(1).max(120).nullable().optional(),
  destinationLabel: z.string().trim().min(1).max(200),
  customerName: z.string().trim().min(1).max(160).nullable().optional(),
  therapistIds: z.array(z.string().trim().min(1).max(120)).default([]),
  therapistNames: z.array(z.string().trim().min(1).max(160)).default([]),
  accuracyMeters: z.number().finite().positive().max(10_000).nullable().optional(),
  distanceMeters: z.number().finite().nonnegative().nullable().optional(),
  observedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), {
    message: "observedAt must be a valid ISO timestamp.",
  }),
  revision: z.number().int().nonnegative().nullable().optional(),
});

export type CrmArrivalEvent = z.infer<typeof crmArrivalEventSchema>;

export interface ArrivalCollectionContext {
  decision: "required" | "not_required" | "undecided";
  hasValidApproval: boolean;
  collectionDriverId?: string | null;
}

export interface ArrivalValidationBookingContext {
  id: string;
  branchId?: string | null;
  driverId: string | null;
  bookingStatus: string;
  bookingProgressStatus: string;
  sessionCompletedAt?: string | null;
  sessionCompletionSource?: string | null;
  collection?: ArrivalCollectionContext | null;
}

export interface ArrivalValidationContext {
  expectedBranchId: string;
  bookingsById: ReadonlyMap<string, ArrivalValidationBookingContext>;
  journeysByBookingId?: ReadonlyMap<string, DispatchJourney>;
  nowMs?: number;
}

export type ArrivalRejectionReason =
  | "invalid_payload"
  | "untrusted_source"
  | "branch_mismatch"
  | "booking_not_found"
  | "terminal_booking"
  | "driver_required"
  | "driver_assignment_mismatch"
  | "poor_accuracy"
  | "invalid_timestamp"
  | "collection_not_required"
  | "auto_due_not_confirmed"
  | "journey_in_review";

export type ArrivalValidationResult =
  | { ok: true; event: CrmArrivalEvent; semanticKey: string }
  | { ok: false; reason: ArrivalRejectionReason; message: string };

export interface ArrivalNotificationCopy {
  title: string;
  body: string;
  statusLabel:
    | "Arrived at pickup"
    | "Arrived at customer"
    | "Arrived for collection"
    | "Ready for collection";
}

export interface NormalizedCrmArrivalEvent extends CrmArrivalEvent {
  kind: CrmArrivalEventKind;
}

const fullArrivalInputSchema = crmArrivalEventSchema.extend({
  kind: z.enum(crmArrivalEventKinds),
});

export type CrmArrivalEventInput = z.input<typeof fullArrivalInputSchema>;

export function semanticKeyForArrival(event: Pick<NormalizedCrmArrivalEvent, "branchId" | "bookingId" | "kind" | "stopId" | "legId" | "driverId" | "revision">): string {
  const stopKey = event.stopId?.trim() || event.legId?.trim() || event.bookingId;
  const driverKey = event.driverId?.trim() || "unassigned";
  const revKey =
    typeof event.revision === "number" && Number.isFinite(event.revision)
      ? `r${event.revision}`
      : "r0";
  return `${event.branchId}:${event.bookingId}:${event.kind}:${stopKey}:${driverKey}:${revKey}`;
}

export function formatArrivalNotificationCopy(
  event: Pick<
    NormalizedCrmArrivalEvent,
    "kind" | "driverName" | "destinationLabel" | "customerName" | "therapistNames"
  >
): ArrivalNotificationCopy {
  const driver = event.driverName?.trim() || "Assigned driver";
  const therapists =
    event.therapistNames.length > 0
      ? event.therapistNames.join(", ")
      : "assigned therapist";

  switch (event.kind) {
    case "pickup_arrival":
      return {
        statusLabel: "Arrived at pickup",
        title: "Arrived at pickup",
        body: `Driver ${driver} arrived at ${event.destinationLabel} to pick up ${therapists}.`,
      };
    case "customer_arrival": {
      const customer = event.customerName?.trim() || event.destinationLabel;
      return {
        statusLabel: "Arrived at customer",
        title: "Arrived at customer",
        body: `Driver ${driver} arrived at ${customer}'s location with ${therapists}.`,
      };
    }
    case "collection_arrival":
      return {
        statusLabel: "Arrived for collection",
        title: "Arrived for collection",
        body: `Driver ${driver} arrived to collect ${therapists}.`,
      };
    case "collection_ready":
      return {
        statusLabel: "Ready for collection",
        title: "Ready for collection",
        body: `${therapists} completed service and is ready for collection.`,
      };
  }
}

/**
 * Validates that an arrival/readiness event came from a server-accepted or
 * isolated synthetic contract and strictly matches branch, booking, driver,
 * and evidence guards. Client-only GPS coords cannot pass this gate.
 */
export function validateArrivalEvent(
  rawInput: unknown,
  context: ArrivalValidationContext
):
  | { ok: true; event: NormalizedCrmArrivalEvent; semanticKey: string }
  | { ok: false; reason: ArrivalRejectionReason; message: string } {
  if (rawInput && typeof rawInput === "object") {
    const obj = rawInput as Record<string, unknown>;
    if (obj.authorizedByServer !== true || obj.source === "client_gps") {
      return {
        ok: false,
        reason: "untrusted_source",
        message: "Arrival notifications require a server-validated event.",
      };
    }
  }

  const parsed = fullArrivalInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_payload",
      message: parsed.error.issues[0]?.message ?? "Invalid arrival event payload.",
    };
  }

  const event: NormalizedCrmArrivalEvent = parsed.data;
  if (event.branchId !== context.expectedBranchId) {
    return {
      ok: false,
      reason: "branch_mismatch",
      message: "Arrival event belongs to a different branch.",
    };
  }

  const nowMs = context.nowMs ?? Date.now();
  const observedMs = Date.parse(event.observedAt);
  if (!Number.isFinite(observedMs) || observedMs - nowMs > 60_000) {
    return {
      ok: false,
      reason: "invalid_timestamp",
      message: "Arrival timestamp is invalid or in the future.",
    };
  }

  const booking = context.bookingsById.get(event.bookingId);
  const journey = context.journeysByBookingId?.get(event.bookingId);
  if (!booking && !journey) {
    return {
      ok: false,
      reason: "booking_not_found",
      message: "Booking is not in the authorized CRM dispatch set.",
    };
  }

  if (booking?.branchId && booking.branchId !== context.expectedBranchId) {
    return {
      ok: false,
      reason: "branch_mismatch",
      message: "Booking belongs to another branch.",
    };
  }

  if (booking && ["cancelled", "no_show", "expired"].includes(booking.bookingStatus)) {
    return {
      ok: false,
      reason: "terminal_booking",
      message: "Cancelled or inactive bookings cannot trigger arrival events.",
    };
  }

  if (booking?.bookingProgressStatus === "no_show") {
    return {
      ok: false,
      reason: "terminal_booking",
      message: "Inactive booking cannot trigger arrival events.",
    };
  }

  if (journey?.journey.stage === "review") {
    return {
      ok: false,
      reason: "journey_in_review",
      message: "Journey is flagged for review pending reassignment.",
    };
  }

  if (event.kind === "collection_ready") {
    const isCompleted =
      booking?.bookingStatus === "completed" ||
      booking?.bookingProgressStatus === "completed" ||
      Boolean(booking?.sessionCompletedAt) ||
      journey?.journey.stage === "collection_pending";

    if (!isCompleted || booking?.sessionCompletionSource === "auto_due") {
      return {
        ok: false,
        reason: "auto_due_not_confirmed",
        message: "Therapist service completion has not been authoritatively confirmed.",
      };
    }

    if (
      booking?.collection?.decision === "not_required" &&
      booking.collection.hasValidApproval
    ) {
      return {
        ok: false,
        reason: "collection_not_required",
        message: "Therapist is approved for independent departure; no collection alert sent.",
      };
    }
  } else {
    if (!event.driverId) {
      return {
        ok: false,
        reason: "driver_required",
        message: "Arrival event requires an assigned driver identity.",
      };
    }

    const expectedDriverId =
      event.kind === "collection_arrival"
        ? (booking?.collection?.collectionDriverId ?? booking?.driverId ?? null)
        : (booking?.driverId ?? null);

    if (expectedDriverId && event.driverId !== expectedDriverId) {
      return {
        ok: false,
        reason: "driver_assignment_mismatch",
        message: "Arrival driver does not match the assigned driver for this journey.",
      };
    }

    if (
      event.accuracyMeters !== null &&
      event.accuracyMeters !== undefined &&
      event.accuracyMeters > CRM_ARRIVAL_MAX_ACCURACY_METERS
    ) {
      return {
        ok: false,
        reason: "poor_accuracy",
        message: `GPS accuracy (±${Math.round(event.accuracyMeters)}m) is too imprecise for arrival confirmation.`,
      };
    }
  }

  return {
    ok: true,
    event,
    semanticKey: semanticKeyForArrival(event),
  };
}

export interface AcceptedArrivalRecord {
  event: NormalizedCrmArrivalEvent;
  semanticKey: string;
  copy: ArrivalNotificationCopy;
}

/**
 * Stateful arrival event deduplicator & state tracker.
 * Prevents duplicate popups on replayed events or realtime reconnects while
 * retaining the latest accepted arrival state per booking & stop.
 */
export class ArrivalDeduplicationStore {
  private readonly seenEventIds = new Set<string>();
  private readonly seenSemanticKeys = new Set<string>();
  private readonly latestByBooking = new Map<string, Map<CrmArrivalEventKind, AcceptedArrivalRecord>>();
  private readonly history: AcceptedArrivalRecord[] = [];

  seedSilent(event: NormalizedCrmArrivalEvent): void {
    const key = semanticKeyForArrival(event);
    this.seenEventIds.add(event.eventId);
    this.seenSemanticKeys.add(key);
    this.recordByBooking(event, key);
  }

  accept(
    rawInput: unknown,
    context: ArrivalValidationContext,
    options?: { silent?: boolean }
  ):
    | {
        accepted: true;
        duplicate: boolean;
        shouldNotify: boolean;
        record: AcceptedArrivalRecord;
      }
    | { accepted: false; reason: ArrivalRejectionReason; message: string } {
    const validated = validateArrivalEvent(rawInput, context);
    if (!validated.ok) {
      return { accepted: false, reason: validated.reason, message: validated.message };
    }

    const { event, semanticKey } = validated;
    const isDuplicate =
      this.seenEventIds.has(event.eventId) || this.seenSemanticKeys.has(semanticKey);

    this.seenEventIds.add(event.eventId);
    this.seenSemanticKeys.add(semanticKey);
    const record = this.recordByBooking(event, semanticKey);

    if (!isDuplicate) {
      this.history.unshift(record);
      if (this.history.length > 50) this.history.length = 50;
    }

    return {
      accepted: true,
      duplicate: isDuplicate,
      shouldNotify: !isDuplicate && !options?.silent,
      record,
    };
  }

  getLatestForBooking(
    bookingId: string
  ): Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>> | null {
    const map = this.latestByBooking.get(bookingId);
    if (!map) return null;
    const out: Partial<Record<CrmArrivalEventKind, AcceptedArrivalRecord>> = {};
    for (const [kind, record] of map.entries()) {
      out[kind] = record;
    }
    return out;
  }

  getRecentFeed(): AcceptedArrivalRecord[] {
    return [...this.history];
  }

  clearForBooking(bookingId: string): void {
    this.latestByBooking.delete(bookingId);
  }

  private recordByBooking(
    event: NormalizedCrmArrivalEvent,
    semanticKey: string
  ): AcceptedArrivalRecord {
    const record: AcceptedArrivalRecord = {
      event,
      semanticKey,
      copy: formatArrivalNotificationCopy(event),
    };
    let map = this.latestByBooking.get(event.bookingId);
    if (!map) {
      map = new Map();
      this.latestByBooking.set(event.bookingId, map);
    }
    map.set(event.kind, record);
    return record;
  }
}

function bookingTherapistNames(item: RealDispatchItem, journey?: DispatchJourney): string[] {
  const name = item.therapistName?.trim() || journey?.journey.therapistName?.trim() || null;
  return name ? [name] : [];
}

function itemDestinationLabel(item: RealDispatchItem, journey?: DispatchJourney): string {
  return (
    journey?.journey.destination?.label ||
    item.area ||
    item.formattedAddress ||
    item.customerName ||
    "Destination"
  );
}

/**
 * Compares previous vs next authoritative DispatchData snapshots to extract
 * newly occurred server arrival / collection-ready transitions cleanly.
 * Never triggers notifications for initial mount baseline (`previousData === null`).
 */
export function deriveAuthoritativeTransitionEvents(input: {
  branchId: string;
  previousData: DispatchData | null;
  nextData: DispatchData;
}): NormalizedCrmArrivalEvent[] {
  const events: NormalizedCrmArrivalEvent[] = [];
  const { branchId, previousData, nextData } = input;
  if (!previousData) return events;

  const prevItemsById = new Map(previousData.items.map((item) => [item.id, item]));
  const prevJourneysById = new Map(
    (previousData.transportJourneys ?? []).map((entry) => [entry.journey.bookingId, entry])
  );
  const nextJourneysById = new Map(
    (nextData.transportJourneys ?? []).map((entry) => [entry.journey.bookingId, entry])
  );

  for (const item of nextData.items) {
    if (["cancelled", "no_show", "expired"].includes(item.bookingStatus)) continue;
    const prev = prevItemsById.get(item.id);
    const journey = nextJourneysById.get(item.id);
    const prevJourney = prevJourneysById.get(item.id);

    // Booking progress transitioned cleanly from travel/pre-arrival to arrived
    const transitionedToArrived =
      item.bookingProgressStatus === "arrived" &&
      prev &&
      prev.bookingProgressStatus !== "arrived" &&
      !journey?.journey.stage;

    if (transitionedToArrived && item.driverId) {
      events.push({
        eventId: `booking:${item.id}:customer_arrival:${item.arrivedAt ?? "arrived"}`,
        kind: "customer_arrival",
        source: "server_booking_arrived",
        authorizedByServer: true,
        branchId,
        driverId: item.driverId,
        driverName: item.driverName,
        bookingId: item.id,
        destinationLabel: itemDestinationLabel(item, journey),
        customerName: item.customerName,
        therapistIds: item.therapistId ? [item.therapistId] : [],
        therapistNames: bookingTherapistNames(item, journey),
        observedAt: item.arrivedAt ?? new Date().toISOString(),
        revision: 1,
      });
    }

    // Legacy booking completed without auto_due when collection is explicitly required
    const transitionedToCompleted =
      item.bookingProgressStatus === "completed" &&
      item.sessionCompletionSource !== "auto_due" &&
      prev &&
      prev.bookingProgressStatus !== "completed" &&
      !journey;

    const req = item.collectionRequirement;
    if (
      transitionedToCompleted &&
      req &&
      req.decision === "required"
    ) {
      events.push({
        eventId: `booking:${item.id}:collection_ready:${item.sessionCompletedAt ?? item.completedAt ?? "done"}`,
        kind: "collection_ready",
        source: "server_service_completion",
        authorizedByServer: true,
        branchId,
        driverId: req.collectionDriverId ?? item.driverId,
        driverName: req.collectionDriverName ?? item.driverName,
        bookingId: item.id,
        destinationLabel: itemDestinationLabel(item, journey),
        customerName: item.customerName,
        therapistIds: item.therapistId ? [item.therapistId] : [],
        therapistNames: bookingTherapistNames(item, journey),
        observedAt: item.sessionCompletedAt ?? item.completedAt ?? new Date().toISOString(),
        revision: 1,
      });
    }

    // Enrolled unified journey stage transitions
    if (journey && prevJourney && journey.journey.stage !== prevJourney.journey.stage) {
      const stage = journey.journey.stage;
      const stageKind: CrmArrivalEventKind | null =
        stage === "pickup_arrived"
          ? "pickup_arrival"
          : stage === "customer_arrived"
            ? "customer_arrival"
            : stage === "collection_arrived"
              ? "collection_arrival"
              : stage === "collection_pending"
                ? "collection_ready"
                : null;
      if (stageKind) {
        events.push({
          eventId: `journey:${item.id}:${stage}:r${journey.journey.revision}`,
          kind: stageKind,
          source:
            stageKind === "collection_ready"
              ? "server_service_completion"
              : "server_journey_transition",
          authorizedByServer: true,
          branchId,
          driverId: item.driverId,
          driverName: journey.driverName ?? item.driverName,
          bookingId: item.id,
          journeyId: item.id,
          legId: journey.journey.leg ?? undefined,
          destinationLabel: itemDestinationLabel(item, journey),
          customerName: journey.journey.customerName ?? item.customerName,
          therapistIds: item.therapistId ? [item.therapistId] : [],
          therapistNames: bookingTherapistNames(item, journey),
          observedAt: journey.journey.observedAt,
          revision: journey.journey.revision,
        });
      }
    }
  }

  // Also check transportJourneys whose booking is already service-completed and omitted from open items
  const itemsById = new Map(nextData.items.map((item) => [item.id, item]));
  for (const journey of nextData.transportJourneys ?? []) {
    if (itemsById.has(journey.journey.bookingId)) continue;
    const prevJourney = prevJourneysById.get(journey.journey.bookingId);
    if (!prevJourney || prevJourney.journey.stage === journey.journey.stage) continue;

    const stage = journey.journey.stage;
    const stageKind: CrmArrivalEventKind | null =
      stage === "collection_arrived"
        ? "collection_arrival"
        : stage === "collection_pending"
          ? "collection_ready"
          : null;
    if (stageKind) {
      events.push({
        eventId: `journey:${journey.journey.bookingId}:${stage}:r${journey.journey.revision}`,
        kind: stageKind,
        source:
          stageKind === "collection_ready"
            ? "server_service_completion"
            : "server_journey_transition",
        authorizedByServer: true,
        branchId,
        driverId: null,
        driverName: journey.driverName,
        bookingId: journey.journey.bookingId,
        journeyId: journey.journey.bookingId,
        legId: journey.journey.leg ?? undefined,
        destinationLabel:
          journey.journey.destination?.label ??
          journey.journey.customerAddress ??
          "Therapist location",
        customerName: journey.journey.customerName ?? null,
        therapistIds: [],
        therapistNames: journey.journey.therapistName ? [journey.journey.therapistName] : [],
        observedAt: journey.journey.observedAt,
        revision: journey.journey.revision,
      });
    }
  }

  return events;
}
