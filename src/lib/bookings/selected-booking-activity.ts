import type { WorkspaceBookingRow } from "@/components/features/bookings/booking-workspace-types";

export type SelectedBookingActivityEvent = {
  id: string;
  label: string;
  occurredAt: string;
  detail?: string;
  tone: "neutral" | "success" | "warning";
};

type TimelineDraft = Omit<SelectedBookingActivityEvent, "id">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? value : null;
}

function followupLabel(result: unknown): string | null {
  if (result === "confirmed") return "Confirmation recorded";
  if (result === "no_answer") return "No answer recorded";
  if (result === "confirm_later") return "Follow-up scheduled";
  if (result === "reschedule" || result === "rescheduled") {
    return "Booking rescheduled";
  }
  if (result === "cancel") return "Cancellation recorded";
  if (result === "staff_reassigned") return "Staff changed";
  return null;
}

function pushTimestampEvent(
  events: TimelineDraft[],
  occurredAt: string | null | undefined,
  label: string,
  tone: TimelineDraft["tone"] = "neutral",
  detail?: string
) {
  const timestamp = readTimestamp(occurredAt);
  if (!timestamp) return;
  events.push({ label, occurredAt: timestamp, tone, ...(detail ? { detail } : {}) });
}

function appendFollowupEvents(
  events: TimelineDraft[],
  metadata: Record<string, unknown>
) {
  const followup = metadata.crm_followup;
  if (!isRecord(followup)) return;
  const label = followupLabel(followup.result);
  if (!label) return;
  pushTimestampEvent(
    events,
    readTimestamp(followup.updated_at),
    label,
    followup.result === "no_answer" ? "warning" : "neutral"
  );
}

function appendRescheduleEvents(
  events: TimelineDraft[],
  metadata: Record<string, unknown>
) {
  const history = metadata.crm_reschedule_history;
  if (!Array.isArray(history)) return;
  for (const entry of history) {
    if (!isRecord(entry)) continue;
    const toDate = typeof entry.to_date === "string" ? entry.to_date : null;
    const toTime = typeof entry.to_time === "string" ? entry.to_time : null;
    const detail = toDate && toTime ? `Moved to ${toDate} at ${toTime.slice(0, 5)}` : undefined;
    pushTimestampEvent(
      events,
      readTimestamp(entry.updated_at),
      "Booking rescheduled",
      "neutral",
      detail
    );
  }
}

function appendStaffExceptionEvents(
  events: TimelineDraft[],
  metadata: Record<string, unknown>
) {
  const history = metadata.staff_schedule_exception_history;
  if (!Array.isArray(history)) return;
  for (const entry of history) {
    if (!isRecord(entry)) continue;
    pushTimestampEvent(
      events,
      readTimestamp(entry.resolved_at),
      "Staff schedule review resolved",
      "success"
    );
  }
}

export function deriveSelectedBookingActivity(
  booking: WorkspaceBookingRow
): SelectedBookingActivityEvent[] {
  const events: TimelineDraft[] = [];
  const metadata = booking.metadata ?? {};

  pushTimestampEvent(events, booking.created_at, "Booking created");
  pushTimestampEvent(events, booking.updated_at, "Booking updated");
  pushTimestampEvent(events, booking.checked_in_at, "Customer checked in", "success");
  pushTimestampEvent(events, booking.travel_started_at, "Travel started", "success");
  pushTimestampEvent(events, booking.arrived_at, "Customer or team arrived", "success");
  pushTimestampEvent(events, booking.session_started_at, "Service started", "success");
  pushTimestampEvent(events, booking.session_completed_at, "Service completed", "success");
  pushTimestampEvent(events, booking.no_show_at, "No-show recorded", "warning");
  appendFollowupEvents(events, metadata);
  appendRescheduleEvents(events, metadata);
  appendStaffExceptionEvents(events, metadata);

  const seen = new Set<string>();
  return events
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
    )
    .filter((event) => {
      const key = `${event.label}:${event.occurredAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((event, index) => ({
      ...event,
      id: `${event.label.toLowerCase().replaceAll(" ", "-")}-${event.occurredAt}-${index}`,
    }));
}
