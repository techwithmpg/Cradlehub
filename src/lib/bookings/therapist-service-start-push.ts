import "server-only";

import { logError, logInfo } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationOnce } from "@/lib/notifications/workflow-notifications-store";
import {
  isTherapistStartPushEligible,
  scheduledStartMs,
  type ServiceStartCandidate,
} from "@/lib/bookings/service-start-reminders";

type Candidate = ServiceStartCandidate & {
  branch_id: string;
  staff_id: string;
  resource_id: string;
};

const LEAD_MS = 2 * 60_000;
const PAGE_LIMIT = 201;

function manilaSlot(ms: number): { date: string; time: string } {
  const local = new Date(ms + 8 * 60 * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 19) };
}

function reminderKey(row: Candidate): string {
  return ["therapist-service-start", row.id, row.booking_date, row.start_time, row.staff_id].join(":");
}

/**
 * Independently scheduled, service-role-only two-minute phone push.
 * No booking or attendance state is mutated and no scheduler is registered here.
 */
export async function runTherapistServiceStartPush(input: { now?: Date } = {}) {
  const nowMs = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid reminder server time");

  const lower = manilaSlot(nowMs);
  const upper = manilaSlot(nowMs + LEAD_MS);
  const days = [...new Set([lower.date, upper.date])];
  const admin = createAdminClient();
  const select = "id, branch_id, staff_id, resource_id, booking_date, start_time, status, booking_progress_status, session_started_at, delivery_type";

  const pages = await Promise.all(days.map(async (date) => {
    let query = admin.from("bookings")
      .select(select)
      .eq("booking_date", date)
      .eq("status", "confirmed")
      .not("staff_id", "is", null)
      .not("resource_id", "is", null)
      .is("session_started_at", null);
    if (date === lower.date) query = query.gte("start_time", lower.time);
    if (date === upper.date) query = query.lte("start_time", upper.time);
    return query.order("start_time").limit(PAGE_LIMIT);
  }));

  const failure = pages.find((page) => page.error);
  if (failure?.error) {
    logError("service_start_push.scan_failed", { error: failure.error });
    throw failure.error;
  }
  if (pages.some((page) => (page.data?.length ?? 0) === PAGE_LIMIT)) {
    logError("service_start_push.scan_limit_reached");
    throw new Error("Service start reminder scan exceeded safe page limit");
  }

  let eligible = 0;
  let processed = 0;
  let stale = 0;
  for (const candidate of pages.flatMap((page) => page.data ?? []) as Candidate[]) {
    if (!isTherapistStartPushEligible(candidate, nowMs)) continue;
    eligible += 1;

    // Re-read immediately before queuing, so a newly started, reassigned or
    // rescheduled booking is not knowingly sent to the previous therapist.
    const fresh = await admin.from("bookings").select(select)
      .eq("id", candidate.id).maybeSingle();
    if (fresh.error) throw fresh.error;
    const booking = fresh.data as Candidate | null;
    if (!booking ||
      booking.branch_id !== candidate.branch_id ||
      booking.staff_id !== candidate.staff_id ||
      booking.booking_date !== candidate.booking_date ||
      booking.start_time !== candidate.start_time ||
      !isTherapistStartPushEligible(booking, input.now ? nowMs : Date.now())) {
      stale += 1;
      continue;
    }

    const startMs = scheduledStartMs(booking);
    const scheduledAt = new Date(startMs).toISOString();
    const timeLabel = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(startMs));

    const ok = await createNotificationOnce({
      branchId: booking.branch_id,
      targetWorkspace: "staff",
      recipientStaffId: booking.staff_id,
      type: "booking_status_changed",
      title: "Service starting soon",
      body: "Your assigned treatment starts at " + timeLabel + ". Open Staff Portal to review.",
      entityType: "booking",
      entityId: booking.id,
      actionHref: "/staff-portal/service-progress",
      priority: "normal",
      requiresAction: false,
      dedupeKey: reminderKey(booking),
      metadata: {
        service_start_reminder: true,
        scheduled_start_at: scheduledAt,
        expires_at: new Date(startMs + 2 * 60_000).toISOString(),
      },
    });
    if (!ok) {
      logError("service_start_push.persist_failed", { bookingId: booking.id });
      throw new Error("Service start push reminder could not be persisted");
    }
    processed += 1;
  }

  logInfo("service_start_push.run_completed", { eligible, processed, stale });
  return { eligible, processed, stale };
}
