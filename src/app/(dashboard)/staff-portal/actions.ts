"use server";

import { createClient } from "@/lib/supabase/server";
import { getMyBookings } from "@/lib/queries/bookings";
import { getStaffSchedule, getStaffOverrides } from "@/lib/queries/staff";

export async function getMyPortalData(date: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: me } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!me) return { error: "Staff record not found" };

  const [bookings, schedule, overrides] = await Promise.all([
    getMyBookings(me.id, date),
    getStaffSchedule(me.id),
    getStaffOverrides(me.id, date),
  ]);

  return { bookings, schedule, overrides };
}
