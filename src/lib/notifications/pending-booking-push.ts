import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logWarn } from "@/lib/logger";
import { readPendingCrmBookings } from "@/lib/notifications/pending-booking-queue";
import { getOnDutyCrmStaffIds } from "@/lib/notifications/pending-booking-duty";
import { deliverWorkspaceNotificationPush } from "@/lib/notifications/push/delivery";
import type { WorkspaceNotification } from "@/lib/notifications/types";

const SINGLE_REPEAT_MS = 10 * 60_000;
const GROUP_REPEAT_MS = 20 * 60_000;
const FAILURE_RETRY_MS = 2 * 60_000;
const MAX_BRANCHES = 100;

function pendingCrmPushNotice(input: {
  branchId: string;
  count: number;
  firstBookingId: string;
  now: Date;
}): WorkspaceNotification {
  const single = input.count === 1;
  const href = single
    ? "/crm/bookings?bookingId=" + encodeURIComponent(input.firstBookingId) + "&tab=needs-action"
    : "/crm/bookings?tab=needs-action";
  return {
    id: "crm-pending-confirmation:" + input.branchId + (single ? ":" + input.firstBookingId : ""),
    branch_id: input.branchId,
    action_href: href,
    actor_staff_id: null,
    body: single
      ? "A booking is waiting for CRM confirmation. Open the booking to review."
      : String(input.count) + " bookings are waiting for confirmation. Open Needs Action to review.",
    created_at: input.now.toISOString(),
    dedupe_key: null,
    entity_id: single ? input.firstBookingId : null,
    entity_type: single ? "booking" : null,
    metadata: { pending_confirmation_digest: true, pending_count: input.count },
    priority: single ? "high" : "normal",
    read_at: null,
    recipient_staff_id: null,
    requires_action: true,
    resolved_at: null,
    status: "unread",
    target_role: null,
    target_workspace: "crm",
    title: single ? "Booking needs confirmation" : "Bookings awaiting confirmation",
    type: "booking_created",
  };
}

/**
 * Protected scheduled consumer; the review-only lease RPC must be installed
 * on an isolated test database before this feature can be enabled.
 * No changes to bookings, booking availability, payment or attendance.
 */
export async function runPendingBookingPushReminders(now = new Date()) {
  const admin = createAdminClient();
  const branches = await admin.from("branches").select("id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(MAX_BRANCHES + 1);
  if (branches.error || !branches.data) throw new Error("Active branches could not be loaded.");
  if (branches.data.length > MAX_BRANCHES) throw new Error("Branch safety limit reached.");

  const stats = {
    branchesChecked: 0,
    queuedOffDuty: 0,
    notDue: 0,
    attempted: 0,
    delivered: 0,
    failed: 0,
  };
  for (const branch of branches.data) {
    stats.branchesChecked += 1;
    try {
      const queue = await readPendingCrmBookings({ branchId: branch.id, admin });
      if (queue.count === 0) {
        // Reset when empty so the next new request can be sent on the next tick.
        const reset = await admin.rpc("reset_crm_pending_booking_push" as never, {
          p_branch_id: branch.id,
          p_now: now.toISOString(),
        } as never);
        if (reset.error) throw reset.error;
        continue;
      }

      const eligibleStaffIds = await getOnDutyCrmStaffIds({ branchId: branch.id, now, admin });
      if (eligibleStaffIds.size === 0) {
        stats.queuedOffDuty += queue.count;
        continue;
      }

      const token = randomUUID();
      const claim = await admin.rpc("claim_crm_pending_booking_push" as never, {
        p_branch_id: branch.id,
        p_token: token,
        p_now: now.toISOString(),
      } as never);
      if (claim.error) throw claim.error;
      if (claim.data !== true) {
        stats.notDue += 1;
        continue;
      }

      let success = false;
      let latestCount = queue.count;
      let repeatMs = FAILURE_RETRY_MS;
      try {
        // Recheck after the atomic lease. A previously confirmed or cancelled
        // request is not intentionally pushed from an old cached snapshot.
        const latest = await readPendingCrmBookings({ branchId: branch.id, admin });
        latestCount = latest.count;
        if (latest.count === 0 || !latest.first) {
          success = true;
          repeatMs = 0;
        } else {
          const notice = pendingCrmPushNotice({
            branchId: branch.id,
            count: latest.count,
            firstBookingId: latest.first.id,
            now,
          });
          const delivery = await deliverWorkspaceNotificationPush(notice, { eligibleStaffIds });
          stats.attempted += delivery.attempted;
          stats.delivered += delivery.delivered;
          stats.failed += delivery.failed;
          success = delivery.configured &&
            !delivery.dispatchFailed &&
            delivery.failed === 0 &&
            delivery.delivered > 0;
          if (!success && delivery.failed === 0) {
            // "No subscribed eligible CSR" is NOT successful push delivery.
            stats.failed += 1;
            logWarn("crm.pending_booking_push_no_delivery", {
              branchId: branch.id,
              attempted: delivery.attempted,
              configured: delivery.configured,
              dispatchFailed: delivery.dispatchFailed,
            });
          }
          repeatMs = success
            ? latest.count === 1 ? SINGLE_REPEAT_MS : GROUP_REPEAT_MS
            : FAILURE_RETRY_MS;
        }
      } catch (error) {
        logError("crm.pending_booking_push_delivery_failed", { branchId: branch.id, error });
        stats.failed += 1;
      }

      const finished = await admin.rpc("finish_crm_pending_booking_push" as never, {
        p_branch_id: branch.id,
        p_token: token,
        p_now: now.toISOString(),
        p_next_due_at: new Date(now.getTime() + repeatMs).toISOString(),
        p_success: success,
        p_pending_count: latestCount,
      } as never);
      if (finished.error || finished.data !== true) {
        throw finished.error ?? new Error("CRM pending push lease could not be finalized.");
      }
    } catch (error) {
      // Other branches keep functioning. Report failures rather than claiming
      // push success; the scheduler or operations review must inspect logs.
      stats.failed += 1;
      logError("crm.pending_booking_push_branch_failed", { branchId: branch.id, error });
    }
  }
  if (stats.queuedOffDuty > 0) {
    logWarn("crm.pending_bookings_waiting_for_duty", {
      queued: stats.queuedOffDuty,
      branchCount: stats.branchesChecked,
    });
  }
  return stats;
}
