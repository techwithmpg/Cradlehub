import { createClient } from "@/lib/supabase/server";

export async function getAllBranches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBranchById(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("id", branchId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBranchServices(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branch_services")
    .select(`
      *,
      services (
        id, name, description, duration_minutes, price,
        buffer_before, buffer_after,
        service_categories ( id, name, display_order )
      )
    `)
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("id");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Branch with full detail (owner branch edit/detail page) ───────────────
// Returns everything the branch management page needs in one query:
// branch info + all services offered + all active staff.
// This avoids 3 separate calls from the UI.
export async function getBranchWithFullDetail(branchId: string) {
  const supabase = await createClient();

  const [branchResult, servicesResult, staffResult] = await Promise.all([
    supabase
      .from("branches")
      .select("*")
      .eq("id", branchId)
      .single(),

    supabase
      .from("branch_services")
      .select(`
        id, is_active, custom_price,
        services (
          id, name, description,
          duration_minutes, price,
          buffer_before, buffer_after,
          service_categories ( id, name, display_order )
        )
      `)
      .eq("branch_id", branchId)
      .order("is_active", { ascending: false }),

    supabase
      .from("staff")
      .select("id, full_name, tier, system_role, phone, is_active")
      .eq("branch_id", branchId)
      .order("tier")
      .order("full_name"),
  ]);

  if (branchResult.error) throw new Error(branchResult.error.message);

  return {
    branch:   branchResult.data,
    services: servicesResult.data ?? [],
    staff:    staffResult.data ?? [],
  };
}

// ── All branches with live summary stats (owner overview list) ────────────
// Returns each branch with:
//   - active_staff_count: how many therapists are currently active
//   - todays_bookings: number of non-cancelled bookings for today
// Used to render branch summary cards on the owner overview page.
export async function getBranchesOverview() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;

  const [branchesResult, staffCounts, bookingCounts] = await Promise.all([
    // All branches (including inactive so owner can reactivate)
    supabase
      .from("branches")
      .select("*")
      .order("name"),

    // Active staff count per branch
    supabase
      .from("staff")
      .select("branch_id")
      .eq("is_active", true),

    // Today's non-cancelled bookings per branch
    supabase
      .from("bookings")
      .select("branch_id")
      .eq("booking_date", today)
      .not("status", "in", '("cancelled","no_show")'),
  ]);

  if (branchesResult.error) throw new Error(branchesResult.error.message);

  const branches = branchesResult.data ?? [];
  const staff = staffCounts.data ?? [];
  const bookings = bookingCounts.data ?? [];

  // Build lookup maps
  const staffByBranch = staff.reduce<Record<string, number>>((acc, s) => {
    acc[s.branch_id] = (acc[s.branch_id] ?? 0) + 1;
    return acc;
  }, {});

  const bookingsByBranch = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.branch_id] = (acc[b.branch_id] ?? 0) + 1;
    return acc;
  }, {});

  return branches.map((b) => ({
    ...b,
    active_staff_count: staffByBranch[b.id] ?? 0,
    todays_bookings: bookingsByBranch[b.id] ?? 0,
  }));
}

// ── Branch slot config (used by booking flow) ─────────────────────────────
// Lightweight query — just what the booking flow needs to build the time grid.
export async function getBranchSlotConfig(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, slot_interval_minutes, is_active")
    .eq("id", branchId)
    .eq("is_active", true)
    .single();
  if (error) return null; // Branch not found or inactive
  return data;
}
