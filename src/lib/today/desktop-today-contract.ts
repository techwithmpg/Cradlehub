import "server-only";

import type { CrmActionContext } from "@/lib/bookings/crm-booking-operations";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";
import {
  getCrmPendingBookingQueue,
  getManagerDashboardStats,
  getTodaysSchedule,
} from "@/lib/queries/bookings";
import { getRecentAttendanceScanFeed } from "@/lib/attendance/recent-scans";
import { getDispatchData, type RealDispatchItem } from "@/lib/queries/dispatch-queries";
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
  dispatchContextAvailable: boolean | null;
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
  available: boolean;
  status: ReadinessStatus;
  issues: DesktopTodayReadinessIssue[];
  error: string | null;
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
  available: boolean;
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

export type DesktopTodayNotifications = {
  available: boolean;
  items: DesktopTodayNotification[];
  error: string | null;
};

export type DesktopTodayData = {
  context: DesktopTodayContext;
  summary: DesktopTodaySummary;
  queue: DesktopTodayQueueItem[];
  readiness: DesktopTodayReadiness;
  attendance: DesktopTodayAttendance;
  notifications: DesktopTodayNotifications;
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
      assertNoPaymentScopeLeak(payload[i], path ? path + "[" + i + "]" : "[" + i + "]");
    }
    return;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_FINANCIAL_KEYS.has(key)) {
      throw new Error(
        'Payment scope violation: forbidden financial field "' +
          key +
          '" detected at ' +
          (path || "root")
      );
    }
    if (value && typeof value === "object") {
      assertNoPaymentScopeLeak(value, path ? path + "." + key : key);
    }
  }
}

/**
 * Explicitly filter out any payment-scoped or payment-titled issues from
 * Desktop readiness to maintain strict payment-scope boundary.
 */
export function filterDesktopReadinessIssues(
  issues: DesktopTodayReadinessIssue[]
): DesktopTodayReadinessIssue[] {
  return issues.filter((issue) => {
    // Reject scope === "payment"
    if (issue.scope === "payment") return false;
    // Reject issue IDs starting with "payment:"
    if (issue.id.startsWith("payment:") || issue.id === "payment:unpaid-bookings") return false;
    // Reject payment action targets
    if (
      issue.actionHref.includes("/crm/payments") ||
      issue.actionHref.includes("/crm/reconciliation")
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Compute operational readiness projection for Desktop Today using authoritative
 * client-aware primitives. Does NOT use cookie-based getCrmReadinessCached.
 */
export function computeDesktopTodayReadiness(params: {
  unassignedCount: number;
  dispatchAvailable: boolean;
  dispatchItems?: RealDispatchItem[] | null;
  dispatchError?: string | null;
  customIssues?: DesktopTodayReadinessIssue[];
}): DesktopTodayReadiness {
  const issues: DesktopTodayReadinessIssue[] = [];

  if (params.customIssues && params.customIssues.length > 0) {
    issues.push(...params.customIssues);
  }

  // 1. Unassigned bookings check
  if (params.unassignedCount > 0) {
    issues.push({
      id: "daily:unassigned-bookings",
      scope: "daily",
      severity: "warning",
      title:
        params.unassignedCount +
        " booking" +
        (params.unassignedCount > 1 ? "s" : "") +
        " need staff assignment",
      problem:
        "There are " +
        params.unassignedCount +
        " confirmed booking(s) today without an assigned staff member.",
      impact: "Unassigned bookings may experience service delays or remain unfulfilled.",
      fix: "Assign qualified staff members to pending bookings in the schedule.",
      actionLabel: "View Schedule",
      actionHref: "/crm/schedule",
      count: params.unassignedCount,
    });
  }

  // 2. Dispatch / Home service operational readiness checks
  if (params.dispatchAvailable) {
    if (params.dispatchItems && params.dispatchItems.length > 0) {
      const awaitingDriver = params.dispatchItems.filter(
        (item) =>
          !item.driverId && item.bookingStatus !== "cancelled" && item.bookingStatus !== "completed"
      );
      if (awaitingDriver.length > 0) {
        issues.push({
          id: "dispatch:awaiting-driver",
          scope: "dispatch",
          severity: "warning",
          title:
            awaitingDriver.length +
            " home-service booking" +
            (awaitingDriver.length > 1 ? "s" : "") +
            " awaiting driver assignment",
          problem:
            awaitingDriver.length +
            " active home-service booking(s) scheduled for today do not have an assigned driver.",
          impact: "Therapists may not be dispatched on time to customer locations.",
          fix: "Assign an available driver in Home Service dispatch.",
          actionLabel: "Open Dispatch",
          actionHref: "/crm/dispatch",
          count: awaitingDriver.length,
        });
      }

      const needsLocationReview = params.dispatchItems.filter(
        (item) => item.needsLocationReview && item.bookingStatus !== "cancelled"
      );
      if (needsLocationReview.length > 0) {
        issues.push({
          id: "dispatch:needs-location-review",
          scope: "dispatch",
          severity: "warning",
          title:
            needsLocationReview.length +
            " home-service booking" +
            (needsLocationReview.length > 1 ? "s" : "") +
            " need location review",
          problem:
            needsLocationReview.length +
            " home-service booking(s) require destination verification or coordinate confirmation.",
          impact: "Drivers may be unable to navigate accurately to service destinations.",
          fix: "Verify delivery address and location coordinates in Home Service.",
          actionLabel: "Review Location",
          actionHref: "/crm/dispatch",
          count: needsLocationReview.length,
        });
      }
    }
  } else {
    // If dispatch query failed, emit an explicit warning issue and mark available = false
    issues.push({
      id: "system:dispatch-readiness-unavailable",
      scope: "system",
      severity: "warning",
      title: "Home Service dispatch readiness could not be checked",
      problem: "Operational dispatch data could not be retrieved for Home Service bookings.",
      impact: "Driver assignment and location review warnings may not be displayed.",
      fix: "Refresh the workspace to retry loading dispatch readiness.",
      actionLabel: "Refresh",
      actionHref: "/crm/today",
    });
  }

  // Strictly filter out any payment issues
  const sanitizedIssues = filterDesktopReadinessIssues(issues);

  const status: ReadinessStatus = sanitizedIssues.some((i) => i.severity === "critical")
    ? "critical"
    : sanitizedIssues.some((i) => i.severity === "warning")
      ? "warning"
      : "ok";

  return {
    available: params.dispatchAvailable,
    status,
    issues: sanitizedIssues,
    error: params.dispatchAvailable
      ? null
      : (params.dispatchError ?? "Dispatch readiness checks could not be completed."),
  };
}

// ── Main Loader ───────────────────────────────────────────────────────────────

export async function getDesktopTodayData(
  ctx: CrmActionContext,
  branchName: string
): Promise<DesktopTodayData> {
  const branchId = ctx.me.branch_id;
  const businessDate = getBranchBusinessDate();

  // 1. Critical schedule and booking queries (throw on error)
  const [
    rawBookings,
    pendingQueue,
    dashStats,
    unassignedRes,
    dispatchResult,
    attendanceResult,
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
    getDispatchData({
      branchId,
      date: businessDate,
      supabase: ctx.supabase,
      throwOnError: true,
    }).then(
      (data) => ({ ok: true as const, data }),
      (err) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : "Dispatch unavailable",
      })
    ),
    getRecentAttendanceScanFeed({
      workspace: "crm",
      branchId,
      branchName,
      selectedDate: businessDate,
      maxItems: 5,
    }).then(
      (feed) => ({ ok: true as const, feed }),
      (err) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : "Attendance unavailable",
      })
    ),
    ctx.supabase
      .from("workspace_notifications")
      .select(
        "id, title, body, type, priority, requires_action, created_at, branch_id, target_workspace"
      )
      .eq("branch_id", branchId)
      .eq("target_workspace", "crm")
      .eq("requires_action", true)
      .in("status", ["unread", "read"])
      .not(
        "type",
        "in",
        "(payment_pending,payment_overdue,reconciliation_submitted,marketing_content_updated)"
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Critical check: unassigned count query must not fail silently into 0
  if (unassignedRes.error) {
    throw new Error("Failed to query unassigned bookings: " + unassignedRes.error.message);
  }

  // Combine and deduplicate bookings (schedule prioritized over pending queue)
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

  // Query resource names (throw on error to prevent fake null resource names)
  const resourceIds = [
    ...new Set(sortedBookings.map((b) => b.resource_id).filter(Boolean) as string[]),
  ];
  const resourceNameMap = new Map<string, string>();
  if (resourceIds.length > 0) {
    const { data: resources, error: resourceError } = await ctx.supabase
      .from("branch_resources")
      .select("id, name")
      .in("id", resourceIds);

    if (resourceError) {
      throw new Error("Failed to query branch resources: " + resourceError.message);
    }

    for (const r of resources ?? []) {
      resourceNameMap.set(r.id, r.name);
    }
  }

  // Authoritative Home Service auxiliary dispatch mapping
  const dispatchItemMap = new Map<string, RealDispatchItem>();
  const dispatchAlertMap = new Map<string, string>();
  const isDispatchAvailable = dispatchResult.ok;

  if (dispatchResult.ok) {
    for (const item of dispatchResult.data.items) {
      dispatchItemMap.set(item.id, item);
    }
    for (const alert of dispatchResult.data.alerts) {
      if (alert.bookingId) {
        dispatchAlertMap.set(alert.bookingId, alert.description);
      }
    }
  }

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
  };

  // Build normalized queue
  const queue: DesktopTodayQueueItem[] = sortedBookings.map((raw) => {
    const b = raw as unknown as ScheduleRowFields;
    const isHomeService = b.type === "home_service" || b.delivery_type === "home_service";
    const stage = getCradleFlowStage(b as unknown as CradleFlowBooking);

    // Map Home Service auxiliary context strictly from authoritative dispatch
    let dispatchContextAvailable: boolean | null = null;
    let driverId: string | null = null;
    let driverName: string | null = null;
    let noDriverWarning = false;
    let dispatchWarning: string | null = null;
    let needsLocationReview = false;
    let homeServiceAddress: string | null = null;

    if (isHomeService) {
      if (isDispatchAvailable) {
        const dItem = dispatchItemMap.get(b.id);
        if (dItem) {
          dispatchContextAvailable = true;
          driverId = dItem.driverId ?? null;
          driverName = dItem.driverName ?? null;
          noDriverWarning = dItem.driverId === null;
          dispatchWarning = dispatchAlertMap.get(b.id) ?? null;
          needsLocationReview = dItem.needsLocationReview ?? false;
          homeServiceAddress = dItem.formattedAddress ?? null;
        } else {
          // Home Service booking has no matching dispatch record for the loaded date
          dispatchContextAvailable = false;
          driverId = null;
          driverName = null;
          noDriverWarning = false;
          dispatchWarning =
            b.booking_date !== businessDate
              ? "Dispatch context not loaded for future date"
              : "Dispatch record not found";
          needsLocationReview = false;
          homeServiceAddress = null;
        }
      } else {
        // Dispatch query itself failed
        dispatchContextAvailable = false;
        driverId = null;
        driverName = null;
        noDriverWarning = false;
        dispatchWarning = "Dispatch context unavailable";
        needsLocationReview = false;
        homeServiceAddress = null;
      }
    } else {
      dispatchContextAvailable = null;
    }

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
      dispatchContextAvailable,
      driverId,
      driverName,
      noDriverWarning,
      dispatchWarning,
      needsLocationReview,
      homeServiceAddress,
    };
  });

  // Calculate CradleFlow counts for Today's operations (bookingDate === businessDate)
  let waiting = 0;
  let inService = 0;
  let readyToPay = 0;
  let completedService = 0;
  let homeService = 0;

  for (const item of queue) {
    if (item.bookingDate === businessDate) {
      if (item.stage === "waiting") waiting++;
      else if (item.stage === "in_service") inService++;
      else if (item.stage === "ready_to_pay") readyToPay++;
      else if (item.stage === "completed") completedService++;

      if (item.isHomeService && item.stage !== null) {
        homeService++;
      }
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

  // Map readiness truthfully (degradable optional section)
  let readiness: DesktopTodayReadiness;
  try {
    readiness = computeDesktopTodayReadiness({
      unassignedCount: unassignedRes.count ?? 0,
      dispatchAvailable: dispatchResult.ok,
      dispatchItems: dispatchResult.ok ? dispatchResult.data.items : null,
      dispatchError: dispatchResult.ok ? null : dispatchResult.error,
    });
  } catch (err) {
    readiness = {
      available: false,
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
      error: err instanceof Error ? err.message : "Readiness checks could not be loaded.",
    };
  }

  // Map attendance snapshot truthfully (degradable optional section)
  let attendance: DesktopTodayAttendance;
  if (attendanceResult.ok) {
    const feed = attendanceResult.feed;
    attendance = {
      available: !feed.error,
      selectedDate: feed.selectedDate,
      timezone: feed.timezone,
      lastHourCount: feed.lastHourCount,
      items: feed.items.map((item) => ({
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
      error: feed.error,
    };
  } else {
    attendance = {
      available: false,
      selectedDate: businessDate,
      timezone: "Asia/Manila",
      lastHourCount: 0,
      items: [],
      error: attendanceResult.error,
    };
  }

  // Map notifications truthfully (degradable optional section)
  let notifications: DesktopTodayNotifications;
  if (notificationsRes.error) {
    notifications = {
      available: false,
      items: [],
      error: "Notifications could not be refreshed.",
    };
  } else {
    const PRIORITY_RANK: Record<string, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    };

    const rawNotifications = notificationsRes.data ?? [];
    const sorted = [...rawNotifications].sort((a, b) => {
      const pDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (pDiff !== 0) return pDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    notifications = {
      available: true,
      items: sorted.slice(0, 5).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        priority: n.priority,
        createdAt: n.created_at,
        requiresAction: n.requires_action,
      })),
      error: null,
    };
  }

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
