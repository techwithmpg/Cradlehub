import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logError } from "@/lib/logger";
import { createNotificationOnce } from "@/lib/notifications/create";
import { publishCrmDriverArrivalNotification } from "@/lib/notifications/driver-arrival-notifications";
import { processDriverNativePush } from "@/lib/driver/native-push";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function emitPostCompletionCollectionSignals(
  db: SupabaseClient<Database>,
  bookingId: string
): Promise<void> {
  if (typeof db.from !== "function") return;

  try {
    const { data: booking } = await db
      .from("bookings")
      .select(
        "id, branch_id, staff_id, driver_id, status, booking_progress_status, session_completed_at, session_completion_source, metadata, customer:customers(full_name), staff:staff!bookings_staff_id_fkey(full_name, nickname), driver:staff!bookings_driver_id_fkey(full_name, nickname)"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking || !booking.branch_id) return;

    const meta = asRecord(booking.metadata);
    const dc = asRecord(meta?.driver_collection);
    const rawDecision = typeof dc?.decision === "string" ? dc.decision : "required";
    const hasApproval = Boolean(dc?.approvedBy || dc?.approvedAt || dc?.source);
    const conflict = dc?.conflictingApproval === true;

    const therapistRecord = Array.isArray(booking.staff) ? booking.staff[0] : booking.staff;
    const therapistName =
      therapistRecord?.nickname?.trim() || therapistRecord?.full_name?.trim() || "Therapist";
    const customerRecord = Array.isArray(booking.customer) ? booking.customer[0] : booking.customer;
    const customerName = customerRecord?.full_name?.trim() || null;

    if (rawDecision === "not_required" && hasApproval && !conflict) {
      // Independent departure approved — no pickup dispatch needed
      return;
    }

    if (rawDecision === "undecided" || conflict || (rawDecision === "not_required" && !hasApproval)) {
      await createNotificationOnce({
        branchId: booking.branch_id,
        targetWorkspace: "crm",
        actorStaffId: booking.staff_id,
        type: "booking_status_changed",
        title: "Collection requirement needs confirmation",
        body: `${therapistName} completed service. Confirm whether collection is required or approved for independent departure.`,
        entityType: "booking",
        entityId: booking.id,
        actionHref: `/crm/dispatch?bookingId=${encodeURIComponent(booking.id)}`,
        priority: "high",
        requiresAction: true,
        dedupeKey: `collection_undecided:${booking.id}`,
      });
      return;
    }

    const driverRecord = Array.isArray(booking.driver) ? booking.driver[0] : booking.driver;
    const driverId =
      (typeof dc?.collectionDriverId === "string" && dc.collectionDriverId) ||
      booking.driver_id ||
      null;
    const driverName =
      (typeof dc?.collectionDriverName === "string" && dc.collectionDriverName) ||
      driverRecord?.nickname?.trim() ||
      driverRecord?.full_name?.trim() ||
      null;

    await publishCrmDriverArrivalNotification(
      {
        eventId: `collection-ready:${booking.id}:${booking.session_completed_at ?? "now"}`,
        kind: "collection_ready",
        source: "server_service_completion",
        authorizedByServer: true,
        branchId: booking.branch_id,
        driverId,
        driverName,
        bookingId: booking.id,
        destinationLabel: customerName ?? "Customer location",
        customerName,
        therapistIds: booking.staff_id ? [booking.staff_id] : [],
        therapistNames: [therapistName],
        observedAt: booking.session_completed_at ?? new Date().toISOString(),
        revision: 0,
      },
      {
        expectedBranchId: booking.branch_id,
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
                decision: "required",
                hasValidApproval: false,
                collectionDriverId: driverId,
              },
            },
          ],
        ]),
      }
    );

    if (process.env.CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED === "true") {
      void processDriverNativePush().catch(() => undefined);
    }
  } catch (err) {
    logError("driver.collection_ready_signal_failed", { bookingId, error: err });
  }
}

export async function confirmDriverCollectionReady(
  db: SupabaseClient<Database>,
  bookingId: string
): Promise<string | undefined> {
  if (process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED !== "true") return;
  try {
    const { data, error } = await db.rpc(
      "driver_unified_collection_ready" as never,
      { p_booking_id: bookingId } as never
    );
    if (!error && data === true) {
      await emitPostCompletionCollectionSignals(db, bookingId);
      return;
    }
  } catch {
    /* Service completion is already authoritative; readiness remains visibly unconfirmed. */
  }
  logError("driver.collection_readiness_unconfirmed", { bookingId });
  return "Service completion was recorded. Ask CRM to confirm therapist collection readiness.";
}
