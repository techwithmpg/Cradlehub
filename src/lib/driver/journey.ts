import { z } from "zod";
export const journeyStages = [
  "pickup_pending",
  "pickup_enroute",
  "pickup_arrived",
  "delivery_pending",
  "delivery_enroute",
  "customer_arrived",
  "service_active",
  "collection_pending",
  "collection_enroute",
  "collection_arrived",
  "return_pending",
  "return_enroute",
  "return_arrived",
  "complete",
  "review",
] as const;
export const journeySchema = z
  .object({
    bookingId: z.guid(),
    revision: z.number().int().nonnegative(),
    stage: z.enum(journeyStages),
    leg: z.enum(["pickup", "delivery", "collection", "return"]).nullable().default(null),
    destination: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
        label: z.string().max(200),
      })
      .nullable()
      .default(null),
    observedAt: z.iso.datetime({ offset: true }),
    reason: z.string().nullable().optional(),
    therapistId: z.guid().nullable().optional(),
    therapistName: z.string().max(160).nullable().optional(),
    customerName: z.string().max(160).nullable().optional(),
    branchName: z.string().max(160).nullable().optional(),
    bookingDate: z.iso.date().optional(),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/)
      .optional(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/)
      .nullable()
      .optional(),
    pickupLabel: z.string().max(200).nullable().optional(),
    pickupCoords: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      })
      .nullable()
      .optional(),
    customerAddress: z.string().max(200).nullable().optional(),
    customerCoords: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
      })
      .nullable()
      .optional(),
    vehicleJourneyId: z.guid().nullable().optional(),
    deliveryDriverId: z.guid().nullable().optional(),
    collectionDriverId: z.guid().nullable().optional(),
    activeDriverId: z.guid().nullable().optional(),
    viewerDriverId: z.guid().nullable().optional(),
    stopOrder: z.number().int().positive().nullable().optional(),
    collectionDecision: z.enum(["required", "not_required", "undecided"]).nullable().optional(),
    collectionApprovalMetadata: z.record(z.string(), z.unknown()).nullable().optional(),
    returnDestination: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
        label: z.string().max(200).optional(),
      })
      .nullable()
      .optional(),
    optimizerSnapshotId: z.string().max(160).nullable().optional(),
    boardedAt: z.string().nullable().optional(),
    deliveredAt: z.string().nullable().optional(),
    collectedAt: z.string().nullable().optional(),
    bookingStatus: z.string().max(64).nullable().optional(),
    bookingProgressStatus: z.string().max(64).nullable().optional(),
    sessionStartedAt: z.string().nullable().optional(),
    sessionDueAt: z.string().nullable().optional(),
    sessionCompletedAt: z.string().nullable().optional(),
    sessionCompletionSource: z.string().max(64).nullable().optional(),
  })
  .refine(
    (j) => {
      const expected = j.stage.startsWith("pickup_")
        ? "pickup"
        : j.stage.startsWith("delivery_")
          ? "delivery"
          : j.stage.startsWith("collection_")
            ? "collection"
            : j.stage.startsWith("return_")
              ? "return"
              : null;
      return j.leg === expected;
    },
    { message: "Journey stage and leg disagree" }
  );
export type DriverJourney = z.infer<typeof journeySchema>;
export const driverEventSchema = z
  .object({
    bookingId: z.guid(),
    requestId: z.guid(),
    expectedRevision: z.number().int().nonnegative(),
    action: z.enum(["start", "resume", "gps_arrival", "location", "board", "finish_return"]),
    point: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
        accuracyMeters: z.number().positive().max(50),
        observedAt: z.iso.datetime({ offset: true }),
      })
      .optional(),
  })
  .strict();
export const travellingStages = new Set<string>([
  "pickup_enroute",
  "delivery_enroute",
  "collection_enroute",
  "return_enroute",
]);
export function journeyLabel(j: DriverJourney): string {
  return {
    pickup_pending: "Collect therapist at branch",
    pickup_enroute: "To therapist pickup",
    pickup_arrived: "Confirm therapist is on board",
    delivery_pending: "Deliver therapist",
    delivery_enroute: "To customer",
    customer_arrived: "Therapist delivered · awaiting service",
    service_active: "Service in progress · collection remains pending",
    collection_pending: "Therapist ready for collection",
    collection_enroute: "Returning for therapist",
    collection_arrived: "Confirm therapist collected",
    return_pending: "Return therapist to branch",
    return_enroute: "Returning to branch",
    return_arrived: "Confirm branch drop-off",
    complete: "Transport completed",
    review: "Dispatch review required",
  }[j.stage];
}
export function nextJourneyAction(j: DriverJourney) {
  if (j.stage.endsWith("_pending") && j.destination)
    return { action: "start" as const, label: "Start navigation" };
  if (j.stage === "pickup_arrived" || j.stage === "collection_arrived")
    return {
      action: "board" as const,
      label: j.stage === "pickup_arrived" ? "Therapist on board" : "Therapist collected",
    };
  if (j.stage === "return_arrived")
    return { action: "finish_return" as const, label: "Confirm branch drop-off" };
  return null;
}
/** Observations are evidence, never boarding proof. Mirrors the draft SQL gate. */
export function validArrivalPoint(
  point: { lat: number; lng: number; accuracyMeters: number; observedAt: string },
  target: { lat: number; lng: number },
  now: number
) {
  const time = Date.parse(point.observedAt);
  if (
    !Number.isFinite(time) ||
    now - time > 30000 ||
    time > now + 5000 ||
    !Number.isFinite(point.accuracyMeters) ||
    point.accuracyMeters <= 0 ||
    point.accuracyMeters > 50
  )
    return false;
  const radians = (x: number) => (x * Math.PI) / 180;
  const dLat = radians(target.lat - point.lat),
    dLng = radians(target.lng - point.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(point.lat)) * Math.cos(radians(target.lat)) * Math.sin(dLng / 2) ** 2;
  return (
    6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) + point.accuracyMeters <=
    100
  );
}
