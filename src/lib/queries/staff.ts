import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type BranchStaffLegacy = Pick<
  StaffRow,
  "id" | "full_name" | "tier" | "system_role" | "phone" | "is_active" | "branch_id"
>;
type BranchStaff = BranchStaffLegacy &
  Pick<StaffRow, "staff_type" | "is_head">;

function isMissingStaffOrgColumnsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('column staff.staff_type does not exist') ||
    m.includes('column "staff_type" does not exist') ||
    m.includes('column staff.is_head does not exist') ||
    m.includes('column "is_head" does not exist')
  );
}

function normalizeBranchStaff(
  row: BranchStaffLegacy & Partial<Pick<BranchStaff, "staff_type" | "is_head">>
): BranchStaff {
  return {
    ...row,
    staff_type: row.staff_type ?? "therapist",
    is_head: row.is_head ?? false,
  };
}

export async function getStaffByBranch(branchId: string) {
  const supabase = await createClient();
  const primary = await supabase
    .from("staff")
    .select("id, full_name, tier, system_role, staff_type, is_head, phone, is_active, branch_id")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("tier")
    .order("full_name");

  if (!primary.error) {
    return (primary.data ?? []).map((row) => normalizeBranchStaff(row));
  }

  // Backward compatibility: if DB migrations adding staff_type/is_head
  // are not yet applied, retry with legacy columns and inject defaults.
  if (isMissingStaffOrgColumnsError(primary.error.message)) {
    const fallback = await supabase
      .from("staff")
      .select("id, full_name, tier, system_role, phone, is_active, branch_id")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("tier")
      .order("full_name");

    if (fallback.error) throw new Error(fallback.error.message);

    return (fallback.data ?? []).map((row) => normalizeBranchStaff(row));
  }

  throw new Error(primary.error.message);
}

export async function getAllStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("*, branches ( id, name )")
    .order("tier")
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStaffServices(staffId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("service_id")
    .eq("staff_id", staffId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.service_id);
}

export async function getStaffIdsByService(serviceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id")
    .eq("service_id", serviceId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.staff_id);
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

// ── Pending staff (invite generated but not yet active) ───────────────────
export async function getPendingStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("*, branches ( id, name )")
    .eq("is_active", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Staff record for onboarding claim verification ────────────────────────
export async function getStaffForOnboard(staffId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, auth_user_id, is_active, created_at, branch_id, branches ( id, name )")
    .eq("id", staffId)
    .single();
  if (error) return null;
  return data;
}
