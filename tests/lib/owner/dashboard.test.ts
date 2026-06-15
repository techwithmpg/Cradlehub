import { describe, expect, it } from "vitest";
import {
  buildBranchPerformance,
  buildKpis,
  buildPayrollSnapshot,
  buildStaffSnapshot,
  buildTodayGlanceRows,
  calculateActiveBranchCount,
  calculateActiveStaffCount,
  calculateCompletedTodayCount,
  calculateTodayBookingCount,
  calculateTodayRevenue,
  dashboardLoadFromSettled,
  hasOwnerDashboardAccess,
  mergeActionItems,
  type OwnerDashboardActionItem,
  type OwnerDashboardBooking,
  type OwnerDashboardBranch,
  type OwnerDashboardCheckin,
  type OwnerDashboardSchedule,
  type OwnerDashboardStaff,
} from "../../../src/lib/owner/dashboard";
import type { PayrollDashboardData } from "../../../src/lib/queries/payroll";

const TODAY = "2026-06-15";
const YESTERDAY = "2026-06-14";

function booking(overrides: Partial<OwnerDashboardBooking> = {}): OwnerDashboardBooking {
  return {
    id: overrides.id ?? "booking-1",
    branch_id: overrides.branch_id ?? "branch-1",
    booking_date: overrides.booking_date ?? TODAY,
    start_time: overrides.start_time ?? "09:00:00",
    end_time: overrides.end_time ?? "10:00:00",
    status: overrides.status ?? "confirmed",
    booking_progress_status: overrides.booking_progress_status ?? "scheduled",
    payment_status: overrides.payment_status ?? "pending",
    amount_paid: overrides.amount_paid ?? 0,
    completed_at: overrides.completed_at ?? null,
    session_completed_at: overrides.session_completed_at ?? null,
    customers: overrides.customers ?? { full_name: "Mia Reyes" },
    services: overrides.services ?? { name: "Massage" },
    staff: overrides.staff ?? {
      id: "staff-1",
      full_name: "Gemma Ciocon",
      nickname: "Gemma",
      staff_type: "therapist",
    },
    branches: overrides.branches ?? { id: "branch-1", name: "Main Spa" },
  };
}

function staff(overrides: Partial<OwnerDashboardStaff> = {}): OwnerDashboardStaff {
  return {
    id: overrides.id ?? "staff-1",
    full_name: overrides.full_name ?? "Team Member",
    nickname: overrides.nickname ?? null,
    staff_type: overrides.staff_type ?? "therapist",
    system_role: overrides.system_role ?? "staff",
    branch_id: overrides.branch_id ?? "branch-1",
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at ?? "2026-06-10T00:00:00.000Z",
  };
}

const branches: OwnerDashboardBranch[] = [
  { id: "branch-1", name: "Main Spa", is_active: true },
  { id: "branch-2", name: "East Branch", is_active: true },
  { id: "branch-3", name: "Closed Branch", is_active: false },
];

describe("owner dashboard business rules", () => {
  it("counts today's bookings while excluding closed statuses", () => {
    const bookings = [
      booking({ id: "active" }),
      booking({ id: "cancelled", status: "cancelled" }),
      booking({ id: "no-show", status: "no_show" }),
      booking({ id: "expired", status: "expired" }),
      booking({ id: "yesterday", booking_date: YESTERDAY }),
    ];

    expect(calculateTodayBookingCount(bookings, TODAY)).toBe(1);
  });

  it("counts completed today only from completion timestamps", () => {
    const bookings = [
      booking({
        id: "session-completed",
        session_completed_at: "2026-06-15T02:00:00.000Z",
      }),
      booking({
        id: "completed-at",
        completed_at: "2026-06-15T03:00:00.000Z",
      }),
      booking({
        id: "status-only",
        status: "completed",
        completed_at: null,
        session_completed_at: null,
      }),
    ];

    expect(calculateCompletedTodayCount(bookings, TODAY, "Asia/Manila")).toBe(2);
  });

  it("sums paid revenue from amount_paid for active bookings only", () => {
    const bookings = [
      booking({ id: "paid", payment_status: "paid", amount_paid: 1200 }),
      booking({ id: "unpaid", payment_status: "pending", amount_paid: 900 }),
      booking({
        id: "cancelled-paid",
        status: "cancelled",
        payment_status: "paid",
        amount_paid: 700,
      }),
      booking({
        id: "yesterday-paid",
        booking_date: YESTERDAY,
        payment_status: "paid",
        amount_paid: 500,
      }),
    ];

    expect(calculateTodayRevenue(bookings, TODAY)).toBe(1200);
  });

  it("counts active branches and active non-owner team members", () => {
    const staffRows = [
      staff({ id: "staff-1" }),
      staff({ id: "owner", system_role: "owner" }),
      staff({ id: "inactive", is_active: false }),
    ];

    expect(calculateActiveBranchCount(branches)).toBe(2);
    expect(calculateActiveStaffCount(staffRows)).toBe(1);
  });

  it("builds the KPI payload with comparisons and new staff count", () => {
    const result = buildKpis({
      bookings: [
        booking({ id: "today", payment_status: "paid", amount_paid: 1000 }),
        booking({
          id: "yesterday",
          booking_date: YESTERDAY,
          payment_status: "paid",
          amount_paid: 500,
        }),
      ],
      branches,
      staff: [
        staff({ id: "new", created_at: "2026-06-12T00:00:00.000Z" }),
        staff({ id: "old", created_at: "2026-04-01T00:00:00.000Z" }),
      ],
      today: TODAY,
      yesterday: YESTERDAY,
    });

    expect(result).toMatchObject({
      todayBookings: 1,
      yesterdayBookings: 1,
      todayRevenue: 1000,
      yesterdayRevenue: 500,
      activeBranches: 2,
      activeStaff: 2,
      newStaffThisWeek: 1,
    });
  });

  it("returns an empty today glance when there is no schedule", () => {
    expect(
      buildTodayGlanceRows({ bookings: [], branches, today: TODAY })
    ).toEqual([]);
  });

  it("normalizes branch performance against the highest revenue branch", () => {
    const result = buildBranchPerformance({
      branches,
      bookings: [
        booking({
          id: "main",
          branch_id: "branch-1",
          payment_status: "paid",
          amount_paid: 2000,
        }),
        booking({
          id: "east",
          branch_id: "branch-2",
          payment_status: "paid",
          amount_paid: 1000,
        }),
      ],
      from: TODAY,
      to: TODAY,
    });

    expect(result.map((row) => [row.id, row.revenue, row.revenueSharePercent]))
      .toEqual([
        ["branch-1", 2000, 100],
        ["branch-2", 1000, 50],
      ]);
  });

  it("uses scheduled staff for on-shift counts while check-ins are paused", () => {
    const schedules: OwnerDashboardSchedule[] = [
      {
        staff_id: "staff-1",
        day_of_week: 1,
        start_time: "09:00:00",
        end_time: "18:00:00",
        is_active: true,
        shift_type: "regular",
      },
      {
        staff_id: "staff-2",
        day_of_week: 1,
        start_time: "09:00:00",
        end_time: "18:00:00",
        is_active: true,
        shift_type: "regular",
      },
    ];
    const staffRows = [
      staff({ id: "staff-1", staff_type: "therapist" }),
      staff({ id: "staff-2", staff_type: "front_desk" }),
      staff({ id: "owner", system_role: "owner" }),
    ];

    const result = buildStaffSnapshot({
      staff: staffRows,
      schedules,
      checkins: [],
      today: TODAY,
      checkinPaused: true,
    });

    expect(result.totalStaff).toBe(2);
    expect(result.onShift).toBe(2);
    expect(result.topRoles.map((role) => role.label)).toEqual([
      "Front Desk",
      "Therapist",
    ]);
  });

  it("uses active check-ins when check-ins are enabled", () => {
    const checkins: OwnerDashboardCheckin[] = [
      {
        staff_id: "staff-1",
        branch_id: "branch-1",
        shift_date: TODAY,
        status: "checked_in",
      },
      {
        staff_id: "staff-2",
        branch_id: "branch-1",
        shift_date: TODAY,
        status: "checked_out",
      },
    ];

    const result = buildStaffSnapshot({
      staff: [staff({ id: "staff-1" }), staff({ id: "staff-2" })],
      schedules: [],
      checkins,
      today: TODAY,
      checkinPaused: false,
    });

    expect(result.onShift).toBe(1);
    expect(result.offShift).toBe(1);
  });

  it("computes payroll totals and detects missing monthly pay setup", () => {
    const payroll = {
      summary: {
        totalMonthlyPayroll: 320000,
        paidStaff: 1,
        unpaidStaff: 1,
        totalIncludedStaff: 2,
        payrollProgress: 50,
        nextPayrollDateLabel: "June 30, 2026",
      },
      staffRows: [
        { status: "paid", monthly_pay: 100000, has_monthly_pay: true },
        { status: "unpaid", monthly_pay: 220000, has_monthly_pay: true },
        { status: "missing_salary", monthly_pay: 0, has_monthly_pay: false },
      ],
    } as PayrollDashboardData;

    expect(buildPayrollSnapshot(payroll)).toMatchObject({
      estimatedCost: 320000,
      paidToDate: 100000,
      pending: 220000,
      missingSalaryCount: 1,
      needsSetup: true,
    });
  });

  it("merges action items by priority and newest created date", () => {
    const items = mergeActionItems({
      notifications: [
        action({ id: "normal-new", priority: "normal", created_at: "2026-06-15T01:00:00Z" }),
        action({ id: "urgent-old", priority: "urgent", created_at: "2026-06-14T01:00:00Z" }),
      ],
      tasks: [
        action({
          id: "normal-newer",
          source: "task",
          priority: "normal",
          created_at: "2026-06-15T02:00:00Z",
        }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual([
      "urgent-old",
      "normal-newer",
      "normal-new",
    ]);
  });

  it("accepts owner workspaces and rejects non-owner workspaces", () => {
    expect(hasOwnerDashboardAccess([{ key: "owner" }])).toBe(true);
    expect(hasOwnerDashboardAccess([{ key: "crm" }, { key: "manager" }])).toBe(false);
  });

  it("preserves partial failure state instead of returning fake zero data", () => {
    const load = dashboardLoadFromSettled(
      { status: "rejected", reason: new Error("network") },
      "Bookings are unavailable right now."
    );

    expect(load).toEqual({
      status: "error",
      message: "Bookings are unavailable right now.",
    });
  });
});

function action(
  overrides: Partial<OwnerDashboardActionItem> = {}
): OwnerDashboardActionItem {
  return {
    id: overrides.id ?? "action-1",
    source: overrides.source ?? "notification",
    title: overrides.title ?? "Payment confirmation needed",
    body: overrides.body ?? null,
    priority: overrides.priority ?? "normal",
    created_at: overrides.created_at ?? "2026-06-15T00:00:00Z",
    action_href: overrides.action_href ?? "/owner/notifications",
    assignee: overrides.assignee ?? null,
  };
}
