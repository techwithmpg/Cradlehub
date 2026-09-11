import "server-only";

import type { CrmActionContext } from "@/lib/bookings/crm-booking-operations";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import {
  getCrmPendingBookingQueue,
  getManagerDashboardStats,
  getTodaysSchedule,
} from "@/lib/queries/bookings";
import { getCrmReadinessCached } from "@/lib/queries/crm-readiness";
import {
  createAttendanceScanFeedFallback,
  getRecentAttendanceScanFeed,
} from "@/lib/attendance/recent-scans";
import { getBranchBookingDriverIds, getDriverNamesByIds } from "@/lib/actions/driver-actions";
import { getStaffAdminName } from "@/lib/staff/display-name";
import {
  getCradleFlowStage,
  type CradleFlowBooking,
  type CradleFlowStage,
} from "@/lib/crm/cradle-flow";
import type { ReadinessStatus } from "@/types/readiness";

// ── Canonical Types ────────────────────────────────────────────────────────────

export type DesktopTodayContext = {
  branchId: string;
  branchName: string;
  businessDate: string;
  role: string;
};

export type DesktopTodaySummary = {
  total: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
  unassigned: number;
  waiting: number;
  inService: number;
  readyToPay: number;
  completedService: number;
  homeService: number;
};

export type DesktopTodayQueueItem = {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingProgressStatus: string;
  type: string;
  deliveryType: string | null;
  customerName: string | null;
  customerPhone: string | null;
  serviceName: string | null;
  serviceDuration: number | null;
  staffId: string | null;
  staffName: string | null;
  resourceId: string | null;
  resourceName: string | null;
  paymentStatus: string | null;
  checkedInAt: string | null;
  sessionStartedAt: string | null;
  sessionDueAt: string | null;
  sessionCompletedAt: string | null;
  createdAt: string | null;
  stage: CradleFlowStage | null;
  isHomeService: boolean;
  driverId: string | null;
  driverName: string | null;
  noDriverWarning: boolean;
  dispatchWarning: string | null;
  needsLocationReview: boolean;
  homeServiceAddress: string | null;
};

export type DesktopTodayReadinessIssue = {
  id: string;
  scope: string;
  severity: string;
  title: string;
  problem: string;
  impact: string;
  fix: string;
  actionLabel: string;
  actionHref: string;
  count?: number;
};

export type DesktopTodayReadiness = {
  status: ReadinessStatus;
  issues: DesktopTodayReadinessIssue[];
};

export type DesktopTodayAttendanceItem = {
  eventId: string;
  staffId: string | null;
  staffName: string;
  staffNickname: string | null;
  eventType: string;
  outcome: string;
  reasonCode: string | null;
  message: string | null;
  occurredAt: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  sourceLabel: string | null;
};

export type DesktopTodayAttendance = {
  selectedDate: string;
  timezone: string;
  lastHourCount: number;
  items: DesktopTodayAttendanceItem[];
  error: string | null;
};

export type DesktopTodayNotification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  priority: string;
  createdAt: string;
  requiresAction: boolean;
};

export type DesktopTodayData = {
  context: DesktopTodayContext;
  summary: DesktopTodaySummary;
  queue: DesktopTodayQueueItem[];
  readiness: DesktopTodayReadiness;
  attendance: DesktopTodayAttendance;
  notifications: DesktopTodayNotification[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type Relation<T> = T | T[] | null;
function firstRelation<T>(v: Relation<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const FORBIDDEN_FINANCIAL_KEYS = new Set([
  "total_collected",
  "total_expected",
  "total_unpaid",
  "by_method",
  "amount_paid",
  "price_paid",
  "payment_reference",
]);

export function assertNoPaymentScopeLeak(payload: unknown, path = ""): void {
  if (!payload || typeof payload !== "object") return;

  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i++) {
      assertNoPaymentScopeLeak(payload[i], `${path}[${i}]`);
    }
    return;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_FINANCIAL_KEYS.has(key)) {
      throw new Error(
        `Payment scope violation: forbidden financial field "${key}" detected at ${path || "root"}`
      );
    }
    if (value && typeof value === "object") {
      assertNoPaymentScopeLeak(value, path ? `${path}.${key}` : key);
    }
  }
}

// ── Main Loader ───────────────────────────────────────────────────────────────

export async function getDesktopTodayData(
  ctx: CrmActionContext,
  branchName: string
): Promise<DesktopTodayData> {
  const branchId = ctx.me.branch_id;
  const businessDate = getBranchBusinessDate();

  const [
    rawBookings,
    pendingQueue,
    dashStats,
    unassignedRes,
    readinessRaw,
    driverIdMap,
    attendanceFeed,
    notificationsRes,
  ] = await Promise.all([
    getTodaysSchedule(branchId, businessDate, ctx.supabase),
    getCrmPendingBookingQueue(branchId, businessDate, ctx.supabase),
    getManagerDashboardStats(branchId, businessDate, ctx.supabase),
    ctx.supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("booking_date", businessDate)
      .eq("status", "confirmed")
      .is("staff_id", null),
    getCrmReadinessCached(branchId).catch(() => null),
    getBranchBookingDriverIds(branchId, businessDate, ctx.supabase),
    getRecentAttendanceScanFeed({
      workspace: "crm",
      branchId,
      branchName,
      selectedDate: businessDate,
      maxItems: 5,
    }).catch(() =>
      createAttendanceScanFeedFallback({
        workspace: "crm",
        branchId,
        branchName,
        selectedDate: businessDate,
        error: "Attendance activity could not be refreshed.",
      })
    ),
    ctx.supabase
      .from("workspace_notifications")
      .select("id, title, body, type, priority, requires_action, created_at, branch_id")
      .eq("requires_action", true)
      .in("status", ["unread", "read"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Combine and deduplicate bookings
  type RawBookingRow = (typeof rawBookings)[number];
  const bookingsById = new Map<string, RawBookingRow>();
  for (const b of rawBookings) {
    bookingsById.set(b.id, b);
  }
  for (const b of pendingQueue) {
    if (!bookingsById.has(b.id)) {
      bookingsById.set(b.id, b);
    }
  }

  const sortedBookings = Array.from(bookingsById.values()).sort((a, b) => {
    const dateCompare = a.booking_date.localeCompare(b.booking_date);
    return dateCompare !== 0 ? dateCompare : a.start_time.localeCompare(b.start_time);
  });

  // Query resource names
  const resourceIds = [
    ...new Set(sortedBookings.map((b) => b.resource_id).filter(Boolean) as string[]),
  ];
  const resourceNameMap = new Map<string, string>();
  if (resourceIds.length > 0) {
    const { data: resources } = await ctx.supabase
      .from("branch_resources")
      .select("id, name")
      .in("id", resourceIds);
    for (const r of resources ?? []) {
      resourceNameMap.set(r.id, r.name);
    }
  }

  // Driver names
  const driverIds = [...new Set(Object.values(driverIdMap).filter(Boolean) as string[])];
  const driverNameMap = await getDriverNamesByIds(driverIds, ctx.supabase);

  type ScheduleRowFields = {
    id: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    status: string;
    booking_progress_status?: string | null;
    type: string;
    delivery_type?: string | null;
    resource_id?: string | null;
    payment_status?: string | null;
    checked_in_at?: string | null;
    session_started_at?: string | null;
    session_due_at?: string | null;
    session_completed_at?: string | null;
    created_at?: string | null;
    staff_id?: string | null;
    customers?: Relation<{ full_name: string; phone?: string | null }>;
    services?: Relation<{ name: string; duration_minutes: number }>;
    staff?: Relation<{ id: string; full_name: string; nickname?: string | null }>;
    branch_resources?: Relation<{ name: string }>;
    metadata?: Record<string, unknown> | null;
  };

  // Build normalized queue
  const queue: DesktopTodayQueueItem[] = sortedBookings.map((raw) => {
    const b = raw as unknown as ScheduleRowFields;
    const meta = b.metadata as Record<string, unknown> | null;
    const hsAddr = meta?.home_service_address as Record<string, unknown> | null;
    const dispatch = meta?.dispatch as Record<string, unknown> | null;
    const isHomeService = b.type === "home_service" || b.delivery_type === "home_service";
    const driverId = driverIdMap[b.id] ?? null;
    const driverName = driverId ? (driverNameMap[driverId] ?? null) : null;
    const stage = getCradleFlowStage(b as unknown as CradleFlowBooking);

    return {
      id: b.id,
      bookingDate: b.booking_date,
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.status,
      bookingProgressStatus: b.booking_progress_status ?? "not_started",
      type: b.type,
      deliveryType: b.delivery_type ?? null,
      customerName: firstRelation(b.customers)?.full_name ?? null,
      customerPhone: firstRelation(b.customers)?.phone ?? null,
      serviceName: firstRelation(b.services)?.name ?? null,
      serviceDuration: firstRelation(b.services)?.duration_minutes ?? null,
      staffId: firstRelation(b.staff)?.id ?? b.staff_id ?? null,
      staffName: firstRelation(b.staff) ? getStaffAdminName(firstRelation(b.staff)!) : null,
      resourceId: b.resource_id ?? null,
      resourceName: b.resource_id
        ? (resourceNameMap.get(b.resource_id) ?? firstRelation(b.branch_resources)?.name ?? null)
        : (firstRelation(b.branch_resources)?.name ?? null),
      paymentStatus: b.payment_status ?? null,
      checkedInAt: b.checked_in_at ?? null,
      sessionStartedAt: b.session_started_at ?? null,
      sessionDueAt: b.session_due_at ?? null,
      sessionCompletedAt: b.session_completed_at ?? null,
      createdAt: b.created_at ?? null,
      stage,
      isHomeService,
      driverId,
      driverName,
      noDriverWarning: isHomeService && !driverId,
      dispatchWarning:
        typeof dispatch?.dispatch_warning === "string" ? dispatch.dispatch_warning : null,
      needsLocationReview: dispatch?.needs_location_review === true,
      homeServiceAddress: typeof hsAddr?.full_address === "string" ? hsAddr.full_address : null,
    };
  });

  // Calculate CradleFlow counts
  let waiting = 0;
  let inService = 0;
  let readyToPay = 0;
  let completedService = 0;
  let homeService = 0;

  for (const item of queue) {
    if (item.stage === "waiting") waiting++;
    else if (item.stage === "in_service") inService++;
    else if (item.stage === "ready_to_pay") readyToPay++;
    else if (item.stage === "completed") completedService++;

    if (item.isHomeService && item.stage !== null) {
      homeService++;
    }
  }

  const summary: DesktopTodaySummary = {
    total: dashStats.total,
    pending: dashStats.pending,
    confirmed: dashStats.confirmed,
    inProgress: dashStats.in_progress,
    completed: dashStats.completed,
    cancelled: dashStats.cancelled,
    noShow: dashStats.no_show,
    unassigned: unassignedRes.count ?? 0,
    waiting,
    inService,
    readyToPay,
    completedService,
    homeService,
  };

  // Map readiness truthfully
  const readiness: DesktopTodayReadiness = readinessRaw
    ? {
        status: readinessRaw.status,
        issues: readinessRaw.issues.map((issue) => ({
          id: issue.id,
          scope: issue.scope,
          severity: issue.severity,
          title: issue.title,
          problem: issue.problem,
          impact: issue.impact,
          fix: issue.fix,
          actionLabel: issue.actionLabel,
          actionHref: issue.actionHref,
          count: issue.count,
        })),
      }
    : {
        status: "warning",
        issues: [
          {
            id: "system:readiness-unavailable",
            scope: "system",
            severity: "warning",
            title: "Readiness checks could not be loaded",
            problem: "Operational readiness status is temporarily unavailable.",
            impact: "Potential operational warnings may not be displayed.",
            fix: "Refresh the workspace to retry loading readiness checks.",
            actionLabel: "Refresh",
            actionHref: "/crm/today",
          },
        ],
      };

  // Map attendance snapshot
  const attendance: DesktopTodayAttendance = {
    selectedDate: attendanceFeed.selectedDate,
    timezone: attendanceFeed.timezone,
    lastHourCount: attendanceFeed.lastHourCount,
    items: attendanceFeed.items.map((item) => ({
      eventId: item.eventId,
      staffId: item.staffId,
      staffName: item.staffName,
      staffNickname: item.staffNickname,
      eventType: item.eventType,
      outcome: item.outcome,
      reasonCode: item.reasonCode,
      message: item.message,
      occurredAt: item.occurredAt,
      clockInAt: item.clockInAt,
      clockOutAt: item.clockOutAt,
      sourceLabel: item.sourceLabel,
    })),
    error: attendanceFeed.error,
  };

  // Map notifications
  const PRIORITY_RANK: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const rawNotifications = notificationsRes.data ?? [];
  const notifications: DesktopTodayNotification[] = rawNotifications
    .filter((n) => !n.branch_id || n.branch_id === branchId)
    .sort((a, b) => {
      const pDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (pDiff !== 0) return pDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 5)
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      priority: n.priority,
      createdAt: n.created_at,
      requiresAction: n.requires_action,
    }));

  const data: DesktopTodayData = {
    context: {
      branchId,
      branchName,
      businessDate,
      role: ctx.me.system_role,
    },
    summary,
    queue,
    readiness,
    attendance,
    notifications,
  };

  assertNoPaymentScopeLeak(data);
  return data;
}
