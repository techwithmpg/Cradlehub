import type { PayrollDashboardData } from "@/lib/queries/payroll";

export type DashboardLoad<T> =
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export type OwnerDashboardBranch = {
  id: string;
  name: string;
  is_active: boolean;
};

export type OwnerDashboardStaff = {
  id: string;
  full_name: string | null;
  nickname?: string | null;
  staff_type: string | null;
  system_role: string | null;
  branch_id: string | null;
  is_active: boolean;
  created_at?: string | null;
};

export type OwnerDashboardBooking = {
  id: string;
  branch_id: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string | null;
  booking_progress_status?: string | null;
  payment_status: string | null;
  amount_paid: number | null;
  completed_at: string | null;
  session_completed_at: string | null;
  customers?: { full_name?: string | null } | null;
  services?: { name?: string | null } | null;
  staff?: {
    id?: string | null;
    full_name?: string | null;
    nickname?: string | null;
    staff_type?: string | null;
  } | null;
  branches?: { id?: string | null; name?: string | null } | null;
};

export type OwnerDashboardSchedule = {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  shift_type: string | null;
};

export type OwnerDashboardCheckin = {
  staff_id: string;
  branch_id: string | null;
  shift_date: string;
  status: string;
};

export type OwnerDashboardActionItem = {
  id: string;
  source: "notification" | "task";
  title: string;
  body: string | null;
  priority: string;
  created_at: string;
  action_href: string | null;
  assignee?: string | null;
};

export type OwnerDashboardKpis = {
  todayBookings: number;
  yesterdayBookings: number;
  completedToday: number;
  completedYesterday: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  activeBranches: number;
  activeStaff: number;
  newStaffThisWeek: number;
};

export type OwnerDashboardTodayRow = {
  id: string;
  branch_id: string | null;
  branchName: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  startTime: string;
  endTime: string;
  status: string;
};

export type OwnerDashboardBranchPerformance = {
  id: string;
  name: string;
  bookings: number;
  completed: number;
  revenue: number;
  revenueSharePercent: number;
};

export type OwnerDashboardRevenuePoint = {
  date: string;
  label: string;
  revenue: number;
};

export type OwnerDashboardStaffRole = {
  label: string;
  count: number;
  percent: number;
};

export type OwnerDashboardStaffSnapshot = {
  totalStaff: number;
  onShift: number;
  offShift: number;
  topRoles: OwnerDashboardStaffRole[];
};

export type OwnerDashboardPayrollSnapshot = {
  estimatedCost: number;
  paidToDate: number;
  pending: number;
  totalIncludedStaff: number;
  paidStaff: number;
  unpaidStaff: number;
  progress: number;
  missingSalaryCount: number;
  needsSetup: boolean;
  nextPayrollDateLabel: string;
};

export type OwnerDashboardPeriod = "today" | "week" | "month";
export type OwnerDashboardRevenuePeriod = "week" | "month" | "last30";

const CLOSED_BOOKING_STATUSES = new Set([
  "cancelled",
  "canceled",
  "no_show",
  "expired",
]);

const PAID_BOOKING_STATUSES = new Set(["paid"]);

const REFUNDED_PAYMENT_STATUSES = new Set([
  "refunded",
  "partially_refunded",
  "voided",
]);

export function readyLoad<T>(data: T): DashboardLoad<T> {
  return { status: "ready", data };
}

export function errorLoad<T>(message: string): DashboardLoad<T> {
  return { status: "error", message };
}

export function dashboardLoadFromSettled<T>(
  result: PromiseSettledResult<T>,
  message: string
): DashboardLoad<T> {
  if (result.status === "fulfilled") return readyLoad(result.value);
  return errorLoad(message);
}

export function getDashboardLocalDate(
  now = new Date(),
  timezone = "Asia/Manila"
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return toYmd(now);
  }
}

export function formatDashboardDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function addDaysToYmd(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + days);
  return toYmd(next);
}

export function getWeekStartYmd(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const current = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const weekday = current.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  current.setUTCDate(current.getUTCDate() + mondayOffset);
  return toYmd(current);
}

export function getMonthStartYmd(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return `${String(year ?? 1970).padStart(4, "0")}-${String(
    month ?? 1
  ).padStart(2, "0")}-01`;
}

export function enumerateYmdRange(from: string, to: string): string[] {
  if (from > to) return [];
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    cursor = addDaysToYmd(cursor, 1);
  }
  return days;
}

export function isClosedBookingStatus(status: string | null | undefined): boolean {
  return CLOSED_BOOKING_STATUSES.has(String(status ?? "").toLowerCase());
}

export function isActiveDashboardBooking(
  booking: Pick<OwnerDashboardBooking, "status">
): boolean {
  return !isClosedBookingStatus(booking.status);
}

export function getBookingPaymentAmount(
  booking: Pick<OwnerDashboardBooking, "amount_paid">
): number {
  const amount = Number(booking.amount_paid ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function isPaidDashboardBooking(
  booking: Pick<OwnerDashboardBooking, "status" | "payment_status" | "amount_paid">
): boolean {
  const paymentStatus = String(booking.payment_status ?? "").toLowerCase();
  return (
    isActiveDashboardBooking(booking) &&
    PAID_BOOKING_STATUSES.has(paymentStatus) &&
    !REFUNDED_PAYMENT_STATUSES.has(paymentStatus) &&
    getBookingPaymentAmount(booking) > 0
  );
}

export function getTimestampLocalYmd(
  timestamp: string | null | undefined,
  timezone = "Asia/Manila"
): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return getDashboardLocalDate(date, timezone);
}

export function calculateTodayBookingCount(
  bookings: readonly OwnerDashboardBooking[],
  date: string
): number {
  return bookings.filter(
    (booking) => booking.booking_date === date && isActiveDashboardBooking(booking)
  ).length;
}

export function calculateCompletedTodayCount(
  bookings: readonly OwnerDashboardBooking[],
  date: string,
  timezone = "Asia/Manila"
): number {
  return bookings.filter((booking) => {
    const completedDate =
      getTimestampLocalYmd(booking.session_completed_at, timezone) ??
      getTimestampLocalYmd(booking.completed_at, timezone);
    return completedDate === date && isActiveDashboardBooking(booking);
  }).length;
}

export function calculateTodayRevenue(
  bookings: readonly OwnerDashboardBooking[],
  date: string
): number {
  return roundCurrency(
    bookings
      .filter(
        (booking) =>
          booking.booking_date === date && isPaidDashboardBooking(booking)
      )
      .reduce((sum, booking) => sum + getBookingPaymentAmount(booking), 0)
  );
}

export function calculateActiveBranchCount(
  branches: readonly OwnerDashboardBranch[]
): number {
  return branches.filter((branch) => branch.is_active).length;
}

export function calculateActiveStaffCount(
  staff: readonly OwnerDashboardStaff[]
): number {
  return getActiveNonOwnerStaff(staff).length;
}

export function calculateNewStaffThisWeek(
  staff: readonly OwnerDashboardStaff[],
  today: string
): number {
  const start = addDaysToYmd(today, -6);
  return getActiveNonOwnerStaff(staff).filter((member) => {
    const created = member.created_at?.slice(0, 10);
    return created ? created >= start && created <= today : false;
  }).length;
}

export function buildKpis(params: {
  bookings: readonly OwnerDashboardBooking[];
  branches: readonly OwnerDashboardBranch[];
  staff: readonly OwnerDashboardStaff[];
  today: string;
  yesterday: string;
  timezone?: string;
}): OwnerDashboardKpis {
  const timezone = params.timezone ?? "Asia/Manila";
  return {
    todayBookings: calculateTodayBookingCount(params.bookings, params.today),
    yesterdayBookings: calculateTodayBookingCount(
      params.bookings,
      params.yesterday
    ),
    completedToday: calculateCompletedTodayCount(
      params.bookings,
      params.today,
      timezone
    ),
    completedYesterday: calculateCompletedTodayCount(
      params.bookings,
      params.yesterday,
      timezone
    ),
    todayRevenue: calculateTodayRevenue(params.bookings, params.today),
    yesterdayRevenue: calculateTodayRevenue(params.bookings, params.yesterday),
    activeBranches: calculateActiveBranchCount(params.branches),
    activeStaff: calculateActiveStaffCount(params.staff),
    newStaffThisWeek: calculateNewStaffThisWeek(params.staff, params.today),
  };
}

export function buildTodayGlanceRows(params: {
  bookings: readonly OwnerDashboardBooking[];
  branches: readonly OwnerDashboardBranch[];
  today: string;
}): OwnerDashboardTodayRow[] {
  const branchNames = new Map(
    params.branches.map((branch) => [branch.id, branch.name])
  );
  return params.bookings
    .filter(
      (booking) =>
        booking.booking_date === params.today && isActiveDashboardBooking(booking)
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((booking) => ({
      id: booking.id,
      branch_id: booking.branch_id,
      branchName:
        booking.branches?.name ??
        (booking.branch_id ? branchNames.get(booking.branch_id) : null) ??
        "Unassigned branch",
      customerName: booking.customers?.full_name ?? "Walk-in guest",
      serviceName: booking.services?.name ?? "Service",
      staffName: getStaffDisplayName(booking.staff),
      startTime: booking.start_time,
      endTime: booking.end_time,
      status: booking.status ?? "scheduled",
    }));
}

export function buildBranchPerformance(params: {
  branches: readonly OwnerDashboardBranch[];
  bookings: readonly OwnerDashboardBooking[];
  from: string;
  to: string;
}): OwnerDashboardBranchPerformance[] {
  const activeBranches = params.branches.filter((branch) => branch.is_active);
  const rows = activeBranches.map((branch) => {
    const branchBookings = params.bookings.filter(
      (booking) =>
        booking.branch_id === branch.id &&
        booking.booking_date >= params.from &&
        booking.booking_date <= params.to &&
        isActiveDashboardBooking(booking)
    );
    return {
      id: branch.id,
      name: branch.name,
      bookings: branchBookings.length,
      completed: branchBookings.filter((booking) =>
        Boolean(booking.session_completed_at ?? booking.completed_at)
      ).length,
      revenue: roundCurrency(
        branchBookings
          .filter(isPaidDashboardBooking)
          .reduce((sum, booking) => sum + getBookingPaymentAmount(booking), 0)
      ),
      revenueSharePercent: 0,
    };
  });

  const maxRevenue = Math.max(0, ...rows.map((row) => row.revenue));
  return rows.map((row) => ({
    ...row,
    revenueSharePercent:
      maxRevenue > 0 ? Math.round((row.revenue / maxRevenue) * 100) : 0,
  }));
}

export function buildRevenueTrend(params: {
  bookings: readonly OwnerDashboardBooking[];
  from: string;
  to: string;
}): OwnerDashboardRevenuePoint[] {
  return enumerateYmdRange(params.from, params.to).map((date) => {
    const revenue = calculateTodayRevenue(params.bookings, date);
    return {
      date,
      label: formatShortDate(date),
      revenue,
    };
  });
}

export function buildStaffSnapshot(params: {
  staff: readonly OwnerDashboardStaff[];
  schedules: readonly OwnerDashboardSchedule[];
  checkins: readonly OwnerDashboardCheckin[];
  today: string;
  checkinPaused: boolean;
}): OwnerDashboardStaffSnapshot {
  const activeStaff = getActiveNonOwnerStaff(params.staff);
  const activeStaffIds = new Set(activeStaff.map((member) => member.id));
  const scheduledStaffIds = new Set(
    params.schedules
      .filter(
        (schedule) =>
          schedule.is_active && activeStaffIds.has(schedule.staff_id)
      )
      .map((schedule) => schedule.staff_id)
  );
  const checkedInStaffIds = new Set(
    params.checkins
      .filter(
        (checkin) =>
          checkin.shift_date === params.today &&
          checkin.status === "checked_in" &&
          activeStaffIds.has(checkin.staff_id)
      )
      .map((checkin) => checkin.staff_id)
  );
  const onShift = params.checkinPaused
    ? scheduledStaffIds.size
    : checkedInStaffIds.size;
  const roleCounts = new Map<string, number>();

  for (const staffId of params.checkinPaused ? scheduledStaffIds : checkedInStaffIds) {
    const member = activeStaff.find((item) => item.id === staffId);
    if (!member) continue;
    const label = formatStaffRole(member.staff_type, member.system_role);
    roleCounts.set(label, (roleCounts.get(label) ?? 0) + 1);
  }

  const topRoles = [...roleCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([label, count]) => ({
      label,
      count,
      percent: onShift > 0 ? Math.round((count / onShift) * 100) : 0,
    }));

  return {
    totalStaff: activeStaff.length,
    onShift,
    offShift: Math.max(0, activeStaff.length - onShift),
    topRoles,
  };
}

export function buildPayrollSnapshot(
  payroll: PayrollDashboardData
): OwnerDashboardPayrollSnapshot {
  const estimatedCost = roundCurrency(payroll.summary.totalMonthlyPayroll);
  const paidToDate = roundCurrency(
    payroll.staffRows
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + row.monthly_pay, 0)
  );
  const pending = roundCurrency(Math.max(0, estimatedCost - paidToDate));
  const missingSalaryCount = payroll.staffRows.filter(
    (row) => !row.has_monthly_pay
  ).length;

  return {
    estimatedCost,
    paidToDate,
    pending,
    totalIncludedStaff: payroll.summary.totalIncludedStaff,
    paidStaff: payroll.summary.paidStaff,
    unpaidStaff: payroll.summary.unpaidStaff,
    progress: payroll.summary.payrollProgress,
    missingSalaryCount,
    needsSetup: missingSalaryCount > 0 || payroll.summary.totalIncludedStaff === 0,
    nextPayrollDateLabel: payroll.summary.nextPayrollDateLabel,
  };
}

export function mergeActionItems(params: {
  notifications: readonly OwnerDashboardActionItem[];
  tasks: readonly OwnerDashboardActionItem[];
  limit?: number;
}): OwnerDashboardActionItem[] {
  const priorityRank = new Map([
    ["urgent", 0],
    ["high", 1],
    ["normal", 2],
    ["medium", 2],
    ["low", 3],
  ]);
  return [...params.notifications, ...params.tasks]
    .sort((a, b) => {
      const priority =
        (priorityRank.get(a.priority) ?? 2) -
        (priorityRank.get(b.priority) ?? 2);
      if (priority !== 0) return priority;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(0, params.limit ?? 20);
}

export function hasOwnerDashboardAccess(
  workspaces: readonly { key: string }[]
): boolean {
  return workspaces.some((workspace) => workspace.key === "owner");
}

function getActiveNonOwnerStaff(
  staff: readonly OwnerDashboardStaff[]
): OwnerDashboardStaff[] {
  return staff.filter(
    (member) => member.is_active && member.system_role !== "owner"
  );
}

function getStaffDisplayName(
  staff: OwnerDashboardBooking["staff"]
): string {
  if (!staff) return "Unassigned";
  const nickname = staff.nickname?.trim();
  if (nickname) return nickname;
  return staff.full_name?.trim() || "Unassigned";
}

function formatStaffRole(staffType: string | null, systemRole: string | null): string {
  const value = staffType ?? systemRole ?? "Staff";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatShortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function toYmd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
