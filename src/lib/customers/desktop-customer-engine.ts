import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
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
  supabase: ReturnType<typeof createAdminClient>,
  branchId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

async function getBranchCustomerIds(
  supabase: ReturnType<typeof createAdminClient>,
  branchId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("customer_id")
    .eq("branch_id", branchId)
    .not("customer_id", "is", null);

  if (error || !data) return [];

  const unique = new Set<string>();
  for (const row of data) {
    if (row.customer_id) {
      unique.add(row.customer_id);
    }
  }
  return Array.from(unique);
}

async function calculateBranchCustomerKpis(
  supabase: ReturnType<typeof createAdminClient>,
  branchCustomerIds: string[]
): Promise<DesktopCustomerKpisDto> {
  if (branchCustomerIds.length === 0) {
    return {
      totalCustomers: 0,
      repeatClients: 0,
      lapsedClients: 0,
      newThisMonth: 0,
      totalVisits: 0,
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

  const totalVisits = (totalVisitsRes.data ?? []).reduce(
    (sum, c) => sum + (c.total_bookings ?? 0),
    0
  );

  return {
    totalCustomers: branchCustomerIds.length,
    repeatClients: repeatRes.count ?? 0,
    lapsedClients: lapsedRes.count ?? 0,
    newThisMonth: newThisMonthRes.count ?? 0,
    totalVisits,
  };
}

export async function executeDesktopCustomerList(
  params: DesktopCustomerListParams,
  operator: InhouseBookingOperator
): Promise<DesktopCustomerListResult> {
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

  const supabase = createAdminClient();

  const branchExists = await verifyBranchExists(supabase, effectiveBranchId);
  if (!branchExists) {
    return {
      ok: false,
      code: "BRANCH_NOT_FOUND",
      message: "Selected branch was not found.",
    };
  }

  // Parse tab
  const rawTab = (params.tab ?? "all").toLowerCase().trim();
  const validTabs: CustomerTabType[] = ["all", "repeat", "lapsed", "followup"];
  const tab: CustomerTabType = validTabs.includes(rawTab as CustomerTabType)
    ? (rawTab as CustomerTabType)
    : "all";

  // Parse pagination
  const rawPage = Number(params.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const rawPageSize = Number(params.pageSize ?? 25);
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(Math.max(Math.floor(rawPageSize), 1), 100)
      : 25;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const searchTerm = params.q?.trim() || null;

  // Retrieve customer IDs belonging to effective branch
  const branchCustomerIds = await getBranchCustomerIds(supabase, effectiveBranchId);
  const kpis = await calculateBranchCustomerKpis(supabase, branchCustomerIds);

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

  // Customer segment tabs: all, repeat, lapsed
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
  operator: InhouseBookingOperator
): Promise<DesktopCustomerDetailResult> {
  if (!isValidUuid(customerId)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Invalid customerId format.",
    };
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

  const supabase = createAdminClient();

  const branchExists = await verifyBranchExists(supabase, effectiveBranchId);
  if (!branchExists) {
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
