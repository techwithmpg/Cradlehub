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
  staffId?: string;
}) {
  const supabase = await createClient();
  let q = supabase.from("bookings").select(BOOKING_SELECT);
  if (filters?.branchId) q = q.eq("branch_id", filters.branchId);
  if (filters?.date)     q = q.eq("booking_date", filters.date);
  if (filters?.status)   q = q.eq("status", filters.status);
  if (filters?.type)     q = q.eq("type", filters.type);
  if (filters?.staffId)  q = q.eq("staff_id", filters.staffId);
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

// ── Today's full branch schedule (manager timeline view) ──────────────────
export async function getTodaysSchedule(branchId: string, date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id, booking_date, start_time, end_time, type, status,
      travel_buffer_mins, metadata,
      services  ( id, name, duration_minutes ),
      staff     ( id, full_name, tier ),
      customers ( id, full_name, phone )
    `)
    .eq("branch_id", branchId)
    .eq("booking_date", date)
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── 7-day schedule for manager planning view ──────────────────────────────
export async function getWeekSchedule(
  branchId: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id, booking_date, start_time, end_time, type, status,
      services ( id, name, duration_minutes ),
      staff    ( id, full_name, tier ),
      customers( id, full_name )
    `)
    .eq("branch_id", branchId)
    .gte("booking_date", startDate)
    .lte("booking_date", endDate)
    .not("status", "in", '("cancelled","no_show")')
    .order("booking_date")
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Manager dashboard stats for today ─────────────────────────────────────
export async function getManagerDashboardStats(branchId: string, date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("status")
    .eq("branch_id", branchId)
    .eq("booking_date", date);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    total:       rows.length,
    confirmed:   rows.filter((r) => r.status === "confirmed").length,
    in_progress: rows.filter((r) => r.status === "in_progress").length,
    completed:   rows.filter((r) => r.status === "completed").length,
    cancelled:   rows.filter((r) => r.status === "cancelled").length,
    no_show:     rows.filter((r) => r.status === "no_show").length,
  };
}

// ── Owner cross-branch booking list with filters ───────────────────────────
export async function getAllBookingsOwner(filters?: {
  branchId?: string;
  staffId?:  string;
  fromDate?: string;
  toDate?:   string;
  status?:   string;
  type?:     string;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("bookings")
    .select(`
      id, booking_date, start_time, end_time, type, status,
      travel_buffer_mins, metadata, created_at,
      branches  ( id, name ),
      services  ( id, name, duration_minutes ),
      staff     ( id, full_name, tier ),
      customers ( id, full_name, phone )
    `);

  if (filters?.branchId) q = q.eq("branch_id", filters.branchId);
  if (filters?.staffId)  q = q.eq("staff_id",  filters.staffId);
  if (filters?.status)   q = q.eq("status",    filters.status);
  if (filters?.type)     q = q.eq("type",      filters.type);
  if (filters?.fromDate) q = q.gte("booking_date", filters.fromDate);
  if (filters?.toDate)   q = q.lte("booking_date", filters.toDate);

  const { data, error } = await q
    .order("booking_date", { ascending: false })
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Staff: own upcoming bookings — NO customer phone/email (Rule 13) ───────
export async function getMyUpcomingBookings(
  staffId:  string,
  fromDate: string,
  toDate:   string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id, booking_date, start_time, end_time, type, status, metadata,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )
    `)
    .eq("staff_id", staffId)
    .gte("booking_date", fromDate)
    .lte("booking_date", toDate)
    .not("status", "in", '("cancelled","no_show")')
    .order("booking_date")
    .order("start_time");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Staff: personal monthly stats (Rule 14: uses metadata.price_paid) ─────
export async function getMyMonthlyStats(
  staffId: string,
  year:    number,
  month:   number
) {
  const supabase = await createClient();
  const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate   = new Date(year, month, 0).toISOString().split("T")[0]!;

  const { data, error } = await supabase
    .from("bookings")
    .select("status, metadata")
    .eq("staff_id", staffId)
    .gte("booking_date", fromDate)
    .lte("booking_date", toDate);
  if (error) throw new Error(error.message);

  const rows      = data ?? [];
  const completed = rows.filter((r) => r.status === "completed");
  const revenue   = completed.reduce((sum, r) => {
    return sum + Number((r.metadata as Record<string, unknown>)?.["price_paid"] ?? 0);
  }, 0);

  return {
    total_assigned:    rows.length,
    completed:         completed.length,
    cancelled:         rows.filter((r) => r.status === "cancelled").length,
    no_show:           rows.filter((r) => r.status === "no_show").length,
    revenue_generated: revenue,
  };
}
