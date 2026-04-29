import { createClient } from "@/lib/supabase/server";

// Full booking with all related data
const BOOKING_SELECT = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata, created_at, updated_at,
  branches   ( id, name ),
  services   ( id, name, duration_minutes ),
  staff      ( id, full_name, tier ),
  customers  ( id, full_name, phone, email )
`;

export async function getBookingsByBranch(
  branchId: string,
  date: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("branch_id", branchId)
    .eq("booking_date", date)
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllBookings(filters?: {
  branchId?: string;
  date?: string;
  status?: string;
  type?: string;
}) {
  const supabase = await createClient();
  let q = supabase.from("bookings").select(BOOKING_SELECT);
  if (filters?.branchId) q = q.eq("branch_id", filters.branchId);
  if (filters?.date)     q = q.eq("booking_date", filters.date);
  if (filters?.status)   q = q.eq("status", filters.status);
  if (filters?.type)     q = q.eq("type", filters.type);
  const { data, error } = await q.order("booking_date", { ascending: false }).order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBookingById(bookingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(`${BOOKING_SELECT}, booking_events ( * )`)
    .eq("id", bookingId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBookingsByCustomer(customerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("customer_id", customerId)
    .order("booking_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMyBookings(staffId: string, date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("staff_id", staffId)
    .eq("booking_date", date)
    .not("status", "in", '("cancelled","no_show")')
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}
