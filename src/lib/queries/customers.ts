import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePagination, toPaginatedResult } from "@/lib/queries/pagination";
import type { PaginatedResult } from "@/lib/queries/pagination";

// Request-cached distinct customer IDs for a branch so getCustomersPage + getCrmStats share 1 lookup
const getCachedBranchCustomerIds = cache(async (branchId: string): Promise<string[]> => {
  const supabase = await createClient();
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
});

export async function searchCustomers(query: string, branchId?: string | null) {
  const supabase = await createClient();

  let ids: string[] | undefined;
  if (branchId) {
    const fetched = await getCachedBranchCustomerIds(branchId);
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

export async function searchCustomerIdentities(query: string) {
  const term = query.trim().slice(0, 80);
  if (term.length < 2) return [];
  const admin = createAdminClient();
  const phoneTerm = term.replace(/\D/g, "");
  const byPhone = phoneTerm.length >= 7 && /^[+\d\s()-]+$/.test(term);
  const search = admin
    .from("customers")
    .select("id, full_name, phone")
    .order("full_name", { ascending: true })
    .limit(10);
  const { data, error } = byPhone
    ? await search.ilike("phone", `${phoneTerm}%`)
    : await search.ilike("full_name", `%${term.replace(/[%_]/g, "\\$&")}%`);
  if (error) throw new Error("Customer identity search failed.");
  return (data ?? []).map((customer) => ({
    id: customer.id,
    full_name: customer.full_name,
    phone_suffix: customer.phone?.replace(/\D/g, "").slice(-4) ?? "",
  }));
}

export async function getCustomerById(customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*, staff ( id, full_name, nickname, tier )")
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
    const fetched = await getCachedBranchCustomerIds(branchId);
    if (fetched.length === 0) return { customers: [], total: 0 };
    ids = fetched;
  }

  const q = supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, last_booking_date, first_booking_date, preferred_staff_id, notes, staff!preferred_staff_id ( id, full_name, nickname )",
      { count: "exact" }
    )
    .order("last_booking_date", { ascending: false, nullsFirst: false })
    .range(from, from + pageSize - 1);

  const { data, error, count } = await (ids ? q.in("id", ids) : q);
  if (error) throw new Error(error.message);
  return { customers: data ?? [], total: count ?? 0 };
}

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
    const fetched = await getCachedBranchCustomerIds(branchId);
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
    const fetched = await getCachedBranchCustomerIds(branchId);
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

// Single-pass CRM stats computation (1 query instead of 5 separate COUNT queries)
export async function getCrmStats(branchId?: string | null) {
  const supabase = await createClient();

  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().split("T")[0]!;

  let ids: string[] | undefined;
  if (branchId) {
    const fetched = await getCachedBranchCustomerIds(branchId);
    if (fetched.length === 0) {
      return { total: 0, repeat: 0, lapsed: 0, newThisMonth: 0, totalVisits: 0 };
    }
    ids = fetched;
  }

  const q = supabase
    .from("customers")
    .select("total_bookings, last_booking_date, first_booking_date");

  const { data } = await (ids ? q.in("id", ids) : q);
  const rows = data ?? [];

  let repeat = 0;
  let lapsed = 0;
  let newThisMonth = 0;
  let totalVisits = 0;

  for (const c of rows) {
    const tb = c.total_bookings ?? 0;
    totalVisits += tb;
    if (tb >= 2) repeat++;
    if (tb >= 1 && c.last_booking_date && c.last_booking_date < cutoff30Str) lapsed++;
    if (c.first_booking_date && c.first_booking_date >= monthStart) newThisMonth++;
  }

  return {
    total: rows.length,
    repeat,
    lapsed,
    newThisMonth,
    totalVisits,
  };
}

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
    const fetched = await getCachedBranchCustomerIds(params.branchId);
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
  const normalized = phone.replace(/\s/g, "");
  if (normalized.replace(/\D/g, "").length < 7) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("id, full_name, phone, email")
    .eq("phone", normalized)
    .maybeSingle();
  if (error) throw new Error("Customer phone lookup failed.");
  return data ?? null;
}
