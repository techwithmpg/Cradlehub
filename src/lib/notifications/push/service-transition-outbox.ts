import "server-only";

import { logError, logInfo, logWarn } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceNotification } from "@/lib/notifications/types";
import { deliverWorkspaceNotificationPush } from "./delivery";

type ClaimedJob = {
  notification_id: string;
  delivered_subscription_ids: string[];
  lease_token: string;
};

type OutboxHealth = {
  pending: number;
  ready: number;
  overdue: number;
  repeated_failures: number;
  oldest_created_at: string | null;
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
    throw claim.error;
  }

  const jobs = (claim.data ?? []) as ClaimedJob[];
  const outcome = { claimed: jobs.length, completed: 0, pending: 0 };
  async function deliverJob(job: ClaimedJob) {
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
  // Bound concurrent network sends even when the database claims a larger batch.
  for (let index = 0; index < jobs.length; index += 3) {
    await Promise.all(jobs.slice(index, index + 3).map(deliverJob));
  }
  return outcome;
}

/** Invoked by a protected server job. No scheduler is installed by this module. */
export async function runServiceTransitionPushConsumer(input: {
  batchSize?: number;
  maxBatches?: number;
} = {}): Promise<{
  claimed: number;
  completed: number;
  pending: number;
  batches: number;
  health: OutboxHealth;
}> {
  const batchSize = Math.max(1, Math.min(20, Math.floor(input.batchSize ?? 6)));
  const maxBatches = Math.max(1, Math.min(10, Math.floor(input.maxBatches ?? 4)));
  const totals = { claimed: 0, completed: 0, pending: 0, batches: 0 };
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await drainServiceTransitionPushOutbox({ limit: batchSize });
    totals.claimed += result.claimed;
    totals.completed += result.completed;
    totals.pending += result.pending;
    totals.batches += 1;
    if (result.claimed < batchSize) break;
  }

  const healthResult = (await createAdminClient().rpc(
    "service_transition_push_outbox_health" as never,
    {} as never
  )) as unknown as { data: OutboxHealth | null; error: Error | null };
  if (healthResult.error || !healthResult.data) {
    logError("service_transition.push_health_failed", { error: healthResult.error });
    throw healthResult.error ?? new Error("Service transition push health unavailable");
  }
  const health = healthResult.data as OutboxHealth;
  if (health.overdue > 0 || health.repeated_failures > 0) {
    logWarn("service_transition.push_backlog_alert", { ...health, ...totals });
  } else {
    logInfo("service_transition.push_consumer_completed", { ...health, ...totals });
  }
  return { ...totals, health };
}
