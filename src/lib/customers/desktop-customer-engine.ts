import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";
import { logError } from "@/lib/logger";

export type CustomerTabType = "all" | "repeat" | "lapsed" | "followup";

export type DesktopCustomerListParams = {
  tab?: string | null;
  q?: string | null;
  page?: number | string | null;
  pageSize?: number | string | null;
  branchId?: string | null;
};

export type DesktopCustomerExecutionContext = {
  operator: InhouseBookingOperator;
  supabase: SupabaseClient<Database>;
};

export type DesktopCustomerListItemDto = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  totalBookings: number;
  firstBookingDate: string | null;
  lastBookingDate: string | null;
  preferredStaffId: string | null;
  preferredStaffName: string | null;
};

export type DesktopWaitlistFollowupItemDto = {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceId: string | null;
  serviceName: string | null;
  visitType: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

export type DesktopCustomerKpisDto = {
  totalCustomers: number;
  repeatClients: number;
  lapsedClients: number;
  newThisMonth: number;
  totalVisits: number;
};

export type DesktopCustomerListResult =
  | {
      ok: true;
      tab: CustomerTabType;
      data: DesktopCustomerListItemDto[];
      waitlist: DesktopWaitlistFollowupItemDto[];
      pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
      };
      kpis: DesktopCustomerKpisDto;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type DesktopCustomerBookingHistoryItemDto = {
  id: string;
  bookingDate: string;
  startTime: string;
  status: string;
  type: string;
  serviceName: string;
  staffName: string;
  branchName: string;
};

export type DesktopCustomerDetailDto = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  firstBookingDate: string | null;
  lastBookingDate: string | null;
  totalBookings: number;
  notes: string | null;
  preferredStaffId: string | null;
  preferredStaffName: string | null;
  preferredVisitType: string | null;
  pressurePreference: string | null;
  healthNotes: string | null;
  birthday: string | null;
  loyaltyTier: string | null;
};

export type DesktopCustomerDetailResult =
  | {
      ok: true;
      customer: DesktopCustomerDetailDto;
      bookingHistory: DesktopCustomerBookingHistoryItemDto[];
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidUuid(id: string | null | undefined): boolean {
  return typeof id === "string" && uuidRegex.test(id.trim());
}

function parseStrictInteger(
  val: number | string | null | undefined,
  minVal: number,
  maxVal?: number
): { ok: true; value: number } | { ok: false } {
  if (val === undefined || val === null || val === "") return { ok: false };
  if (typeof val === "number") {
    if (!Number.isInteger(val) || val < minVal || (maxVal !== undefined && val > maxVal)) {
      return { ok: false };
    }
    return { ok: true, value: val };
  }
  const str = val.trim();
  if (!/^-?\d+$/.test(str)) {
    return { ok: false };
  }
  const parsed = Number(str);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minVal ||
    (maxVal !== undefined && parsed > maxVal)
  ) {
    return { ok: false };
  }
  return { ok: true, value: parsed };
}

function firstRelation<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function resolveStaffDisplayName(
  staffRel:
    | { id: string; full_name?: string | null; nickname?: string | null }
    | { id: string; full_name?: string | null; nickname?: string | null }[]
    | null
    | undefined
): string | null {
  const staff = firstRelation(staffRel);
  if (!staff) return null;
  return staff.nickname?.trim() || staff.full_name?.trim() || null;
}

function resolveEffectiveBranch(
  operator: InhouseBookingOperator,
  requestedBranchId?: string | null
): { ok: true; branchId: string } | { ok: false; code: string; message: string } {
  if (!operator.staff) {
    return {
      ok: false,
      code: "STAFF_NOT_FOUND",
      message: "No active staff profile found for this authenticated user.",
    };
  }

  if (!operator.staffRole || !canAccessCrmWorkspace(operator.staffRole)) {
    return {
      ok: false,
      code: "CRM_PERMISSION_DENIED",
      message: "You do not have permission to access the CRM customer workspace.",
    };
  }

  const isOwner = operator.staffRole === "owner";

  if (!isOwner) {
    const assignedBranchId = operator.staff.branch_id;
    if (!assignedBranchId) {
      return {
        ok: false,
        code: "CRM_BRANCH_FORBIDDEN",
        message: "You are not assigned to a branch.",
      };
    }

    if (requestedBranchId && requestedBranchId !== assignedBranchId) {
      return {
        ok: false,
        code: "CRM_BRANCH_FORBIDDEN",
        message: "You can only access customers for your assigned branch.",
      };
    }

    return { ok: true, branchId: assignedBranchId };
  }

  // Owner branch resolution
  const resolved =
    requestedBranchId && requestedBranchId.trim() !== ""
      ? requestedBranchId.trim()
      : operator.staff.branch_id;
  if (!resolved) {
    return {
      ok: false,
      code: "BRANCH_REQUIRED",
      message: "A branchId must be specified for this workspace.",
    };
  }

  return { ok: true, branchId: resolved };
}

async function verifyBranchExists(
  supabase: SupabaseClient<Database>,
  branchId: string
): Promise<
  { ok: true; exists: boolean } | { ok: false; code: "SERVER_DATABASE_ERROR"; message: string }
> {
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .maybeSingle();

  if (error) {
    logError("desktop.customers.branch_lookup.error", { error });
    return {
      ok: false,
      code: "SERVER_DATABASE_ERROR",
      message: "Failed to verify branch.",
    };
  }

  return { ok: true, exists: Boolean(data) };
}

async function getBranchCustomerIds(
  supabase: SupabaseClient<Database>,
  branchId: string
): Promise<
  | { ok: true; customerIds: string[] }
  | { ok: false; code: "SERVER_DATABASE_ERROR"; message: string }
> {
  const { data, error } = await supabase
    .from("bookings")
    .select("customer_id")
    .eq("branch_id", branchId)
    .not("customer_id", "is", null);

  if (error) {
    logError("desktop.customers.membership_lookup.error", { error });
    return {
      ok: false,
      code: "SERVER_DATABASE_ERROR",
      message: "Failed to retrieve branch customer membership.",
    };
  }

  const unique = new Set<string>();
  for (const row of data ?? []) {
    if (row.customer_id) {
      unique.add(row.customer_id);
    }
  }
  return { ok: true, customerIds: Array.from(unique) };
}

async function calculateBranchCustomerKpis(
  supabase: SupabaseClient<Database>,
  branchCustomerIds: string[]
): Promise<
  | { ok: true; kpis: DesktopCustomerKpisDto }
  | { ok: false; code: "SERVER_DATABASE_ERROR"; message: string }
> {
  if (branchCustomerIds.length === 0) {
    return {
      ok: true,
      kpis: {
        totalCustomers: 0,
        repeatClients: 0,
        lapsedClients: 0,
        newThisMonth: 0,
        totalVisits: 0,
      },
    };
  }

  const today = new Date();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().split("T")[0]!;

  const [repeatRes, lapsedRes, newThisMonthRes, totalVisitsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .in("id", branchCustomerIds)
      .gte("total_bookings", 2),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .in("id", branchCustomerIds)
      .gte("total_bookings", 1)
      .lt("last_booking_date", cutoff30Str),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .in("id", branchCustomerIds)
      .gte("first_booking_date", monthStart),
    supabase.from("customers").select("total_bookings").in("id", branchCustomerIds),
  ]);

  if (repeatRes.error || lapsedRes.error || newThisMonthRes.error || totalVisitsRes.error) {
    logError("desktop.customers.kpi.error", {
      repeatError: repeatRes.error,
      lapsedError: lapsedRes.error,
      newThisMonthError: newThisMonthRes.error,
      totalVisitsError: totalVisitsRes.error,
    });
    return {
      ok: false,
      code: "SERVER_DATABASE_ERROR",
      message: "Failed to calculate customer metrics.",
    };
  }

  const totalVisits = (totalVisitsRes.data ?? []).reduce(
    (sum, c) => sum + (c.total_bookings ?? 0),
    0
  );

  return {
    ok: true,
    kpis: {
      totalCustomers: branchCustomerIds.length,
      repeatClients: repeatRes.count ?? 0,
      lapsedClients: lapsedRes.count ?? 0,
      newThisMonth: newThisMonthRes.count ?? 0,
      totalVisits,
    },
  };
}

export async function executeDesktopCustomerList(
  params: DesktopCustomerListParams,
  context: DesktopCustomerExecutionContext
): Promise<DesktopCustomerListResult> {
  const { operator, supabase } = context;

  // 1. Strict parameter validation
  let tab: CustomerTabType = "all";
  if (params.tab !== undefined && params.tab !== null && params.tab !== "") {
    const rawTab = params.tab;
    const validTabs: CustomerTabType[] = ["all", "repeat", "lapsed", "followup"];
    if (!validTabs.includes(rawTab as CustomerTabType)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid tab parameter. Allowed values: all, repeat, lapsed, followup.",
      };
    }
    tab = rawTab as CustomerTabType;
  }

  let page = 1;
  if (params.page !== undefined && params.page !== null && params.page !== "") {
    const pageParsed = parseStrictInteger(params.page, 1);
    if (!pageParsed.ok) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid page parameter. Must be an integer greater than or equal to 1.",
      };
    }
    page = pageParsed.value;
  }

  let pageSize = 25;
  if (params.pageSize !== undefined && params.pageSize !== null && params.pageSize !== "") {
    const pageSizeParsed = parseStrictInteger(params.pageSize, 1, 100);
    if (!pageSizeParsed.ok) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid pageSize parameter. Must be an integer between 1 and 100.",
      };
    }
    pageSize = pageSizeParsed.value;
  }

  let searchTerm: string | null = null;
  if (params.q !== undefined && params.q !== null && params.q !== "") {
    const trimmed = params.q.trim();
    if (trimmed.length > 100) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Search query exceeds maximum length of 100 characters.",
      };
    }
    searchTerm = trimmed.length > 0 ? trimmed : null;
  }

  if (params.branchId !== undefined && params.branchId !== null && params.branchId !== "") {
    if (!isValidUuid(params.branchId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid branchId format.",
      };
    }
  }

  // 2. Resolve effective branch
  const branchRes = resolveEffectiveBranch(operator, params.branchId);
  if (!branchRes.ok) {
    return branchRes;
  }

  const effectiveBranchId = branchRes.branchId;
  if (!isValidUuid(effectiveBranchId)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Invalid branchId format.",
    };
  }

  // 3. Verify branch exists in DB (fail-closed on error)
  const branchExistsRes = await verifyBranchExists(supabase, effectiveBranchId);
  if (!branchExistsRes.ok) {
    return branchExistsRes;
  }
  if (!branchExistsRes.exists) {
    return {
      ok: false,
      code: "BRANCH_NOT_FOUND",
      message: "Selected branch was not found.",
    };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 4. Retrieve branch customer membership (fail-closed on DB error)
  const branchCustomersRes = await getBranchCustomerIds(supabase, effectiveBranchId);
  if (!branchCustomersRes.ok) {
    return branchCustomersRes;
  }
  const branchCustomerIds = branchCustomersRes.customerIds;

  // 5. Calculate KPIs (fail-closed on DB error)
  const kpisRes = await calculateBranchCustomerKpis(supabase, branchCustomerIds);
  if (!kpisRes.ok) {
    return kpisRes;
  }
  const kpis = kpisRes.kpis;

  // 6. Handle tab=followup
  if (tab === "followup") {
    let waitlistQuery = supabase
      .from("waitlist_requests")
      .select(
        "id, customer_name, customer_phone, preferred_date, preferred_time, visit_type, status, notes, created_at, services ( id, name )",
        { count: "exact" }
      )
      .eq("branch_id", effectiveBranchId)
      .order("preferred_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (searchTerm) {
      const sanitized = searchTerm.replace(/[%_]/g, "\\$&");
      waitlistQuery = waitlistQuery.or(
        `customer_phone.ilike.${sanitized}%,customer_name.ilike.%${sanitized}%`
      );
    }

    const { data: waitlistData, error: waitlistError, count: waitlistCount } = await waitlistQuery;

    if (waitlistError) {
      logError("desktop.customers.waitlist.error", { error: waitlistError });
      return {
        ok: false,
        code: "SERVER_DATABASE_ERROR",
        message: "Failed to load follow-up waitlist records.",
      };
    }

    const totalCount = waitlistCount ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const mappedWaitlist: DesktopWaitlistFollowupItemDto[] = (waitlistData ?? []).map((row) => {
      const svc = firstRelation(row.services);
      return {
        id: row.id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        serviceId: svc?.id ?? null,
        serviceName: svc?.name ?? null,
        visitType: row.visit_type ?? null,
        preferredDate: row.preferred_date ?? null,
        preferredTime: row.preferred_time ?? null,
        status: row.status,
        notes: row.notes ?? null,
        createdAt: row.created_at,
      };
    });

    return {
      ok: true,
      tab,
      data: [],
      waitlist: mappedWaitlist,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      kpis,
    };
  }

  // 7. If branch has zero customers
  if (branchCustomerIds.length === 0) {
    return {
      ok: true,
      tab,
      data: [],
      waitlist: [],
      pagination: {
        page,
        pageSize,
        totalCount: 0,
        totalPages: 1,
      },
      kpis,
    };
  }

  // 8. Execute customer segment query
  let customerQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, total_bookings, first_booking_date, last_booking_date, preferred_staff_id, staff!preferred_staff_id ( id, full_name, nickname )",
      { count: "exact" }
    )
    .in("id", branchCustomerIds);

  if (tab === "repeat") {
    customerQuery = customerQuery
      .gte("total_bookings", 2)
      .order("total_bookings", { ascending: false });
  } else if (tab === "lapsed") {
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff30Str = cutoff30.toISOString().split("T")[0]!;

    customerQuery = customerQuery
      .gte("total_bookings", 1)
      .lt("last_booking_date", cutoff30Str)
      .order("last_booking_date", { ascending: true });
  } else {
    // "all"
    customerQuery = customerQuery.order("last_booking_date", {
      ascending: false,
      nullsFirst: false,
    });
  }

  if (searchTerm) {
    const sanitized = searchTerm.replace(/[%_]/g, "\\$&");
    customerQuery = customerQuery.or(`phone.ilike.${sanitized}%,full_name.ilike.%${sanitized}%`);
  }

  customerQuery = customerQuery.range(from, to);

  const { data: customerRows, error: customerError, count: customerCount } = await customerQuery;

  if (customerError) {
    logError("desktop.customers.list.error", { error: customerError });
    return {
      ok: false,
      code: "SERVER_DATABASE_ERROR",
      message: "Failed to load customers.",
    };
  }

  const totalCount = customerCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const mappedCustomers: DesktopCustomerListItemDto[] = (customerRows ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email ?? null,
    totalBookings: row.total_bookings ?? 0,
    firstBookingDate: row.first_booking_date ?? null,
    lastBookingDate: row.last_booking_date ?? null,
    preferredStaffId: row.preferred_staff_id ?? null,
    preferredStaffName: resolveStaffDisplayName(row.staff),
  }));

  return {
    ok: true,
    tab,
    data: mappedCustomers,
    waitlist: [],
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
    kpis,
  };
}

export async function executeDesktopCustomerDetail(
  customerId: string,
  queryParams: { branchId?: string | null },
  context: DesktopCustomerExecutionContext
): Promise<DesktopCustomerDetailResult> {
  const { operator, supabase } = context;

  if (!isValidUuid(customerId)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Invalid customerId format.",
    };
  }

  if (
    queryParams.branchId !== undefined &&
    queryParams.branchId !== null &&
    queryParams.branchId !== ""
  ) {
    if (!isValidUuid(queryParams.branchId)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid branchId format.",
      };
    }
  }

  const branchRes = resolveEffectiveBranch(operator, queryParams.branchId);
  if (!branchRes.ok) {
    return branchRes;
  }

  const effectiveBranchId = branchRes.branchId;
  if (!isValidUuid(effectiveBranchId)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Invalid branchId format.",
    };
  }

  const branchExistsRes = await verifyBranchExists(supabase, effectiveBranchId);
  if (!branchExistsRes.ok) {
    return branchExistsRes;
  }
  if (!branchExistsRes.exists) {
    return {
      ok: false,
      code: "BRANCH_NOT_FOUND",
      message: "Selected branch was not found.",
    };
  }

  // Verify customer membership at effective branch
  const { data: bookingCheck, error: bookingCheckError } = await supabase
    .from("bookings")
    .select("id")
    .eq("customer_id", customerId)
    .eq("branch_id", effectiveBranchId)
    .limit(1);

  if (bookingCheckError) {
    logError("desktop.customers.membership_check.error", { error: bookingCheckError });
    return {
      ok: false,
      code: "SERVER_DATABASE_ERROR",
      message: "Failed to verify customer membership.",
    };
  }

  if (!bookingCheck || bookingCheck.length === 0) {
    return {
      ok: false,
      code: "CUSTOMER_NOT_FOUND",
      message: "Customer not found or has no bookings at this branch.",
    };
  }

  // Load customer profile record
  const { data: customerRecord, error: customerError } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, email, first_booking_date, last_booking_date, total_bookings, notes, preferred_staff_id, preferred_visit_type, pressure_preference, health_notes, birthday, loyalty_tier, staff!preferred_staff_id ( id, full_name, nickname )"
    )
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) {
    logError("desktop.customers.detail.error", { error: customerError });
    return {
      ok: false,
      code: "SERVER_DATABASE_ERROR",
      message: "Failed to load customer profile.",
    };
  }

  if (!customerRecord) {
    return {
      ok: false,
      code: "CUSTOMER_NOT_FOUND",
      message: "Customer record not found.",
    };
  }

  // Load booking history strictly filtered by customer_id AND branch_id
  const { data: historyRecords, error: historyError } = await supabase
    .from("bookings")
    .select(
      "id, booking_date, start_time, status, type, services ( id, name ), staff!staff_id ( id, full_name, nickname ), branches ( id, name )"
    )
    .eq("customer_id", customerId)
    .eq("branch_id", effectiveBranchId)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(100);

  if (historyError) {
    logError("desktop.customers.history.error", { error: historyError });
    return {
      ok: false,
      code: "SERVER_DATABASE_ERROR",
      message: "Failed to load booking history.",
    };
  }

  const mappedCustomer: DesktopCustomerDetailDto = {
    id: customerRecord.id,
    fullName: customerRecord.full_name,
    phone: customerRecord.phone,
    email: customerRecord.email ?? null,
    firstBookingDate: customerRecord.first_booking_date ?? null,
    lastBookingDate: customerRecord.last_booking_date ?? null,
    totalBookings: customerRecord.total_bookings ?? 0,
    notes: customerRecord.notes ?? null,
    preferredStaffId: customerRecord.preferred_staff_id ?? null,
    preferredStaffName: resolveStaffDisplayName(customerRecord.staff),
    preferredVisitType: customerRecord.preferred_visit_type ?? null,
    pressurePreference: customerRecord.pressure_preference ?? null,
    healthNotes: customerRecord.health_notes ?? null,
    birthday: customerRecord.birthday ?? null,
    loyaltyTier: customerRecord.loyalty_tier ?? null,
  };

  const mappedBookingHistory: DesktopCustomerBookingHistoryItemDto[] = (historyRecords ?? []).map(
    (b) => {
      const svc = firstRelation(b.services);
      const stf = firstRelation(b.staff);
      const brn = firstRelation(b.branches);

      return {
        id: b.id,
        bookingDate: b.booking_date,
        startTime: b.start_time,
        status: b.status,
        type: b.type,
        serviceName: svc?.name ?? "-",
        staffName: stf?.nickname?.trim() || stf?.full_name?.trim() || "-",
        branchName: brn?.name ?? "-",
      };
    }
  );

  return {
    ok: true,
    customer: mappedCustomer,
    bookingHistory: mappedBookingHistory,
  };
}
