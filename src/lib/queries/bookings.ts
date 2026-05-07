import { createClient } from "@/lib/supabase/server";
import { attachBranchResources } from "@/lib/queries/booking-resources";

// Full booking with all related data
const BOOKING_SELECT = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata, created_at, updated_at,
  resource_id,
  branches   ( id, name ),
  services   ( id, name, duration_minutes ),
  staff      ( id, full_name, tier ),
  customers  ( id, full_name, phone, email )
`;

const BOOKING_SELECT_CORE = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata, created_at, updated_at,
  branches   ( id, name ),
  services   ( id, name, duration_minutes ),
  staff      ( id, full_name, tier ),
  customers  ( id, full_name, phone, email )
`;

const BOOKING_SELECT_WITH_PAYMENTS = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata, created_at, updated_at,
  payment_method, payment_status, payment_reference, amount_paid,
  resource_id,
  branches   ( id, name ),
  services   ( id, name, duration_minutes ),
  staff      ( id, full_name, tier ),
  customers  ( id, full_name, phone, email )
`;

const BOOKING_SELECT_WITH_PAYMENTS_NO_RESOURCE = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata, created_at, updated_at,
  payment_method, payment_status, payment_reference, amount_paid,
  branches   ( id, name ),
  services   ( id, name, duration_minutes ),
  staff      ( id, full_name, tier ),
  customers  ( id, full_name, phone, email )
`;

const TODAY_SCHEDULE_SELECT = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata,
  resource_id,
  services  ( id, name, duration_minutes ),
  staff     ( id, full_name, tier ),
  customers ( id, full_name, phone )
`;

const TODAY_SCHEDULE_SELECT_CORE = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata,
  services  ( id, name, duration_minutes ),
  staff     ( id, full_name, tier ),
  customers ( id, full_name, phone )
`;

const TODAY_SCHEDULE_SELECT_WITH_PAYMENTS = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata,
  payment_method, payment_status, payment_reference, amount_paid,
  resource_id,
  services  ( id, name, duration_minutes ),
  staff     ( id, full_name, tier ),
  customers ( id, full_name, phone )
`;

const TODAY_SCHEDULE_SELECT_WITH_PAYMENTS_NO_RESOURCE = `
  id, booking_date, start_time, end_time, type, status,
  travel_buffer_mins, metadata,
  payment_method, payment_status, payment_reference, amount_paid,
  services  ( id, name, duration_minutes ),
  staff     ( id, full_name, tier ),
  customers ( id, full_name, phone )
`;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type QueryError = { message: string; code?: string | null };
type QueryResult<T> = { data: T[] | null; error: QueryError | null };
type SingleQueryResult<T> = { data: T | null; error: QueryError | null };
type PaymentFields = {
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  amount_paid: number;
};
type MaybePaymentFields = {
  payment_method?: unknown;
  payment_status?: unknown;
  payment_reference?: unknown;
  amount_paid?: unknown;
};
type OneOrMany<T> = T | T[] | null;
type BranchRelation = OneOrMany<{ id: string; name: string }>;
type ServiceRelation = OneOrMany<{
  id: string;
  name: string;
  duration_minutes?: number;
}>;
type StaffRelation = OneOrMany<{ id: string; full_name: string; tier?: string }>;
type CustomerRelation = OneOrMany<{
  id?: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
}>;
type BookingFullRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  travel_buffer_mins: number | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
  resource_id: string | null;
  branches: BranchRelation;
  services: ServiceRelation;
  staff: StaffRelation;
  customers: CustomerRelation;
  booking_events?: unknown;
} & MaybePaymentFields;
type TodayScheduleRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  travel_buffer_mins: number | null;
  metadata: unknown;
  resource_id: string | null;
  services: ServiceRelation;
  staff: StaffRelation;
  customers: CustomerRelation;
} & MaybePaymentFields;
type StaffUpcomingRow = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  metadata: unknown;
  resource_id: string | null;
  services: ServiceRelation;
  customers: CustomerRelation;
} & MaybePaymentFields;
type DailyPaymentRow = {
  status: string;
  metadata: unknown;
} & MaybePaymentFields;
type SelectVariant = {
  select: string;
  hasResource: boolean;
};

const BOOKING_SELECT_VARIANTS: SelectVariant[] = [
  { select: BOOKING_SELECT_WITH_PAYMENTS, hasResource: true },
  { select: BOOKING_SELECT, hasResource: true },
  { select: BOOKING_SELECT_WITH_PAYMENTS_NO_RESOURCE, hasResource: false },
  { select: BOOKING_SELECT_CORE, hasResource: false },
];

const TODAY_SCHEDULE_SELECT_VARIANTS: SelectVariant[] = [
  { select: TODAY_SCHEDULE_SELECT_WITH_PAYMENTS, hasResource: true },
  { select: TODAY_SCHEDULE_SELECT, hasResource: true },
  { select: TODAY_SCHEDULE_SELECT_WITH_PAYMENTS_NO_RESOURCE, hasResource: false },
  { select: TODAY_SCHEDULE_SELECT_CORE, hasResource: false },
];

const STAFF_UPCOMING_SELECT_VARIANTS: SelectVariant[] = [
  {
    select: `
      id, booking_date, start_time, end_time, type, status, metadata,
      payment_method, payment_status, payment_reference, amount_paid,
      resource_id,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )
    `,
    hasResource: true,
  },
  {
    select: `
      id, booking_date, start_time, end_time, type, status, metadata,
      resource_id,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )
    `,
    hasResource: true,
  },
  {
    select: `
      id, booking_date, start_time, end_time, type, status, metadata,
      payment_method, payment_status, payment_reference, amount_paid,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )
    `,
    hasResource: false,
  },
  {
    select: `
      id, booking_date, start_time, end_time, type, status, metadata,
      services  ( id, name, duration_minutes ),
      customers ( id, full_name )
    `,
    hasResource: false,
  },
];

function isMissingPaymentColumns(error: QueryError | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /column bookings\.(payment_method|payment_status|payment_reference|amount_paid) does not exist/i.test(
      error.message
    )
  );
}

function isMissingResourceColumn(error: QueryError | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /column bookings\.resource_id does not exist/i.test(error.message)
  );
}

function canRetryWithOlderBookingSchema(error: QueryError | null): boolean {
  return isMissingPaymentColumns(error) || isMissingResourceColumn(error);
}

function withPaymentDefaults<T extends object>(
  rows: T[]
): Array<T & PaymentFields> {
  return rows.map((row) => {
    const payment = row as MaybePaymentFields;
    const amountPaid = Number(payment.amount_paid ?? 0);

    return {
      ...row,
      payment_method:
        typeof payment.payment_method === "string"
          ? payment.payment_method
          : "pay_on_site",
      payment_status:
        typeof payment.payment_status === "string"
          ? payment.payment_status
          : "unpaid",
      payment_reference:
        typeof payment.payment_reference === "string"
          ? payment.payment_reference
          : null,
      amount_paid: Number.isFinite(amountPaid) ? amountPaid : 0,
    };
  });
}

function withResourceDefaults<T extends object>(
  rows: T[],
  hasResource: boolean
): Array<T & { resource_id: string | null }> {
  return rows.map((row) => {
    const maybeResource = row as { resource_id?: unknown };
    return {
      ...row,
      resource_id:
        hasResource && typeof maybeResource.resource_id === "string"
          ? maybeResource.resource_id
          : null,
    };
  });
}

async function loadBookingRows<T extends object>(
  supabase: SupabaseClient,
  variants: SelectVariant[],
  query: (select: string) => Promise<QueryResult<T>>
) {
  let lastError: QueryError | null = null;

  for (const variant of variants) {
    const result = await query(variant.select);

    if (!result.error) {
      return attachBranchResources(
        supabase,
        withPaymentDefaults(
          withResourceDefaults(result.data ?? [], variant.hasResource)
        )
      );
    }

    if (!canRetryWithOlderBookingSchema(result.error)) {
      throw new Error(result.error.message);
    }

    lastError = result.error;
  }

  throw new Error(lastError?.message ?? "Unable to load bookings");
}

async function loadBookingRow<T extends object>(
  supabase: SupabaseClient,
  variants: SelectVariant[],
  query: (select: string) => Promise<SingleQueryResult<T>>
) {
  let lastError: QueryError | null = null;

  for (const variant of variants) {
    const result = await query(variant.select);

    if (!result.error) {
      const [booking] = await attachBranchResources(
        supabase,
        withPaymentDefaults(
          withResourceDefaults(
            result.data ? [result.data] : [],
            variant.hasResource
          )
        )
      );
      return booking;
    }

    if (!canRetryWithOlderBookingSchema(result.error)) {
      throw new Error(result.error.message);
    }

    lastError = result.error;
  }

  throw new Error(lastError?.message ?? "Unable to load booking");
}

async function loadDailyPaymentFallbackRows(
  supabase: SupabaseClient,
  branchId: string,
  date: string
): Promise<DailyPaymentRow[]> {
  const fallback = await supabase
    .from("bookings")
    .select("status, metadata")
    .eq("branch_id", branchId)
    .eq("booking_date", date);

  if (fallback.error) throw new Error(fallback.error.message);
  return (fallback.data ?? []) as DailyPaymentRow[];
}

function readPricePaid(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const val = (metadata as Record<string, unknown>)["price_paid"];
  const n = Number(val ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getBookingsByBranch(
  branchId: string,
  date: string
) {
  const supabase = await createClient();
  return loadBookingRows(
    supabase,
    BOOKING_SELECT_VARIANTS,
    async (select) => {
      const result = await supabase
        .from("bookings")
        .select(select)
        .eq("branch_id", branchId)
        .eq("booking_date", date)
        .order("start_time");
      return result as QueryResult<BookingFullRow>;
    }
  );
}

export async function getAllBookings(filters?: {
  branchId?: string;
  date?: string;
  status?: string;
  type?: string;
  staffId?: string;
}) {
  const supabase = await createClient();
  return loadBookingRows(
    supabase,
    BOOKING_SELECT_VARIANTS,
    async (select) => {
      let q = supabase.from("bookings").select(select);
      if (filters?.branchId) q = q.eq("branch_id", filters.branchId);
      if (filters?.date) q = q.eq("booking_date", filters.date);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.type) q = q.eq("type", filters.type);
      if (filters?.staffId) q = q.eq("staff_id", filters.staffId);
      const result = await q
        .order("booking_date", { ascending: false })
        .order("start_time");
      return result as QueryResult<BookingFullRow>;
    }
  );
}

export async function getBookingById(bookingId: string) {
  const supabase = await createClient();
  return loadBookingRow(
    supabase,
    BOOKING_SELECT_VARIANTS.map((variant) => ({
      ...variant,
      select: `${variant.select}, booking_events ( * )`,
    })),
    async (select) => {
      const result = await supabase
        .from("bookings")
        .select(select)
        .eq("id", bookingId)
        .single();
      return result as SingleQueryResult<BookingFullRow>;
    }
  );
}

export async function getBookingsByCustomer(customerId: string) {
  const supabase = await createClient();
  return loadBookingRows(
    supabase,
    BOOKING_SELECT_VARIANTS,
    async (select) => {
      const result = await supabase
        .from("bookings")
        .select(select)
        .eq("customer_id", customerId)
        .order("booking_date", { ascending: false });
      return result as QueryResult<BookingFullRow>;
    }
  );
}

export async function getMyBookings(staffId: string, date: string) {
  const supabase = await createClient();
  return loadBookingRows(
    supabase,
    BOOKING_SELECT_VARIANTS,
    async (select) => {
      const result = await supabase
        .from("bookings")
        .select(select)
        .eq("staff_id", staffId)
        .eq("booking_date", date)
        .not("status", "in", '("cancelled","no_show")')
        .order("start_time");
      return result as QueryResult<BookingFullRow>;
    }
  );
}

// ── Today's full branch schedule (manager timeline view) ──────────────────
export async function getTodaysSchedule(branchId: string, date: string) {
  const supabase = await createClient();
  return loadBookingRows(
    supabase,
    TODAY_SCHEDULE_SELECT_VARIANTS,
    async (select) => {
      const result = await supabase
        .from("bookings")
        .select(select)
        .eq("branch_id", branchId)
        .eq("booking_date", date)
        .order("start_time");
      return result as QueryResult<TodayScheduleRow>;
    }
  );
}

// ── Daily payment summary for a branch ───────────────────────────────────
export async function getDailyPaymentSummary(branchId: string, date: string) {
  const supabase = await createClient();
  const result = await supabase
    .from("bookings")
    .select("status, metadata, payment_method, payment_status, amount_paid")
    .eq("branch_id", branchId)
    .eq("booking_date", date);

  if (result.error && !isMissingPaymentColumns(result.error)) {
    throw new Error(result.error.message);
  }

  const rows = result.error
    ? withPaymentDefaults(
        await loadDailyPaymentFallbackRows(supabase, branchId, date)
      )
    : withPaymentDefaults((result.data ?? []) as DailyPaymentRow[]);

  const activeRows = rows.filter((r) => !["cancelled", "no_show"].includes(r.status));
  const paidRows = activeRows.filter((r) => r.payment_status === "paid");
  const unpaidRows = activeRows.filter((r) => ["unpaid", "pending"].includes(r.payment_status));

  const totalExpected = activeRows.reduce((s, r) => s + readPricePaid(r.metadata), 0);
  const totalCollected = paidRows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0);
  const totalUnpaid = unpaidRows.reduce((s, r) => s + readPricePaid(r.metadata), 0);

  const byMethod: Record<string, number> = {
    cash: 0, gcash: 0, maya: 0, card: 0, pay_on_site: 0, other: 0,
  };
  for (const r of paidRows) {
    const m = r.payment_method ?? "other";
    byMethod[m] = (byMethod[m] ?? 0) + Number(r.amount_paid ?? 0);
  }

  return {
    date,
    total_expected:  totalExpected,
    total_collected: totalCollected,
    total_unpaid:    totalUnpaid,
    paid_count:      paidRows.length,
    unpaid_count:    unpaidRows.length,
    total_count:     activeRows.length,
    by_method:       byMethod as {
      cash: number; gcash: number; maya: number;
      card: number; pay_on_site: number; other: number;
    },
  };
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
  return loadBookingRows(
    supabase,
    STAFF_UPCOMING_SELECT_VARIANTS,
    async (select) => {
      const result = await supabase
        .from("bookings")
        .select(select)
        .eq("staff_id", staffId)
        .gte("booking_date", fromDate)
        .lte("booking_date", toDate)
        .not("status", "in", '("cancelled","no_show")')
        .order("booking_date")
        .order("start_time");
      return result as QueryResult<StaffUpcomingRow>;
    }
  );
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
