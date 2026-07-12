import { getCurrentUserWorkspaceAccess } from "@/lib/auth/get-user-workspace-access";
import {
  getWorkspaceSwitchDestination,
  hasWorkspaceAccess,
} from "@/lib/auth/workspace-access";
import { MVP_CHECKIN_PAUSED } from "@/lib/config/mvp-flags";
import { BRANCH_TIMEZONE } from "@/lib/engine/slot-time";
import {
  addDaysToYmd,
  buildBranchPerformance,
  buildKpis,
  buildPayrollSnapshot,
  buildRevenueTrend,
  buildStaffSnapshot,
  buildTodayGlanceRows,
  dashboardLoadFromSettled,
  errorLoad,
  formatDashboardDateLabel,
  getDashboardLocalDate,
  getMonthStartYmd,
  getWeekStartYmd,
  hasOwnerDashboardAccess,
  mergeActionItems,
  readyLoad,
  type DashboardLoad,
  type OwnerDashboardActionItem,
  type OwnerDashboardBooking,
  type OwnerDashboardBranch,
  type OwnerDashboardBranchPerformance,
  type OwnerDashboardCheckin,
  type OwnerDashboardKpis,
  type OwnerDashboardPayrollSnapshot,
  type OwnerDashboardRevenuePeriod,
  type OwnerDashboardRevenuePoint,
  type OwnerDashboardSchedule,
  type OwnerDashboardStaff,
  type OwnerDashboardStaffSnapshot,
  type OwnerDashboardTodayRow,
} from "@/lib/owner/dashboard";
import {
  getPayrollDashboardData,
  type PayrollDashboardData,
} from "@/lib/queries/payroll";
import { createClient } from "@/lib/supabase/server";
import { getStaffAdminName } from "@/lib/staff/display-name";
import type { Database } from "@/types/supabase";

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type BranchRow = Pick<
  Database["public"]["Tables"]["branches"]["Row"],
  "id" | "name" | "is_active"
>;

type StaffRow = Pick<
  Database["public"]["Tables"]["staff"]["Row"],
  | "id"
  | "full_name"
  | "nickname"
  | "staff_type"
  | "system_role"
  | "branch_id"
  | "is_active"
  | "created_at"
>;

type ScheduleRow = Pick<
  Database["public"]["Tables"]["staff_schedules"]["Row"],
  "staff_id" | "day_of_week" | "start_time" | "end_time" | "is_active" | "shift_type"
>;

type CheckinRow = Pick<
  Database["public"]["Tables"]["staff_shift_checkins"]["Row"],
  "staff_id" | "branch_id" | "shift_date" | "status"
>;

type NotificationRow = Pick<
  Database["public"]["Tables"]["workspace_notifications"]["Row"],
  "id" | "title" | "body" | "priority" | "created_at" | "action_href"
>;

type WorkflowTaskRow = Pick<
  Database["public"]["Tables"]["workflow_tasks"]["Row"],
  "id" | "title" | "body" | "priority" | "created_at" | "action_href" | "assigned_to_role"
>;

type BookingRow = Pick<
  Database["public"]["Tables"]["bookings"]["Row"],
  | "id"
  | "branch_id"
  | "booking_date"
  | "start_time"
  | "end_time"
  | "status"
  | "booking_progress_status"
  | "payment_status"
  | "amount_paid"
  | "completed_at"
  | "session_completed_at"
> & {
  customers: { full_name: string | null } | null;
  services: { name: string | null } | null;
  staff: {
    id: string | null;
    full_name: string | null;
    nickname: string | null;
    staff_type: string | null;
  } | null;
  branches: { id: string | null; name: string | null } | null;
};

export type OwnerOverviewDashboardData = {
  ownerName: string;
  today: string;
  todayLabel: string;
  generatedAt: string;
  kpis: DashboardLoad<OwnerDashboardKpis>;
  attention: DashboardLoad<OwnerDashboardActionItem[]>;
  todayGlance: DashboardLoad<{
    branches: OwnerDashboardBranch[];
    rows: OwnerDashboardTodayRow[];
  }>;
  branchPerformance: DashboardLoad<{
    today: OwnerDashboardBranchPerformance[];
    week: OwnerDashboardBranchPerformance[];
    month: OwnerDashboardBranchPerformance[];
  }>;
  revenueTrend: DashboardLoad<Record<OwnerDashboardRevenuePeriod, OwnerDashboardRevenuePoint[]>>;
  staffSnapshot: DashboardLoad<OwnerDashboardStaffSnapshot>;
  payroll: DashboardLoad<OwnerDashboardPayrollSnapshot>;
  pendingActions: DashboardLoad<OwnerDashboardActionItem[]>;
};

export class OwnerDashboardAccessError extends Error {
  constructor(public readonly destination: string, message: string) {
    super(message);
    this.name = "OwnerDashboardAccessError";
  }
}

export async function getOwnerOverviewDashboardData(
  now = new Date()
): Promise<OwnerOverviewDashboardData> {
  const access = await getCurrentUserWorkspaceAccess();

  if (!access) {
    throw new OwnerDashboardAccessError("/login", "Sign in is required.");
  }

  if (
    !hasWorkspaceAccess(access.workspaces, "owner") ||
    !hasOwnerDashboardAccess(access.workspaces)
  ) {
    throw new OwnerDashboardAccessError(
      getWorkspaceSwitchDestination(access.workspaces),
      "Owner workspace access is required."
    );
  }

  const supabase = await createClient();
  const today = getDashboardLocalDate(now, BRANCH_TIMEZONE);
  const yesterday = addDaysToYmd(today, -1);
  const weekStart = getWeekStartYmd(today);
  const monthStart = getMonthStartYmd(today);
  const last30Start = addDaysToYmd(today, -29);
  const dayOfWeek = getDayOfWeek(today);

  const [
    ownerProfileResult,
    branchesResult,
    staffResult,
    bookingsResult,
    schedulesResult,
    checkinsResult,
    notificationsResult,
    tasksResult,
    payrollResult,
  ] = await Promise.allSettled([
    loadOwnerProfileName(access.user.id),
    queryOrThrow<BranchRow[]>(
      supabase
        .from("branches")
        .select("id, name, is_active")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      "Could not load branches",
      []
    ),
    queryOrThrow<StaffRow[]>(
      supabase
        .from("staff")
        .select(
          "id, full_name, nickname, staff_type, system_role, branch_id, is_active, created_at"
        )
        .order("full_name", { ascending: true }),
      "Could not load team members",
      []
    ),
    queryOrThrow<BookingRow[]>(
      supabase
        .from("bookings")
        .select(
          `id, branch_id, booking_date, start_time, end_time, status,
           booking_progress_status, payment_status, amount_paid, completed_at,
           session_completed_at,
           customers(full_name),
           services(name),
           staff!bookings_staff_id_fkey(id, full_name, nickname, staff_type),
           branches(id, name)`
        )
        .gte("booking_date", last30Start)
        .lte("booking_date", today)
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true }),
      "Could not load bookings",
      []
    ),
    queryOrThrow<ScheduleRow[]>(
      supabase
        .from("staff_schedules")
        .select("staff_id, day_of_week, start_time, end_time, is_active, shift_type")
        .eq("day_of_week", dayOfWeek)
        .eq("is_active", true),
      "Could not load today schedule",
      []
    ),
    queryOrThrow<CheckinRow[]>(
      supabase
        .from("staff_shift_checkins")
        .select("staff_id, branch_id, shift_date, status")
        .eq("shift_date", today)
        .eq("is_test", false),
      "Could not load shift check-ins",
      []
    ),
    queryOrThrow<NotificationRow[]>(
      supabase
        .from("workspace_notifications")
        .select("id, title, body, priority, created_at, action_href")
        .eq("target_workspace", "owner")
        .eq("requires_action", true)
        .is("resolved_at", null)
        .in("status", ["unread", "read"])
        .order("created_at", { ascending: false })
        .limit(12),
      "Could not load owner notifications",
      []
    ),
    queryOrThrow<WorkflowTaskRow[]>(
      supabase
        .from("workflow_tasks")
        .select(
          "id, title, body, priority, created_at, action_href, assigned_to_role"
        )
        .eq("workspace_scope", "owner")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(12),
      "Could not load workflow tasks",
      []
    ),
    getPayrollDashboardData(now),
  ]);

  const ownerName =
    ownerProfileResult.status === "fulfilled" ? ownerProfileResult.value : "Owner";
  const branches = dashboardLoadFromSettled(
    branchesResult,
    "Branches are unavailable right now."
  );
  const staff = dashboardLoadFromSettled(
    staffResult,
    "Team members are unavailable right now."
  );
  const bookings = dashboardLoadFromSettled(
    bookingsResult,
    "Bookings are unavailable right now."
  );
  const schedules = dashboardLoadFromSettled(
    schedulesResult,
    "Today schedule is unavailable right now."
  );
  const checkins = dashboardLoadFromSettled(
    checkinsResult,
    "Shift check-ins are unavailable right now."
  );
  const notifications = dashboardLoadFromSettled(
    notificationsResult,
    "Owner notifications are unavailable right now."
  );
  const tasks = dashboardLoadFromSettled(
    tasksResult,
    "Workflow tasks are unavailable right now."
  );
  const payroll = dashboardLoadFromSettled<PayrollDashboardData>(
    payrollResult,
    "Payroll data is unavailable right now."
  );

  const actionItems = buildActionItems(notifications, tasks);

  return {
    ownerName,
    today,
    todayLabel: formatDashboardDateLabel(today),
    generatedAt: now.toISOString(),
    kpis: buildKpiLoad({ bookings, branches, staff, today, yesterday }),
    attention: actionItems,
    todayGlance: buildTodayGlanceLoad({ bookings, branches, today }),
    branchPerformance: buildBranchPerformanceLoad({
      bookings,
      branches,
      today,
      weekStart,
      monthStart,
    }),
    revenueTrend: buildRevenueTrendLoad({
      bookings,
      today,
      weekStart,
      monthStart,
      last30Start,
    }),
    staffSnapshot: buildStaffSnapshotLoad({
      staff,
      schedules,
      checkins,
      today,
    }),
    payroll: payroll.status === "ready" ? readyLoad(buildPayrollSnapshot(payroll.data)) : payroll,
    pendingActions: actionItems,
  };
}

async function loadOwnerProfileName(userId: string): Promise<string> {
  const supabase = await createClient();
  const row = await queryOrThrow<
    Pick<Database["public"]["Tables"]["staff"]["Row"], "full_name" | "nickname"> | null
  >(
    supabase
      .from("staff")
      .select("full_name, nickname")
      .eq("auth_user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    "Could not load owner profile",
    null
  );

  if (!row) return "Owner";
  return getStaffAdminName(row);
}

async function queryOrThrow<T>(
  resultPromise: PromiseLike<SupabaseResult<T>>,
  fallbackMessage: string,
  fallbackData: T
): Promise<T> {
  const { data, error } = await resultPromise;
  if (error) {
    throw new Error(`${fallbackMessage}: ${error.message}`);
  }
  return data ?? fallbackData;
}

function buildKpiLoad(params: {
  bookings: DashboardLoad<OwnerDashboardBooking[]>;
  branches: DashboardLoad<OwnerDashboardBranch[]>;
  staff: DashboardLoad<OwnerDashboardStaff[]>;
  today: string;
  yesterday: string;
}): DashboardLoad<OwnerDashboardKpis> {
  if (params.bookings.status === "error") return errorLoad(params.bookings.message);
  if (params.branches.status === "error") return errorLoad(params.branches.message);
  if (params.staff.status === "error") return errorLoad(params.staff.message);

  return readyLoad(
    buildKpis({
      bookings: params.bookings.data,
      branches: params.branches.data,
      staff: params.staff.data,
      today: params.today,
      yesterday: params.yesterday,
      timezone: BRANCH_TIMEZONE,
    })
  );
}

function buildTodayGlanceLoad(params: {
  bookings: DashboardLoad<OwnerDashboardBooking[]>;
  branches: DashboardLoad<OwnerDashboardBranch[]>;
  today: string;
}): DashboardLoad<{ branches: OwnerDashboardBranch[]; rows: OwnerDashboardTodayRow[] }> {
  if (params.bookings.status === "error") return errorLoad(params.bookings.message);
  if (params.branches.status === "error") return errorLoad(params.branches.message);

  return readyLoad({
    branches: params.branches.data.filter((branch) => branch.is_active),
    rows: buildTodayGlanceRows({
      bookings: params.bookings.data,
      branches: params.branches.data,
      today: params.today,
    }),
  });
}

function buildBranchPerformanceLoad(params: {
  bookings: DashboardLoad<OwnerDashboardBooking[]>;
  branches: DashboardLoad<OwnerDashboardBranch[]>;
  today: string;
  weekStart: string;
  monthStart: string;
}): DashboardLoad<{
  today: OwnerDashboardBranchPerformance[];
  week: OwnerDashboardBranchPerformance[];
  month: OwnerDashboardBranchPerformance[];
}> {
  if (params.bookings.status === "error") return errorLoad(params.bookings.message);
  if (params.branches.status === "error") return errorLoad(params.branches.message);

  return readyLoad({
    today: buildBranchPerformance({
      branches: params.branches.data,
      bookings: params.bookings.data,
      from: params.today,
      to: params.today,
    }),
    week: buildBranchPerformance({
      branches: params.branches.data,
      bookings: params.bookings.data,
      from: params.weekStart,
      to: params.today,
    }),
    month: buildBranchPerformance({
      branches: params.branches.data,
      bookings: params.bookings.data,
      from: params.monthStart,
      to: params.today,
    }),
  });
}

function buildRevenueTrendLoad(params: {
  bookings: DashboardLoad<OwnerDashboardBooking[]>;
  today: string;
  weekStart: string;
  monthStart: string;
  last30Start: string;
}): DashboardLoad<Record<OwnerDashboardRevenuePeriod, OwnerDashboardRevenuePoint[]>> {
  if (params.bookings.status === "error") return errorLoad(params.bookings.message);

  return readyLoad({
    week: buildRevenueTrend({
      bookings: params.bookings.data,
      from: params.weekStart,
      to: params.today,
    }),
    month: buildRevenueTrend({
      bookings: params.bookings.data,
      from: params.monthStart,
      to: params.today,
    }),
    last30: buildRevenueTrend({
      bookings: params.bookings.data,
      from: params.last30Start,
      to: params.today,
    }),
  });
}

function buildStaffSnapshotLoad(params: {
  staff: DashboardLoad<OwnerDashboardStaff[]>;
  schedules: DashboardLoad<OwnerDashboardSchedule[]>;
  checkins: DashboardLoad<OwnerDashboardCheckin[]>;
  today: string;
}): DashboardLoad<OwnerDashboardStaffSnapshot> {
  if (params.staff.status === "error") return errorLoad(params.staff.message);
  if (MVP_CHECKIN_PAUSED && params.schedules.status === "error") {
    return errorLoad(params.schedules.message);
  }
  if (!MVP_CHECKIN_PAUSED && params.checkins.status === "error") {
    return errorLoad(params.checkins.message);
  }

  return readyLoad(
    buildStaffSnapshot({
      staff: params.staff.data,
      schedules: params.schedules.status === "ready" ? params.schedules.data : [],
      checkins: params.checkins.status === "ready" ? params.checkins.data : [],
      today: params.today,
      checkinPaused: MVP_CHECKIN_PAUSED,
    })
  );
}

function buildActionItems(
  notifications: DashboardLoad<NotificationRow[]>,
  tasks: DashboardLoad<WorkflowTaskRow[]>
): DashboardLoad<OwnerDashboardActionItem[]> {
  if (notifications.status === "error") return errorLoad(notifications.message);
  if (tasks.status === "error") return errorLoad(tasks.message);

  return readyLoad(
    mergeActionItems({
      notifications: notifications.data.map((notification) => ({
        id: notification.id,
        source: "notification",
        title: notification.title,
        body: notification.body,
        priority: notification.priority,
        created_at: notification.created_at,
        action_href: notification.action_href,
      })),
      tasks: tasks.data.map((task) => ({
        id: task.id,
        source: "task",
        title: task.title,
        body: task.body,
        priority: task.priority,
        created_at: task.created_at,
        action_href: task.action_href,
        assignee: task.assigned_to_role,
      })),
      limit: 12,
    })
  );
}

function getDayOfWeek(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}
