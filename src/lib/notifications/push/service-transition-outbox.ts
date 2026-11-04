import "server-only";

import { logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { deliverWorkspaceNotificationPush } from "./delivery";

type ClaimedJob = {
  notification_id: string;
  delivered_subscription_ids: string[];
  lease_token: string;
};

/** Service-role-only retry consumer. A failed push remains in the transactional outbox. */
export async function drainServiceTransitionPushOutbox(input: {
  eventId?: string;
  limit?: number;
} = {}): Promise<{ claimed: number; completed: number; pending: number }> {
  const admin = createAdminClient();
  const limit = Math.max(1, Math.min(20, Math.floor(input.limit ?? 6)));
  const claim = await admin.rpc("claim_service_transition_push_jobs" as never, {
    p_limit: limit,
    p_event_id: input.eventId ?? null,
  } as never);
  if (claim.error) {
    logError("service_transition.push_claim_failed", { error: claim.error });
    return { claimed: 0, completed: 0, pending: 0 };
  }

  const jobs = (claim.data ?? []) as ClaimedJob[];
  const outcome = { claimed: jobs.length, completed: 0, pending: 0 };
  for (const job of jobs) {
    let deliveredIds: string[] = [];
    let complete = false;
    let reason: string | null = null;
    try {
      const lookup = await admin.from("workspace_notifications")
        .select("*").eq("id", job.notification_id).maybeSingle();
      if (lookup.error) throw lookup.error;
      const notification = lookup.data as WorkspaceNotification | null;
      // A dismissed or already-seen notice must not be pushed back onto a phone.
      if (!notification || notification.status !== "unread") {
        complete = true;
      } else {
        const delivery = await deliverWorkspaceNotificationPush(notification, {
          skipSubscriptionIds: new Set(job.delivered_subscription_ids),
        });
        deliveredIds = delivery.deliveredSubscriptionIds;
        complete = delivery.configured && !delivery.dispatchFailed && delivery.failed === 0;
        if (!complete) reason = delivery.configured ? "push_delivery_failed" : "push_unconfigured";
      }
    } catch (error) {
      reason = "push_dispatch_exception";
      logError("service_transition.push_dispatch_exception", {
        notificationId: job.notification_id,
        error,
      });
    }

    const finish = await admin.rpc("finish_service_transition_push_job" as never, {
      p_notification_id: job.notification_id,
      p_lease_token: job.lease_token,
      p_delivered_subscription_ids: deliveredIds,
      p_completed: complete,
      p_error: reason,
    } as never);
    if (finish.error || finish.data !== true) {
      logError("service_transition.push_finish_failed", {
        notificationId: job.notification_id,
        error: finish.error,
      });
      outcome.pending += 1;
    } else if (complete) {
      outcome.completed += 1;
    } else {
      outcome.pending += 1;
    }
  }
  return outcome;
}
