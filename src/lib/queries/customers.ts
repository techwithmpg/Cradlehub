import { createClient } from "@/lib/supabase/server";
import { normalizePagination, toPaginatedResult } from "@/lib/queries/pagination";
import type { PaginatedResult } from "@/lib/queries/pagination";

// Returns distinct customer IDs that have at least one booking at the given branch.
// Used for branch-scoping all CRM customer queries (customers table has no branch_id).
async function branchCustomerIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("bookings")
    .select("customer_id")
    .eq("branch_id", branchId)
    .not("customer_id", "is", null);
  return [
    ...new Set(
      (data ?? [])
        .map((b) => b.customer_id)
        .filter((id): id is string => id !== null)
    ),
  ];
}

export async function searchCustomers(query: string, branchId?: string | null) {
  const supabase = await createClient();

  let ids: string[] | undefined;
  if (branchId) {
    const fetched = await branchCustomerIds(supabase, branchId);
    if (fetched.length === 0) return [];
    ids = fetched;
  }

  const q = supabase
    .from("customers")
    .select("id, full_name, phone, email, total_bookings, last_booking_date")
    .or(`phone.ilike.${query}%,full_name.ilike.%${query}%`)
    .order("last_booking_date", { ascending: false })
    .limit(20);

  const { data, error } = await (ids ? q.in("id", ids) : q);
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

export async function getAllCustomers(
  page = 1,
  pageSize = 20,
  branchId?: string | null
) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;

  let ids: string[] | undefined;
  if (branchId) {
    const fetched = await branchCustomerIds(supabase, branchId);
    if (fetched.length === 0) return { customers: [], total: 0 };
    ids = fetched;
  }

  const q = supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, last_booking_date, first_booking_date, preferred_staff_id, notes, staff!preferred_staff_id ( id, full_name )",
      { count: "exact" }
    )
    .order("last_booking_date", { ascending: false, nullsFirst: false })
    .range(from, from + pageSize - 1);

  const { data, error, count } = await (ids ? q.in("id", ids) : q);
  if (error) throw new Error(error.message);
  return { customers: data ?? [], total: count ?? 0 };
}

// ── Repeat customers (CRM priority list) ──────────────────────────────────
export async function getRepeatCustomers(
  minBookings = 3,
  page        = 1,
  pageSize    = 20,
  branchId?: string | null
) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;

  let ids: string[] | undefined;
  if (branchId) {
    const fetched = await branchCustomerIds(supabase, branchId);
    if (fetched.length === 0) return { customers: [], total: 0 };
    ids = fetched;
  }

  const q = supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, last_booking_date, first_booking_date, notes",
      { count: "exact" }
    )
    .gte("total_bookings", minBookings)
    .order("total_bookings", { ascending: false })
    .range(from, from + pageSize - 1);

  const { data, error, count } = await (ids ? q.in("id", ids) : q);
  if (error) throw new Error(error.message);
  return { customers: data ?? [], total: count ?? 0 };
}

// ── Lapsed customers — haven't visited in N days ───────────────────────────
export async function getLapsedCustomers(
  daysSinceLastVisit = 30,
  pageSize           = 20,
  branchId?: string | null
) {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysSinceLastVisit);
  const cutoffStr = cutoff.toISOString().split("T")[0]!;

  let ids: string[] | undefined;
  if (branchId) {
    const fetched = await branchCustomerIds(supabase, branchId);
    if (fetched.length === 0) return [];
    ids = fetched;
  }

  const q = supabase
    .from("customers")
    .select("id, full_name, phone, total_bookings, last_booking_date")
    .lt("last_booking_date", cutoffStr)
    .gte("total_bookings", 1)
    .order("last_booking_date", { ascending: true })
    .limit(pageSize);

  const { data, error } = await (ids ? q.in("id", ids) : q);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── CRM dashboard stats ───────────────────────────────────────────────────
export async function getCrmStats(branchId?: string | null) {
  const supabase = await createClient();

  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().split("T")[0]!;

  let ids: string[] | undefined;
  if (branchId) {
    const fetched = await branchCustomerIds(supabase, branchId);
    if (fetched.length === 0) {
      return { total: 0, repeat: 0, lapsed: 0, newThisMonth: 0, totalVisits: 0 };
    }
    ids = fetched;
  }

  const [
    totalResult,
    repeatResult,
    lapsedResult,
    newThisMonthResult,
    totalVisitsResult,
  ] = await Promise.all([
    ids
      ? supabase.from("customers").select("id", { count: "exact", head: true }).in("id", ids)
      : supabase.from("customers").select("id", { count: "exact", head: true }),
    ids
      ? supabase.from("customers").select("id", { count: "exact", head: true }).gte("total_bookings", 2).in("id", ids)
      : supabase.from("customers").select("id", { count: "exact", head: true }).gte("total_bookings", 2),
    ids
      ? supabase.from("customers").select("id", { count: "exact", head: true }).lt("last_booking_date", cutoff30Str).gte("total_bookings", 1).in("id", ids)
      : supabase.from("customers").select("id", { count: "exact", head: true }).lt("last_booking_date", cutoff30Str).gte("total_bookings", 1),
    ids
      ? supabase.from("customers").select("id", { count: "exact", head: true }).gte("first_booking_date", monthStart).in("id", ids)
      : supabase.from("customers").select("id", { count: "exact", head: true }).gte("first_booking_date", monthStart),
    ids
      ? supabase.from("customers").select("total_bookings").in("id", ids)
      : supabase.from("customers").select("total_bookings"),
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
// Not branch-scoped: front desk may look up any customer to pre-fill a booking.
// ── Paginated customer list with optional search and branch scoping ────────
// Owners pass branchId=null to see all customers.
// Because customers has no branch_id, scoping goes through bookings (see branchCustomerIds).
export type CustomerPageRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  total_bookings: number;
  last_booking_date: string | null;
  first_booking_date: string | null;
  preferred_staff_id: string | null;
  notes: string | null;
  staff?: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
};

export async function getCustomersPage(params: {
  branchId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<CustomerPageRow>> {
  const { page, pageSize, from, to } = normalizePagination(
    { page: params.page, pageSize: params.pageSize },
    { defaultPageSize: 25, maxPageSize: 100 }
  );

  const supabase = await createClient();

  let ids: string[] | undefined;
  if (params.branchId) {
    const fetched = await branchCustomerIds(supabase, params.branchId);
    if (fetched.length === 0) {
      return toPaginatedResult({ data: [], count: 0, page, pageSize });
    }
    ids = fetched;
  }

  let q = supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, last_booking_date, first_booking_date, preferred_staff_id, notes, staff!preferred_staff_id ( id, full_name )",
      { count: "exact" }
    )
    .order("last_booking_date", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (params.search) {
    const term = params.search.replace(/[%_]/g, "\\$&");
    q = q.or(`phone.ilike.${term}%,full_name.ilike.%${term}%`);
  }
  if (ids) {
    q = q.in("id", ids);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return toPaginatedResult({ data: (data ?? []) as CustomerPageRow[], count, page, pageSize });
}

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
