import { createClient } from "@/lib/supabase/server";

export async function searchCustomers(query: string) {
  const supabase = await createClient();
  // Search by phone (exact prefix) OR name (case-insensitive)
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, email, total_bookings, last_booking_date")
    .or(`phone.ilike.${query}%,full_name.ilike.%${query}%`)
    .order("last_booking_date", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCustomerById(customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*, staff ( id, full_name, tier )")
    .eq("id", customerId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getAllCustomers(page = 1, pageSize = 20) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, last_booking_date, first_booking_date, preferred_staff_id, notes, staff!preferred_staff_id ( id, full_name )",
      { count: "exact" }
    )
    .order("last_booking_date", { ascending: false, nullsFirst: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  return { customers: data ?? [], total: count ?? 0 };
}

// ── Repeat customers (CRM priority list) ──────────────────────────────────
export async function getRepeatCustomers(
  minBookings = 3,
  page        = 1,
  pageSize    = 20
) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, last_booking_date, first_booking_date, notes",
      { count: "exact" }
    )
    .gte("total_bookings", minBookings)
    .order("total_bookings", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  return { customers: data ?? [], total: count ?? 0 };
}

// ── Lapsed customers — haven't visited in N days ───────────────────────────
export async function getLapsedCustomers(
  daysSinceLastVisit = 30,
  pageSize           = 20
) {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysSinceLastVisit);
  const cutoffStr = cutoff.toISOString().split("T")[0]!;

  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, total_bookings, last_booking_date")
    .lt("last_booking_date", cutoffStr)
    .gte("total_bookings", 1)
    .order("last_booking_date", { ascending: true })
    .limit(pageSize);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── CRM dashboard stats ───────────────────────────────────────────────────
export async function getCrmStats() {
  const supabase = await createClient();

  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().split("T")[0]!;

  const [
    totalResult,
    repeatResult,
    lapsedResult,
    newThisMonthResult,
    totalVisitsResult,
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }).gte("total_bookings", 2),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .lt("last_booking_date", cutoff30Str)
      .gte("total_bookings", 1),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("first_booking_date", monthStart),
    supabase.from("customers").select("total_bookings"),
  ]);

  return {
    total:       totalResult.count       ?? 0,
    repeat:      repeatResult.count      ?? 0,
    lapsed:      lapsedResult.count      ?? 0,
    newThisMonth: newThisMonthResult.count ?? 0,
    totalVisits: (totalVisitsResult.data ?? []).reduce((sum, c) => sum + (c.total_bookings ?? 0), 0),
  };
}

// ── Quick phone lookup (front desk pre-fill) ───────────────────────────────
// Returns null if not found — never throws a "not found" error.
export async function lookupCustomerByPhone(phone: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, last_booking_date, preferred_staff_id"
    )
    .eq("phone", phone.replace(/\s/g, ""))
    .maybeSingle();
  return data ?? null;
}
