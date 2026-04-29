import { createClient } from "@/lib/supabase/server";

export async function getStaffByBranch(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, full_name, tier, system_role, phone, is_active, branch_id")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("tier, full_name"); // senior first within branch
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("*, branches ( id, name )")
    .order("branches(name), tier, full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStaffSchedule(staffId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_schedules")
    .select("*")
    .eq("staff_id", staffId)
    .eq("is_active", true)
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
    .order("override_date");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Blocked times for a staff member over a date range ────────────────────
export async function getBlockedTimes(
  staffId:  string,
  fromDate: string,
  toDate:   string
) {
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
