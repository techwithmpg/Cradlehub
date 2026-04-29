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
    .select("id, full_name, phone, email, total_bookings, last_booking_date", { count: "exact" })
    .order("last_booking_date", { ascending: false, nullsFirst: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  return { customers: data ?? [], total: count ?? 0 };
}
