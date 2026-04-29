"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyMonthlyStats, getMyUpcomingBookings } from "@/lib/queries/bookings";
import { getBlockedTimes, getStaffOverrides, getStaffSchedule } from "@/lib/queries/staff";

// -- Auth helper: any authenticated staff member -----------------------------
async function getStaffId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from("staff")
    .select("id, full_name, tier, system_role, branch_id")
    .eq("auth_user_id", user.id)
    .single();
  return me ?? null;
}

// -- Today's bookings for the staff portal home -----------------------------
// Does NOT include customer phone/email (Rule 13)
export async function getMyTodayAction(date: string) {
  const supabase = await createClient();
  const me = await getStaffId();
  if (!me) return { error: "Unauthorized" };

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id, booking_date, start_time, end_time, type, status,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )             -- phone/email intentionally excluded
    `
    )
    .eq("staff_id", me.id)
    .eq("booking_date", date)
    .not("status", "in", '("cancelled","no_show")')
    .order("start_time");
  if (error) return { error: error.message };
  return { bookings: data ?? [], staff: me };
}

// -- Weekly schedule: own bookings + schedule for the next 7 days -----------
export async function getMyWeekAction(fromDate: string, toDate: string) {
  const me = await getStaffId();
  if (!me) return { error: "Unauthorized" };

  const [bookings, schedule, overrides, blocks] = await Promise.all([
    getMyUpcomingBookings(me.id, fromDate, toDate),
    getStaffSchedule(me.id),
    getStaffOverrides(me.id, fromDate),
    getBlockedTimes(me.id, fromDate, toDate),
  ]);

  return { bookings, schedule, overrides, blocks, staff: me };
}

// -- Personal stats for current month ---------------------------------------
export async function getMyStatsAction(year: number, month: number) {
  const me = await getStaffId();
  if (!me) return { error: "Unauthorized" };
  return getMyMonthlyStats(me.id, year, month);
}
