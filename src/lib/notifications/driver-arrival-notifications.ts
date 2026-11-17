import "server-only";

import { createNotificationOnce, resolveNotificationsForEntity } from "@/lib/notifications/create";
import {
  formatArrivalNotificationCopy,
  semanticKeyForArrival,
  validateArrivalEvent,
  type ArrivalValidationContext,
  type CrmArrivalEventKind,
} from "@/lib/dispatch/arrival-events";

export interface PublishArrivalNotificationResult {
  published: boolean;
  reason?: string;
  dedupeKey?: string;
}

/**
 * Publishes one deduplicated CRM notification into the existing
 * `workspace_notifications` pipeline for a validated driver arrival or
 * collection-ready transition.
 */
export async function publishCrmDriverArrivalNotification(
  rawEvent: unknown,
  context: ArrivalValidationContext
): Promise<PublishArrivalNotificationResult> {
  const validated = validateArrivalEvent(rawEvent, context);
  if (!validated.ok) {
    return { published: false, reason: validated.reason };
  }

  const { event } = validated;
  const copy = formatArrivalNotificationCopy(event);
  const semanticKey = semanticKeyForArrival(event);
  const dedupeKey = `driver_arrival:${semanticKey}`;

  await createNotificationOnce({
    branchId: event.branchId,
    targetWorkspace: "crm",
    actorStaffId: event.driverId,
    type: "booking_status_changed",
    title: copy.title,
    body: copy.body,
    entityType: "booking",
    entityId: event.bookingId,
    actionHref: `/crm/dispatch?bookingId=${encodeURIComponent(event.bookingId)}&view=map`,
    priority: "high",
    requiresAction: true,
    dedupeKey,
    metadata: {
      driver_arrival_event_id: event.eventId,
      driver_arrival_kind: event.kind,
      driver_arrival_source: event.source,
      driver_id: event.driverId,
      driver_name: event.driverName,
      therapist_name: event.therapistNames.join(", ") || null,
      customer_name: event.customerName ?? null,
      destination_label: event.destinationLabel,
      observed_at: event.observedAt,
    },
  });

  return { published: true, dedupeKey };
}

export async function resolveCrmDriverArrivalNotifications(
  bookingId: string,
  kind?: CrmArrivalEventKind
): Promise<void> {
  void kind;
  await resolveNotificationsForEntity("booking", bookingId, "crm", "booking_status_changed");
}
