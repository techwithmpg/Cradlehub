import "server-only";
import { resolveStaffPwaOperationalGroup } from "@/lib/auth/workspace-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";
import { publishCrmDriverArrivalNotification } from "@/lib/notifications/driver-arrival-notifications";
import { processDriverNativePush } from "@/lib/driver/native-push";
import { scheduleBranchOptimizationReevaluation } from "@/lib/optimization/auto-reevaluate";
import { journeySchema, driverEventSchema, type DriverJourney } from "./journey";
import { buildDriverTripPlans } from "./trip-plans";
export class DriverApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
export async function requireDriver() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new DriverApiError(401, "sign_in_required", "Sign in to the Driver app.");
  const result = await db
    .from("staff")
    .select("id,branch_id,system_role,staff_type,is_active,archived_at,merged_into_staff_id")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  const s = result.data as
    | (NonNullable<typeof result.data> & {
        archived_at?: string | null;
        merged_into_staff_id?: string | null;
      })
    | null;
  if (
    result.error ||
    !s ||
    !s.branch_id ||
    Boolean(s.archived_at) ||
    Boolean(s.merged_into_staff_id) ||
    resolveStaffPwaOperationalGroup(s.system_role, s.staff_type) !== "driver"
  )
    throw new DriverApiError(
      403,
      "driver_required",
      "An active assigned Driver account is required."
    );
  return { db, staff: s, user };
}
function requireInstalled() {
  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED !== "true")
    throw new DriverApiError(
      503,
      "journeys_inactive",
      "The unified journey service is not enabled. Existing trips remain available."
    );
}
export async function readDriverJourneys(bookingId?: string) {
  requireInstalled();
  const { db } = await requireDriver();
  const { data, error } = await db.rpc(
    "driver_unified_snapshot" as never,
    { p_booking_id: bookingId ?? null } as never
  );
  if (error)
    throw new DriverApiError(
      503,
      "journeys_unavailable",
      "Journey status could not be verified. Refresh before acting."
    );
  const parsed = journeySchema.array().safeParse(data);
  if (!parsed.success)
    throw new DriverApiError(503, "invalid_journey_reply", "Journey status could not be verified.");
  return parsed.data;
}
export async function readDriverTripsSnapshot(bookingId?: string) {
  requireInstalled();
  const { db, staff } = await requireDriver();
  const { data, error } = await db.rpc(
    "driver_unified_snapshot" as never,
    { p_booking_id: bookingId ?? null } as never
  );
  if (error)
    throw new DriverApiError(
      503,
      "journeys_unavailable",
      "Journey status could not be verified. Refresh before acting."
    );
  const parsed = journeySchema.array().safeParse(data);
  if (!parsed.success)
    throw new DriverApiError(503, "invalid_journey_reply", "Journey status could not be verified.");
  return {
    journeys: parsed.data,
    tripPlans: buildDriverTripPlans(parsed.data, staff.id),
  };
}

async function emitArrivalNotificationFromJourney(
  staffId: string,
  branchId: string,
  journey: DriverJourney,
  event: {
    requestId: string;
    point?: { accuracyMeters?: number; observedAt?: string };
  }
) {
  const kind =
    journey.stage === "pickup_arrived"
      ? "pickup_arrival"
      : journey.stage === "customer_arrived"
        ? "customer_arrival"
        : journey.stage === "collection_arrived"
          ? "collection_arrival"
          : null;
  if (!kind) return;

  try {
    const admin = createAdminClient();
    const [bookingRes, driverRes] = await Promise.all([
      admin
        .from("bookings")
        .select("id, branch_id, driver_id, status, booking_progress_status, session_completed_at, session_completion_source, metadata")
        .eq("id", journey.bookingId)
        .maybeSingle(),
      admin.from("staff").select("id, full_name, nickname").eq("id", staffId).maybeSingle(),
    ]);
    const booking = bookingRes.data;
    if (!booking) return;

    const driverName =
      driverRes.data?.nickname?.trim() || driverRes.data?.full_name?.trim() || "Assigned driver";
    const collectionDecision = journey.collectionDecision ?? "required";

    await publishCrmDriverArrivalNotification(
      {
        eventId: `driver-event:${event.requestId}`,
        kind,
        source: "server_journey_transition",
        authorizedByServer: true,
        branchId: booking.branch_id ?? branchId,
        driverId: staffId,
        driverName,
        bookingId: journey.bookingId,
        journeyId: journey.vehicleJourneyId ?? journey.bookingId,
        legId: journey.leg ?? kind,
        stopId: `${journey.bookingId}:${journey.leg ?? kind}`,
        destinationLabel:
          journey.destination?.label ?? journey.customerAddress ?? journey.pickupLabel ?? "Destination",
        customerName: journey.customerName ?? null,
        therapistIds: journey.therapistId ? [journey.therapistId] : [],
        therapistNames: journey.therapistName ? [journey.therapistName] : [],
        accuracyMeters: event.point?.accuracyMeters ?? null,
        observedAt: event.point?.observedAt ?? journey.observedAt,
        revision: journey.revision,
      },
      {
        expectedBranchId: booking.branch_id ?? branchId,
        bookingsById: new Map([
          [
            booking.id,
            {
              id: booking.id,
              branchId: booking.branch_id,
              driverId: booking.driver_id,
              bookingStatus: booking.status,
              bookingProgressStatus: booking.booking_progress_status,
              sessionCompletedAt: booking.session_completed_at,
              sessionCompletionSource: booking.session_completion_source,
              collection: {
                decision: collectionDecision,
                hasValidApproval: Boolean(
                  journey.collectionApprovalMetadata &&
                    (journey.collectionApprovalMetadata.approvedBy ||
                      journey.collectionApprovalMetadata.approvedAt ||
                      journey.collectionApprovalMetadata.source)
                ),
                collectionDriverId: journey.collectionDriverId ?? booking.driver_id,
              },
            },
          ],
        ]),
      }
    );
  } catch (err) {
    logError("driver.arrival_notification_publish_failed", {
      bookingId: journey.bookingId,
      stage: journey.stage,
      error: err,
    });
  }
}

export async function applyDriverEvent(raw: unknown) {
  requireInstalled();
  const event = driverEventSchema.safeParse(raw);
  if (!event.success)
    throw new DriverApiError(400, "invalid_event", "The journey event is invalid.");
  if (["gps_arrival", "location"].includes(event.data.action) && !event.data.point)
    throw new DriverApiError(
      400,
      "location_required",
      "A fresh accurate GPS observation is required."
    );
  const { db, staff } = await requireDriver();
  const { data, error } = await db.rpc(
    "driver_unified_event" as never,
    { p_event: event.data } as never
  );
  if (error)
    throw new DriverApiError(
      409,
      "journey_changed",
      "The journey changed or could not be confirmed. Refresh before retrying."
    );
  const parsed = journeySchema.safeParse(data);
  if (!parsed.success)
    throw new DriverApiError(
      503,
      "invalid_journey_reply",
      "No successful journey update was confirmed."
    );
  if (event.data.action === "gps_arrival" && staff.branch_id) {
    await emitArrivalNotificationFromJourney(staff.id, staff.branch_id, parsed.data, event.data);
  }
  if (
    staff.branch_id &&
    !["location", "resume"].includes(event.data.action)
  ) {
    scheduleBranchOptimizationReevaluation({
      branchId: staff.branch_id,
      date: parsed.data.bookingDate ?? undefined,
      reason: `driver_${event.data.action}`,
      actorStaffId: staff.id,
    });
  }
  if (
    process.env.CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED === "true" &&
    !["location", "resume"].includes(event.data.action)
  ) {
    void processDriverNativePush().catch(() => undefined);
  }
  return parsed.data;
}

/** Existing in-flight trips may finish; an enrolled transport cannot fall back
 * to a customer-only itinerary and bypass pickup, review or collection. */
export async function legacyDriverRouteAllowed(bookingId: string) {
  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED !== "true") return true;
  const { db } = await requireDriver();
  const { data, error } = await db.rpc(
    "driver_unified_legacy_allowed" as never,
    { p_booking_id: bookingId } as never
  );
  if (error)
    throw new DriverApiError(503, "journeys_unavailable", "Journey status could not be verified.");
  return data === true;
}
