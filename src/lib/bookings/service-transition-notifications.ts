import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationOnce } from "@/lib/notifications/create";
import { logError } from "@/lib/logger";
import { drainServiceTransitionPushOutbox } from "@/lib/notifications/push/service-transition-outbox";
import { serviceTransitionEventId } from "./service-transition-event";

type Transition = "started" | "completed";
type Relation<T> = T | T[] | null;

function first<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function timeLabel(timestamp: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit",
  }).format(new Date(timestamp));
}

/** Publish only after the lifecycle RPC commits. The persisted timestamp is the event identity. */
export async function publishServiceTransition(input: {
  bookingId: string;
  branchId: string;
  actorStaffId: string | null;
  transition: Transition;
}): Promise<void> {
  const { data, error } = await createAdminClient().from("bookings")
    .select(`id, branch_id, staff_id, session_started_at, session_completed_at, session_completion_source,
      customers(full_name), booking_attendees!attendee_id(display_name), services(name)`)
    .eq("id", input.bookingId).eq("branch_id", input.branchId).maybeSingle();
  if (error || !data) {
    logError("service_transition.notification_lookup_failed", { bookingId: input.bookingId, error });
    return;
  }
  const timestamp = input.transition === "started" ? data.session_started_at : data.session_completed_at;
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return;
  const recipient = first(data.booking_attendees as Relation<{ display_name: string | null }>)?.display_name?.trim()
    || first(data.customers as Relation<{ full_name: string | null }>)?.full_name?.trim() || "Guest";
  const service = first(data.services as Relation<{ name: string | null }>)?.name?.trim() || "Service";
  const automatic = input.transition === "completed" && data.session_completion_source === "auto_due";
  const title = input.transition === "started" ? "Service Started"
    : automatic ? "Service Completed Automatically" : "Service Completed";
  const body = `${recipient} — ${service} · ${input.transition === "started" ? "Started" : "Completed"} at ${timeLabel(timestamp)}`;
  const eventId = serviceTransitionEventId(input.transition, input.bookingId, timestamp);
  const common = {
    branchId: input.branchId,
    actorStaffId: input.actorStaffId,
    type: "booking_status_changed" as const,
    title,
    body,
    entityType: "booking",
    entityId: input.bookingId,
    priority: "normal" as const,
    requiresAction: false,
    metadata: {
      service_transition: input.transition,
      service_transition_event_id: eventId,
      service_transition_at: timestamp,
      service_completion_source: data.session_completion_source,
    },
  };
  await Promise.all([
    createNotificationOnce({
      ...common, targetWorkspace: "crm", actionHref: "/crm/bookings",
      dedupeKey: `${eventId}:crm:${input.branchId}`,
    }),
    createNotificationOnce({
      ...common, targetWorkspace: "manager", actionHref: "/manager/bookings",
      dedupeKey: `${eventId}:manager:${input.branchId}`,
    }),
    ...(data.staff_id ? [createNotificationOnce({
      ...common, targetWorkspace: "staff", recipientStaffId: data.staff_id,
      actionHref: "/staff-portal/today",
      dedupeKey: `${eventId}:staff:${data.staff_id}`,
    })] : []),
  ]);
  try {
    await drainServiceTransitionPushOutbox({ eventId, limit: 3 });
    // Each committed transition also gives older failed or automatic-completion
    // jobs a bounded retry opportunity without adding a browser privilege.
    await drainServiceTransitionPushOutbox({ limit: 3 });
  } catch (error) {
    logError("service_transition.push_retry_failed", { bookingId: input.bookingId, error });
  }
}
