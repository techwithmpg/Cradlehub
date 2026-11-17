import { z } from "zod";
import type { DriverJourney } from "./journey";

export const tripServiceReadinessSchema = z.enum([
  "UNKNOWN",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const tripCollectionNeedSchema = z.enum(["REQUIRED", "NOT_REQUIRED", "UNDECIDED"]);

export const tripPassengerSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(160),
  service: tripServiceReadinessSchema,
  estimatedCompletion: z.string().nullable().optional(),
  collection: tripCollectionNeedSchema,
  boarded: z.boolean(),
  dropped: z.boolean(),
});

export const tripStopSchema = z.object({
  id: z.string().min(1),
  bookingId: z.guid(),
  bookingIds: z.array(z.guid()).optional(),
  role: z.enum(["BRANCH_PICKUP", "CUSTOMER_DROP", "THERAPIST_COLLECTION", "DESTINATION"]),
  label: z.string().max(200),
  passengers: z.array(z.string().min(1)),
  progress: z.enum(["PENDING", "ENROUTE", "ARRIVED", "CONFIRMED"]),
  lat: z.number().finite().min(-90).max(90).nullable(),
  lng: z.number().finite().min(-180).max(180).nullable(),
});

export const driverTripPlanSchema = z.object({
  id: z.string().min(1),
  driverId: z.string().min(1),
  mode: z.enum(["DROP_OFF", "PICK_UP"]),
  scheduled: z.string().max(64),
  origin: z.string().max(200),
  destination: z.string().max(200),
  passengers: z.array(tripPassengerSchema),
  stops: z.array(tripStopSchema),
  stage: z.string().max(64),
  routeAuthorized: z.boolean(),
  revision: z.number().int().nonnegative(),
  vehicleJourneyId: z.guid().nullable().optional(),
});

export type DriverTripPlan = z.infer<typeof driverTripPlanSchema>;

function toServiceReadiness(j: DriverJourney): z.infer<typeof tripServiceReadinessSchema> {
  if (
    j.bookingProgressStatus === "completed" ||
    j.bookingStatus === "completed" ||
    Boolean(j.sessionCompletedAt) ||
    j.stage.startsWith("collection_") ||
    j.stage.startsWith("return_") ||
    j.stage === "complete"
  ) {
    return "COMPLETED";
  }
  if (
    j.bookingProgressStatus === "session_started" ||
    j.bookingStatus === "in_progress" ||
    j.stage === "service_active"
  ) {
    return "IN_PROGRESS";
  }
  return "UNKNOWN";
}

function toCollectionNeed(j: DriverJourney): z.infer<typeof tripCollectionNeedSchema> {
  if (j.collectionDecision === "not_required") return "NOT_REQUIRED";
  if (j.collectionDecision === "required") return "REQUIRED";
  if (j.stage.startsWith("collection_") || j.stage.startsWith("return_")) return "REQUIRED";
  return "UNDECIDED";
}

function stopProgressForStage(
  stage: DriverJourney["stage"],
  targetRole: "BRANCH_PICKUP" | "CUSTOMER_DROP" | "THERAPIST_COLLECTION" | "DESTINATION"
): "PENDING" | "ENROUTE" | "ARRIVED" | "CONFIRMED" {
  if (targetRole === "BRANCH_PICKUP") {
    if (stage === "pickup_pending") return "PENDING";
    if (stage === "pickup_enroute") return "ENROUTE";
    if (stage === "pickup_arrived") return "ARRIVED";
    return "CONFIRMED";
  }
  if (targetRole === "CUSTOMER_DROP") {
    if (["pickup_pending", "pickup_enroute", "pickup_arrived", "delivery_pending"].includes(stage)) {
      return "PENDING";
    }
    if (stage === "delivery_enroute") return "ENROUTE";
    if (stage === "customer_arrived") return "ARRIVED";
    if (stage === "service_active" || stage.startsWith("collection_") || stage.startsWith("return_") || stage === "complete") {
      return "CONFIRMED";
    }
    return "PENDING";
  }
  if (targetRole === "THERAPIST_COLLECTION") {
    if (stage === "collection_pending") return "PENDING";
    if (stage === "collection_enroute") return "ENROUTE";
    if (stage === "collection_arrived") return "ARRIVED";
    if (stage.startsWith("return_") || stage === "complete") return "CONFIRMED";
    return "PENDING";
  }
  // DESTINATION (return leg)
  if (stage === "return_enroute") return "ENROUTE";
  if (stage === "return_arrived") return "ARRIVED";
  if (stage === "complete") return "CONFIRMED";
  return "PENDING";
}

function isCollectionPhase(j: DriverJourney, currentDriverId?: string): boolean {
  if (j.stage.startsWith("collection_") || j.stage.startsWith("return_")) return true;
  if (
    currentDriverId &&
    j.collectionDriverId === currentDriverId &&
    j.deliveryDriverId &&
    j.deliveryDriverId !== currentDriverId &&
    j.collectionDecision !== "not_required"
  ) {
    return true;
  }
  return false;
}

function formatScheduledLabel(j: DriverJourney): string {
  const time = j.startTime ? j.startTime.slice(0, 5) : "";
  if (j.bookingDate && time) return `${j.bookingDate} ${time}`;
  return j.bookingDate ?? time ?? "Scheduled";
}

/**
 * Projects backend driver journey snapshots into Android O3 `TripsJourney` plans,
 * preserving pooled stop ordering (`vehicleJourneyId`), split delivery/collection
 * ownership, authoritative service countdowns, and conditional collection states.
 */
export function buildDriverTripPlans(
  journeys: DriverJourney[],
  currentDriverId?: string
): DriverTripPlan[] {
  const active = journeys.filter((j) => j.stage !== "complete");
  if (active.length === 0) return [];

  const groups = new Map<string, { mode: "DROP_OFF" | "PICK_UP"; items: DriverJourney[] }>();

  for (const j of active) {
    const mode: "DROP_OFF" | "PICK_UP" = isCollectionPhase(j, currentDriverId)
      ? "PICK_UP"
      : "DROP_OFF";
    const key = j.vehicleJourneyId ? `${mode}:${j.vehicleJourneyId}` : `${mode}:${j.bookingId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(j);
    } else {
      groups.set(key, { mode, items: [j] });
    }
  }

  const plans: DriverTripPlan[] = [];

  for (const [key, group] of groups) {
    const ordered = [...group.items].sort(
      (a, b) =>
        (a.stopOrder ?? Number.MAX_SAFE_INTEGER) - (b.stopOrder ?? Number.MAX_SAFE_INTEGER) ||
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.bookingId.localeCompare(b.bookingId)
    );
    const lead = ordered[0]!;
    const effectiveDriverId =
      currentDriverId ??
      (group.mode === "PICK_UP" ? lead.collectionDriverId : lead.deliveryDriverId) ??
      lead.activeDriverId ??
      "assigned-driver";

    const passengers: Array<z.infer<typeof tripPassengerSchema>> = ordered.map((item) => {
      const readiness = toServiceReadiness(item);
      const collection = toCollectionNeed(item);
      const boarded =
        group.mode === "PICK_UP"
          ? item.stage.startsWith("return_") || Boolean(item.collectedAt)
          : Boolean(item.boardedAt) ||
            ["delivery_pending", "delivery_enroute", "customer_arrived", "service_active"].includes(
              item.stage
            );
      const dropped =
        group.mode === "DROP_OFF" &&
        (Boolean(item.deliveredAt) || ["customer_arrived", "service_active"].includes(item.stage));

      return {
        id: item.therapistId ?? item.bookingId,
        name: item.therapistName ?? "Assigned therapist",
        service: readiness,
        estimatedCompletion: readiness === "IN_PROGRESS" ? (item.sessionDueAt ?? null) : null,
        collection,
        boarded,
        dropped,
      };
    });

    const stops: Array<z.infer<typeof tripStopSchema>> = [];
    if (group.mode === "DROP_OFF") {
      // Consolidate pooled pickups at the same branch while preserving all unboarded bookingIds
      const needsPickup = ordered.filter((item) =>
        ["pickup_pending", "pickup_enroute", "pickup_arrived"].includes(item.stage)
      );
      if (needsPickup.length > 0) {
        const pickupLead = needsPickup[0]!;
        const destCoords =
          pickupLead.pickupCoords ?? (pickupLead.leg === "pickup" ? pickupLead.destination : null);
        const branchProgress = needsPickup.some((i) => i.stage === "pickup_arrived")
          ? "ARRIVED"
          : needsPickup.some((i) => i.stage === "pickup_enroute")
            ? "ENROUTE"
            : "PENDING";
        stops.push({
          id: `${pickupLead.bookingId}:pickup`,
          bookingId: pickupLead.bookingId,
          bookingIds: needsPickup.map((i) => i.bookingId),
          role: "BRANCH_PICKUP",
          label: pickupLead.pickupLabel ?? pickupLead.branchName ?? "Branch pickup",
          passengers: needsPickup.map((i) => i.therapistId ?? i.bookingId),
          progress: branchProgress,
          lat: destCoords?.lat ?? null,
          lng: destCoords?.lng ?? null,
        });
      }
      for (const item of ordered) {
        const dropCoords =
          item.customerCoords ?? (item.leg === "delivery" ? item.destination : null);
        stops.push({
          id: `${item.bookingId}:delivery`,
          bookingId: item.bookingId,
          bookingIds: [item.bookingId],
          role: "CUSTOMER_DROP",
          label:
            item.customerAddress ??
            (item.leg === "delivery" ? item.destination?.label : null) ??
            item.customerName ??
            "Customer location",
          passengers: [item.therapistId ?? item.bookingId],
          progress: stopProgressForStage(item.stage, "CUSTOMER_DROP"),
          lat: dropCoords?.lat ?? null,
          lng: dropCoords?.lng ?? null,
        });
      }
    } else {
      for (const item of ordered) {
        const colCoords =
          item.customerCoords ?? (item.leg === "collection" ? item.destination : null);
        stops.push({
          id: `${item.bookingId}:collection`,
          bookingId: item.bookingId,
          bookingIds: [item.bookingId],
          role: "THERAPIST_COLLECTION",
          label:
            item.customerAddress ??
            (item.leg === "collection" ? item.destination?.label : null) ??
            item.customerName ??
            "Collection point",
          passengers: [item.therapistId ?? item.bookingId],
          progress: stopProgressForStage(item.stage, "THERAPIST_COLLECTION"),
          lat: colCoords?.lat ?? null,
          lng: colCoords?.lng ?? null,
        });
      }
      const returnLeader = ordered[ordered.length - 1]!;
      const returnCoords =
        returnLeader.returnDestination ??
        returnLeader.pickupCoords ??
        (returnLeader.leg === "return" ? returnLeader.destination : null);
      stops.push({
        id: `${returnLeader.bookingId}:return`,
        bookingId: returnLeader.bookingId,
        bookingIds: ordered.map((item) => item.bookingId),
        role: "DESTINATION",
        label:
          returnLeader.returnDestination?.label ??
          returnLeader.branchName ??
          returnLeader.pickupLabel ??
          "Branch return",
        passengers: ordered.map((item) => item.therapistId ?? item.bookingId),
        progress: stopProgressForStage(returnLeader.stage, "DESTINATION"),
        lat: returnCoords?.lat ?? null,
        lng: returnCoords?.lng ?? null,
      });
    }

    const activeStopItem =
      ordered.find((item) =>
        [
          "pickup_enroute",
          "pickup_arrived",
          "delivery_enroute",
          "collection_enroute",
          "collection_arrived",
          "return_enroute",
          "return_arrived",
          "pickup_pending",
          "delivery_pending",
          "collection_pending",
          "return_pending",
        ].includes(item.stage)
      ) ?? lead;

    const collectionAuthorized =
      group.mode === "PICK_UP" &&
      ordered.some(
        (item) =>
          ["collection_pending", "collection_enroute", "collection_arrived", "return_pending", "return_enroute", "return_arrived"].includes(
            item.stage
          ) &&
          toCollectionNeed(item) === "REQUIRED" &&
          toServiceReadiness(item) === "COMPLETED" &&
          Boolean(item.destination)
      );

    const dropOffAuthorized =
      group.mode === "DROP_OFF" &&
      ordered.some(
        (item) =>
          [
            "pickup_pending",
            "pickup_enroute",
            "pickup_arrived",
            "delivery_pending",
            "delivery_enroute",
          ].includes(item.stage) && Boolean(item.destination)
      );

    plans.push({
      id: key,
      driverId: effectiveDriverId,
      mode: group.mode,
      scheduled: formatScheduledLabel(lead),
      origin:
        group.mode === "DROP_OFF"
          ? lead.pickupLabel ?? lead.branchName ?? "Branch pickup"
          : lead.customerAddress ?? lead.customerName ?? "Collection point",
      destination:
        group.mode === "DROP_OFF"
          ? ordered[ordered.length - 1]?.customerAddress ??
            lead.destination?.label ??
            "Customer destination"
          : lead.returnDestination?.label ?? lead.branchName ?? "Branch return",
      passengers,
      stops,
      stage: activeStopItem.stage,
      routeAuthorized: group.mode === "PICK_UP" ? collectionAuthorized : dropOffAuthorized,
      revision: ordered.reduce((maxRev, item) => Math.max(maxRev, item.revision), 0),
      vehicleJourneyId: lead.vehicleJourneyId ?? null,
    });
  }

  return plans;
}
