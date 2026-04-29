import { createClient } from "@/lib/supabase/server";

export async function getStaffSchedule(staffId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_schedules")
    .select("*")
    .eq("staff_id", staffId)
    .order("day_of_week");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStaffOverrides(staffId: string, fromDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_overrides")
    .select("*")
    .eq("staff_id", staffId)
    .gte("override_date", fromDate)
    .order("override_date")
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// -- Blocked times for a staff member on a date range -----------------------
// Used by manager schedule view and staff portal weekly view.
export async function getBlockedTimes(staffId: string, fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_times")
    .select("*")
    .eq("staff_id", staffId)
    .gte("block_date", fromDate)
    .lte("block_date", toDate)
    .order("block_date")
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// -- All overrides for a branch's staff (manager weekly planning) -----------
export async function getBranchOverrides(branchId: string, fromDate: string, toDate: string) {
  const supabase = await createClient();

  const { data: staffRows, error: staffError } = await supabase
    .from("staff")
    .select("id")
    .eq("branch_id", branchId);
  if (staffError) throw new Error(staffError.message);

  const staffIds = (staffRows ?? []).map((r) => r.id);
  if (staffIds.length === 0) return [];

  const { data, error } = await supabase
    .from("schedule_overrides")
    .select("*, staff ( id, full_name )")
    .gte("override_date", fromDate)
    .lte("override_date", toDate)
    .in("staff_id", staffIds)
    .order("override_date");
  if (error) throw new Error(error.message);
  return data ?? [];
}
