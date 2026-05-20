import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

type StaffRow = Database["public"]["Tables"]["staff"]["Row"];
type BranchStaffCore = Pick<
  StaffRow,
  "id" | "full_name" | "tier" | "system_role" | "phone" | "is_active" | "branch_id"
>;
type BranchStaffLegacy = BranchStaffCore & Partial<Pick<StaffRow, "nickname">>;
type BranchStaff = BranchStaffCore &
  Pick<StaffRow, "nickname"> &
  Pick<StaffRow, "staff_type" | "is_head">;

function isMissingStaffOrgColumnsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('column staff.staff_type does not exist') ||
    m.includes('column "staff_type" does not exist') ||
    m.includes('column staff.is_head does not exist') ||
    m.includes('column "is_head" does not exist') ||
    m.includes('column staff.nickname does not exist') ||
    m.includes('column "nickname" does not exist') ||
    m.includes("could not find the 'is_head' column") ||
    m.includes("could not find the 'staff_type' column") ||
    m.includes("could not find the 'nickname' column")
  );
}

function normalizeBranchStaff(
  row: BranchStaffLegacy & Partial<Pick<BranchStaff, "staff_type" | "is_head">>
): BranchStaff {
  return {
    ...row,
    nickname: row.nickname ?? null,
    staff_type: row.staff_type ?? "therapist",
    is_head: row.is_head ?? false,
  };
}

export async function getStaffByBranch(branchId: string) {
  const supabase = await createClient();
  const primary = await supabase
    .from("staff")
    .select("id, full_name, nickname, tier, system_role, staff_type, is_head, phone, is_active, branch_id")
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

const STAFF_COLUMNS_LEGACY =
  "id, branch_id, auth_user_id, full_name, phone, tier, system_role, is_active, created_at, updated_at";

function injectStaffDefaults(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    nickname: (row.nickname as string | null | undefined) ?? null,
    staff_type: (row.staff_type as string) ?? "therapist",
    is_head: (row.is_head as boolean) ?? false,
  };
}

export async function getAllStaff() {
  const supabase = await createClient();
  const primary = await supabase
    .from("staff")
    .select("*, branches ( id, name )")
    .order("tier")
    .order("full_name")
    .limit(500);

  if (!primary.error) {
    return (primary.data ?? []).map((row) => injectStaffDefaults(row));
  }

  if (isMissingStaffOrgColumnsError(primary.error.message)) {
    const fallback = await supabase
      .from("staff")
      .select(`${STAFF_COLUMNS_LEGACY}, branches ( id, name )`)
      .order("tier")
      .order("full_name")
      .limit(500);

    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row) => injectStaffDefaults(row));
  }

  throw new Error(primary.error.message);
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

// ── Active staff for a branch WITH branches relation ──────────────────────
export async function getStaffByBranchWithBranches(branchId: string) {
  const supabase = await createClient();
  const primary = await supabase
    .from("staff")
    .select("*, branches ( id, name )")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("tier")
    .order("full_name");

  if (!primary.error) {
    return (primary.data ?? []).map((row) => injectStaffDefaults(row));
  }

  if (isMissingStaffOrgColumnsError(primary.error.message)) {
    const fallback = await supabase
      .from("staff")
      .select(`${STAFF_COLUMNS_LEGACY}, branches ( id, name )`)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("tier")
      .order("full_name");

    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row) => injectStaffDefaults(row));
  }

  throw new Error(primary.error.message);
}

// ── Pending staff for a branch (invite generated but not yet active) ───────
export async function getPendingStaffByBranch(branchId: string) {
  const supabase = await createClient();
  const primary = await supabase
    .from("staff")
    .select("*, branches ( id, name )")
    .eq("branch_id", branchId)
    .eq("is_active", false)
    .order("created_at", { ascending: false });

  if (!primary.error) {
    return (primary.data ?? []).map((row) => injectStaffDefaults(row));
  }

  if (isMissingStaffOrgColumnsError(primary.error.message)) {
    const fallback = await supabase
      .from("staff")
      .select(`${STAFF_COLUMNS_LEGACY}, branches ( id, name )`)
      .eq("branch_id", branchId)
      .eq("is_active", false)
      .order("created_at", { ascending: false });

    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row) => injectStaffDefaults(row));
  }

  throw new Error(primary.error.message);
}

// ── Pending staff (invite generated but not yet active) ───────────────────
export async function getPendingStaff() {
  const supabase = await createClient();
  const primary = await supabase
    .from("staff")
    .select("*, branches ( id, name )")
    .eq("is_active", false)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!primary.error) {
    return (primary.data ?? []).map((row) => injectStaffDefaults(row));
  }

  if (isMissingStaffOrgColumnsError(primary.error.message)) {
    const fallback = await supabase
      .from("staff")
      .select(`${STAFF_COLUMNS_LEGACY}, branches ( id, name )`)
      .eq("is_active", false)
      .order("created_at", { ascending: false })
      .limit(200);

    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row) => injectStaffDefaults(row));
  }

  throw new Error(primary.error.message);
}

// ── All branch staff with schedules, overrides, and blocked times ─────────
// Used by the manager Staff Availability setup page.
// Fetches overrides and blocked times scoped to the next 90 days.
export type StaffAvailabilityItem = {
  staff: {
    id: string;
    full_name: string;
    nickname: string | null;
    tier: string | null;
    staff_type: string | null;
    is_head: boolean | null;
    is_active: boolean;
  };
  schedules: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }>;
  overrides: Array<{
    id: string;
    override_date: string;
    is_day_off: boolean;
    start_time: string | null;
    end_time: string | null;
    reason: string | null;
  }>;
  blockedTimes: Array<{
    id: string;
    block_date: string;
    start_time: string;
    end_time: string;
    reason: string;
  }>;
};

async function buildAvailabilityItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  staffList: StaffAvailabilityItem["staff"][],
  today: string,
  future: string
): Promise<StaffAvailabilityItem[]> {
  if (staffList.length === 0) return [];
  const staffIds = staffList.map((s) => s.id);

  const [schedulesResult, overridesResult, blockedResult] = await Promise.all([
    supabase
      .from("staff_schedules")
      .select("id, staff_id, day_of_week, start_time, end_time, is_active")
      .in("staff_id", staffIds),
    supabase
      .from("schedule_overrides")
      .select("id, staff_id, override_date, is_day_off, start_time, end_time, reason")
      .in("staff_id", staffIds)
      .gte("override_date", today)
      .lte("override_date", future)
      .order("override_date"),
    supabase
      .from("blocked_times")
      .select("id, staff_id, block_date, start_time, end_time, reason")
      .in("staff_id", staffIds)
      .gte("block_date", today)
      .lte("block_date", future)
      .order("block_date")
      .order("start_time"),
  ]);

  const schedules = schedulesResult.data ?? [];
  const overrides = overridesResult.data ?? [];
  const blocked = blockedResult.data ?? [];

  return staffList.map((member) => ({
    staff: member,
    schedules: schedules
      .filter((s) => s.staff_id === member.id)
      .map((s) => ({
        id: s.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_active: s.is_active,
      })),
    overrides: overrides
      .filter((o) => o.staff_id === member.id)
      .map((o) => ({
        id: o.id,
        override_date: o.override_date,
        is_day_off: o.is_day_off,
        start_time: o.start_time ?? null,
        end_time: o.end_time ?? null,
        reason: o.reason ?? null,
      })),
    blockedTimes: blocked
      .filter((b) => b.staff_id === member.id)
      .map((b) => ({
        id: b.id,
        block_date: b.block_date,
        start_time: b.start_time,
        end_time: b.end_time,
        reason: b.reason ?? "other",
      })),
  }));
}

export async function getStaffWithAvailability(branchId: string): Promise<StaffAvailabilityItem[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;

  // Fetch all staff for the branch (active + inactive for full visibility)
  const staffResult = await supabase
    .from("staff")
    .select("id, full_name, nickname, tier, system_role, staff_type, is_head, is_active")
    .eq("branch_id", branchId)
    .order("tier")
    .order("full_name");

  if (staffResult.error) {
    // Graceful fallback: retry without newer org columns if migration not applied
    if (isMissingStaffOrgColumnsError(staffResult.error.message)) {
      const fallback = await supabase
        .from("staff")
        .select("id, full_name, tier, system_role, is_active")
        .eq("branch_id", branchId)
        .order("tier")
        .order("full_name");
      if (fallback.error) throw new Error(fallback.error.message);
      return buildAvailabilityItems(
        supabase,
        (fallback.data ?? []).map((r) => ({
          id: r.id,
          full_name: r.full_name,
          nickname: null,
          tier: r.tier ?? null,
          staff_type: "therapist",
          is_head: false,
          is_active: r.is_active,
        })),
        today,
        future
      );
    }
    throw new Error(staffResult.error.message);
  }

  const staffList = (staffResult.data ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    nickname: (r.nickname as string | null | undefined) ?? null,
    tier: r.tier ?? null,
    staff_type: (r.staff_type as string | null | undefined) ?? "therapist",
    is_head: (r.is_head as boolean | null | undefined) ?? false,
    is_active: r.is_active,
  }));

  return buildAvailabilityItems(supabase, staffList, today, future);
}
