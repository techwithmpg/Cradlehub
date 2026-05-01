"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyUpcomingBookings, getMyMonthlyStats } from "@/lib/queries/bookings";
import { getStaffSchedule, getStaffOverrides, getBlockedTimes } from "@/lib/queries/staff";
import { isDevAuthBypassEnabled, getDevBypassStaffRecord } from "@/lib/dev-bypass";
import {
  canTransitionHomeServiceTracking,
  type HomeServiceTrackingStatus,
} from "@/lib/home-service-tracking";
import type { StaffPortalBooking, StaffPortalStaff } from "@/components/features/staff-portal/types";

// ── Resolve authenticated staff record ────────────────────────────────────
async function getMyStaffRecord(): Promise<StaffPortalStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: me } = await supabase
    .from("staff")
    .select("id, full_name, tier, system_role, staff_type, branch_id")
    .eq("auth_user_id", user.id)
    .single();

  // Dev bypass: return a mock staff record so the portal renders
  // with empty data instead of crashing with "Unauthorized".
  if (!me && isDevAuthBypassEnabled()) {
    return getDevBypassStaffRecord();
  }

  if (!me) return null;
  return me;
}

// ── Today's bookings for the portal home ──────────────────────────────────
// IMPORTANT: customer select intentionally excludes phone and email (Rule 13).
// Staff should never see customer contact details through this portal.
export async function getMyTodayAction(date: string) {
  const supabase = await createClient();
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id, booking_date, start_time, end_time, type, status,
      home_service_tracking_status,
      travel_buffer_mins, metadata,
      travel_started_at, arrived_at, session_started_at, completed_at,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )
    `)
    .eq("staff_id", me.id)
    .eq("booking_date", date)
    .not("status", "in", '("cancelled","no_show")')
    .order("start_time");

  if (error) return { error: error.message };
  return { bookings: (data ?? []) as StaffPortalBooking[], staff: me };
}

// ── Home Service Tracking Result Type ─────────────────────────────────────
export type HomeServiceTrackingResult =
  | {
      ok: true;
      bookingId: string;
      status: HomeServiceTrackingStatus;
      timestamp: string;
    }
  | {
      ok: false;
      code:
        | "UNAUTHORIZED"
        | "NOT_FOUND"
        | "NOT_HOME_SERVICE"
        | "ALREADY_COMPLETED"
        | "INVALID_TRANSITION"
        | "DATABASE_ERROR";
      message: string;
    };

// ── Update home-service tracking stage ────────────────────────────────────
// Staff can progress their own home-service bookings through:
// not_started → travel_started → arrived → session_started → completed
export async function updateHomeServiceTrackingAction(
  bookingId: string,
  nextStatus: HomeServiceTrackingStatus
): Promise<HomeServiceTrackingResult> {
  const supabase = await createClient();
  const me = await getMyStaffRecord();
  if (!me) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You must be signed in to update tracking.",
    };
  }

  // Fetch the booking to validate pre-conditions
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, staff_id, type, status, home_service_tracking_status")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Booking not found.",
    };
  }

  // 1. Must be assigned to this staff
  if (booking.staff_id !== me.id) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "You are not assigned to this appointment.",
    };
  }

  // 2. Must be a home-service booking
  if (booking.type !== "home_service") {
    return {
      ok: false,
      code: "NOT_HOME_SERVICE",
      message: "This action is only available for home-service appointments.",
    };
  }

  // 3. Must not be cancelled or completed
  if (booking.status === "cancelled" || booking.status === "no_show") {
    return {
      ok: false,
      code: "ALREADY_COMPLETED",
      message: "This appointment has been cancelled.",
    };
  }

  if (booking.status === "completed") {
    return {
      ok: false,
      code: "ALREADY_COMPLETED",
      message: "This appointment has already been completed.",
    };
  }

  const currentStatus = booking.home_service_tracking_status as HomeServiceTrackingStatus;

  // 4. Transition must be valid
  if (!canTransitionHomeServiceTracking(currentStatus, nextStatus)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: getInvalidTransitionMessage(currentStatus, nextStatus),
    };
  }

  // 5. Execute via RPC (SECURITY DEFINER — staff do not have direct UPDATE on bookings)
  const { error: rpcError } = await supabase.rpc("update_home_service_tracking", {
    p_booking_id: bookingId,
    p_stage: nextStatus,
  });

  if (rpcError) {
    return {
      ok: false,
      code: "DATABASE_ERROR",
      message: rpcError.message,
    };
  }

  // 6. Fetch updated timestamp
  const timestampField = getTimestampColumn(nextStatus);
  const { data: updated, error: tsError } = await supabase
    .from("bookings")
    .select(timestampField)
    .eq("id", bookingId)
    .single();

  const timestamp = (updated?.[timestampField as keyof typeof updated] as string | null) ?? new Date().toISOString();

  if (tsError) {
    // Non-critical — tracking was updated, just return now()
    return {
      ok: true,
      bookingId,
      status: nextStatus,
      timestamp,
    };
  }

  return {
    ok: true,
    bookingId,
    status: nextStatus,
    timestamp,
  };
}

function getInvalidTransitionMessage(
  current: HomeServiceTrackingStatus,
  next: HomeServiceTrackingStatus
): string {
  if (current === "not_started" && next !== "travel_started") {
    return "You must start travel first.";
  }
  if (current === "travel_started" && next !== "arrived") {
    return "You can only mark arrived after starting travel.";
  }
  if (current === "arrived" && next !== "session_started") {
    return "You can only start the session after arriving.";
  }
  if (current === "session_started" && next !== "completed") {
    return "You can only complete after starting the session.";
  }
  if (current === "completed") {
    return "This appointment has already been completed.";
  }
  return "Invalid tracking transition.";
}

function getTimestampColumn(status: HomeServiceTrackingStatus): string {
  switch (status) {
    case "travel_started":
      return "travel_started_at";
    case "arrived":
      return "arrived_at";
    case "session_started":
      return "session_started_at";
    case "completed":
      return "completed_at";
    default:
      return "updated_at";
  }
}

// ── Weekly view — own bookings + schedule for the next 7 days ─────────────
export async function getMyWeekAction(fromDate: string, toDate: string) {
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };

  const [bookings, schedule, overrides, blocks] = await Promise.all([
    getMyUpcomingBookings(me.id, fromDate, toDate),
    getStaffSchedule(me.id),
    getStaffOverrides(me.id, fromDate),
    getBlockedTimes(me.id, fromDate, toDate),
  ]);

  return { bookings, schedule, overrides, blocks, staff: me };
}

// ── Personal stats for current month ─────────────────────────────────────
export async function getMyStatsAction(year: number, month: number) {
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };
  return getMyMonthlyStats(me.id, year, month);
}
