"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyUpcomingBookings, getMyMonthlyStats } from "@/lib/queries/bookings";
import { getStaffSchedule, getStaffOverrides, getBlockedTimes } from "@/lib/queries/staff";
import { isDevAuthBypassEnabled, getDevBypassStaffRecord } from "@/lib/dev-bypass";
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

// ── Update home-service tracking stage ────────────────────────────────────
// Staff can progress their own home-service bookings through:
// travel_started → arrived → session_started → completed
export async function updateHomeServiceTrackingAction(bookingId: string, stage: string) {
  const supabase = await createClient();
  const me = await getMyStaffRecord();
  if (!me) return { error: "Unauthorized" };

  const { error } = await supabase.rpc("update_home_service_tracking", {
    p_booking_id: bookingId,
    p_stage: stage,
  });

  if (error) {
    return { error: error.message };
  }
  return { ok: true };
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
