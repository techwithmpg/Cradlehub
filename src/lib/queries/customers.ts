import { createClient } from "@/lib/supabase/server";

export async function getAllCustomers(page = 1, pageSize = 20) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, first_booking_date, last_booking_date, notes, preferred_staff_id, created_at",
      { count: "exact" }
    )
    .order("last_booking_date", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { customers: data ?? [], total: count ?? 0 };
}

export async function searchCustomers(query: string, limit = 20) {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, first_booking_date, last_booking_date, notes, preferred_staff_id"
    )
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .order("last_booking_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCustomerById(customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, first_booking_date, last_booking_date, notes, preferred_staff_id, created_at"
    )
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// -- Repeat customers (3+ completed bookings) -- CRM priority list ----------
export async function getRepeatCustomers(minBookings = 3, page = 1, pageSize = 20) {
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

// -- Customers who haven't visited in 30+ days (re-engagement list) ---------
export async function getLapsedCustomers(daysSinceLastVisit = 30, pageSize = 20) {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysSinceLastVisit);
  const cutoffStr = cutoff.toISOString().split("T")[0]!;

  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, total_bookings, last_booking_date")
    .lt("last_booking_date", cutoffStr)
    .gte("total_bookings", 1) // exclude customers who never completed a booking
    .order("last_booking_date", { ascending: true })
    .limit(pageSize);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// -- Quick phone lookup (front desk walk-in) --------------------------------
// Returns a single customer by exact phone or null if not found.
// Called from the walk-in form to pre-fill customer details.
export async function lookupCustomerByPhone(phone: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, phone, email, total_bookings, last_booking_date, preferred_staff_id")
    .eq("phone", phone.replace(/\s/g, ""))
    .maybeSingle(); // returns null if not found, no error
  return data ?? null;
}
