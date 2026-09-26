/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CradleFlowDashboard } from "@/components/features/crm/today/cradle-flow-dashboard";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";
import type { CrmTodaySnapshot } from "@/lib/queries/crm-today";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import type { ReadinessIssue } from "@/types/readiness";

const mockBookingModal = {
  openBookingModal: vi.fn(),
};

vi.mock("@/components/features/bookings/administrative-booking-modal-provider", () => ({
  useAdministrativeBookingModal: () => mockBookingModal,
}));

vi.mock("@/components/features/attendance/use-attendance-scan-feed", () => ({
  useAttendanceScanFeed: ({ initialFeed }: { initialFeed: AttendanceScanFeedData }) => ({
    feed: initialFeed,
    realtimeStatus: "live",
    isValidating: false,
    error: null,
    refreshFeed: vi.fn(),
  }),
}));

vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({
  crmStartServiceAction: vi.fn(),
  markBookingArrivedAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockStatusAction = vi.fn();
const mockPaymentAction = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

const mockBookings: CradleFlowBooking[] = [
  {
    id: "b-1",
    branch_id: "branch-1",
    booking_date: "2026-09-26",
    start_time: "13:00:00",
    end_time: "14:00:00",
    status: "confirmed",
    type: "walkin",
    delivery_type: "in_spa",
    travel_buffer_mins: null,
    payment_status: "pending",
    amount_paid: 0,
    price_paid: 700,
    customer_name: "Lira Colado",
    customer_phone: "09171112222",
    service_name: "Filipino Hilot",
    service_duration: 60,
    staff_name: "Chenny Pancho",
    resource_name: null,
    booking_progress_status: "not_started",
  },
  {
    id: "b-2",
    branch_id: "branch-1",
    booking_date: "2026-09-26",
    start_time: "14:00:00",
    end_time: "15:30:00",
    status: "in_progress",
    type: "walkin",
    delivery_type: "in_spa",
    travel_buffer_mins: null,
    payment_status: "pending",
    amount_paid: 0,
    price_paid: 800,
    customer_name: "Bea Carlos",
    customer_phone: "09173334444",
    service_name: "Sports Massage",
    service_duration: 90,
    staff_name: "Chenny Pancho",
    resource_name: null,
    booking_progress_status: "session_started",
    session_started_at: "2026-09-26T06:00:00.000Z",
  },
  {
    id: "b-3",
    branch_id: "branch-1",
    booking_date: "2026-09-26",
    start_time: "11:00:00",
    end_time: "12:00:00",
    status: "completed",
    type: "walkin",
    delivery_type: "in_spa",
    travel_buffer_mins: null,
    payment_status: "pending",
    amount_paid: 0,
    price_paid: 400,
    customer_name: "Addy samson",
    customer_phone: "09175556666",
    service_name: "Angels Massage",
    service_duration: 60,
    staff_name: "Renalyn M. Juanillo",
    resource_name: null,
    booking_progress_status: "completed",
    session_completed_at: "2026-09-26T04:00:00.000Z",
  },
  {
    id: "b-4",
    branch_id: "branch-1",
    booking_date: "2026-09-26",
    start_time: "10:00:00",
    end_time: "11:00:00",
    status: "completed",
    type: "walkin",
    delivery_type: "in_spa",
    travel_buffer_mins: null,
    payment_status: "paid",
    amount_paid: 1800,
    price_paid: 1800,
    payment_method: "card",
    customer_name: "Maria Santos",
    customer_phone: "09177778888",
    service_name: "Signature Facial",
    service_duration: 60,
    staff_name: "Renalyn M. Juanillo",
    resource_name: null,
    booking_progress_status: "completed",
    session_completed_at: "2026-09-26T03:00:00.000Z",
  },
];

const mockSnapshot: CrmTodaySnapshot = {
  date: "2026-09-26",
  branchId: "branch-1",
  bookingSummary: {
    total: 4,
    pending: 0,
    confirmed: 1,
    in_progress: 1,
    completed: 2,
    cancelled: 0,
    no_show: 0,
    unassigned: 0,
  },
  staffReadiness: {
    total: 5,
    scheduledToday: 5,
    checkedIn: 4,
    notCheckedIn: 1,
    availableNow: 3,
    busyNow: 1,
    checkedOut: 0,
    offToday: 0,
    noSchedule: 0,
    scheduleConflicts: 0,
    driversReady: 1,
    driversTotal: 1,
    needsAttention: 0,
    serviceStaffNoSchedule: 0,
    pendingOnlineBookings: 0,
  },
  dispatchStats: {
    totalToday: 0,
    awaitingDispatch: 0,
    activeTrips: 0,
    completedToday: 0,
    cancelledToday: 0,
  },
  payment: {
    date: "2026-09-26",
    total_expected: 3700,
    total_collected: 1800,
    total_unpaid: 1900,
    paid_count: 1,
    unpaid_count: 3,
    total_count: 4,
    by_method: {
      cash: 0,
      gcash: 0,
      maya: 0,
      card: 1800,
      pay_on_site: 0,
      other: 0,
    },
  },
};

const mockAttendance: AttendanceScanFeedData = {
  branchId: "branch-1",
  branchName: "Cradle Wellness Living Main Spa",
  selectedDate: "2026-09-26",
  timezone: "Asia/Manila",
  lastHourCount: 2,
  lastHourOperations: [],
  nextCursor: null,
  error: null,
  items: [
    {
      eventId: "scan-1",
      staffId: "staff-1",
      staffName: "Reynante Jacinto",
      staffNickname: "Reynante",
      staffAvatarUrl: null,
      branchId: "branch-1",
      branchName: "Cradle Wellness Living Main Spa",
      reasonCode: null,
      message: null,
      sourceLabel: null,
      occurredAt: "2026-09-26T00:02:00.000Z",
      timezone: "Asia/Manila",
      eventType: "clock_in",
      outcome: "success",
      attendanceStatus: "on_time",
      shiftType: "morning",
      workedMinutes: 0,
      clockInAt: "2026-09-26T00:02:00.000Z",
      clockOutAt: null,
    },
    {
      eventId: "scan-2",
      staffId: "staff-2",
      staffName: "Ana Dela Cruz",
      staffNickname: "Ana",
      staffAvatarUrl: null,
      branchId: "branch-1",
      branchName: "Cradle Wellness Living Main Spa",
      reasonCode: null,
      message: null,
      sourceLabel: null,
      occurredAt: "2026-09-26T01:12:00.000Z",
      timezone: "Asia/Manila",
      eventType: "clock_in",
      outcome: "success",
      attendanceStatus: "late",
      shiftType: "morning",
      workedMinutes: 0,
      clockInAt: "2026-09-26T01:12:00.000Z",
      clockOutAt: null,
    },
  ],
};

const mockReadinessIssues: ReadinessIssue[] = [
  {
    id: "WARN-1",
    scope: "daily",
    severity: "warning",
    title: "1 booking scheduled without therapist",
    problem: "Booking scheduled without therapist",
    impact: "Service may not be fulfilled on time",
    fix: "Assign a therapist",
    actionLabel: "Assign Therapist",
    actionHref: "/crm/schedule",
    source: "test",
  },
];

function renderDashboard() {
  return render(
    <CradleFlowDashboard
      branchName="Cradle Wellness Living Main Spa"
      dateLabel="Saturday, September 26"
      queueData={mockBookings}
      snapshot={mockSnapshot}
      actionNotifications={[{ id: "notif-1", title: "New online booking — Bea Carlos" }]}
      attendanceScanFeed={mockAttendance}
      attendanceScanDate="2026-09-26"
      readinessIssues={mockReadinessIssues}
      readinessStatus="warning"
      paymentAction={mockPaymentAction}
      statusAction={mockStatusAction}
    />
  );
}

describe("CRM Today Workspace (Front Desk Command Center)", () => {
  it("1. renders Today header with title and subtitle", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: "Today", level: 1 })).toBeTruthy();
    expect(
      screen.getByText("Your front desk command center for bookings, customers, and daily operations.")
    ).toBeTruthy();
  });

  it("2-4. Quick Booking Actions trigger correct administrative booking modal modes", () => {
    renderDashboard();

    // New Booking
    fireEvent.click(screen.getByRole("button", { name: /New Booking/i }));
    expect(mockBookingModal.openBookingModal).toHaveBeenCalledWith({ mode: "walkin" });

    // Walk-In
    fireEvent.click(screen.getByRole("button", { name: /Walk-In/i }));
    expect(mockBookingModal.openBookingModal).toHaveBeenCalledWith({ mode: "walkin" });

    // Book for Later
    fireEvent.click(screen.getByRole("button", { name: /Book for Later/i }));
    expect(mockBookingModal.openBookingModal).toHaveBeenCalledWith({ mode: "standard_future" });

    // Home Service
    fireEvent.click(screen.getByRole("button", { name: /Home Service/i }));
    expect(mockBookingModal.openBookingModal).toHaveBeenCalledWith({ mode: "home_service" });
  });

  it("5-8. Active Service Workflow status tabs filter bookings accurately", () => {
    renderDashboard();

    // Default stage is Waiting -> shows Lira Colado
    expect(screen.getByText("Lira Colado")).toBeTruthy();
    expect(screen.queryByText("Bea Carlos")).toBeNull();

    // Switch to In Service -> shows Bea Carlos
    fireEvent.click(screen.getByRole("tab", { name: /In Service/i }));
    expect(screen.getByText("Bea Carlos")).toBeTruthy();
    expect(screen.queryByText("Lira Colado")).toBeNull();

    // Switch to Ready to Pay -> shows Addy samson
    fireEvent.click(screen.getByRole("tab", { name: /Ready to Pay/i }));
    expect(screen.getByText("Addy samson")).toBeTruthy();

    // Switch to Completed -> shows Maria Santos
    fireEvent.click(screen.getByRole("tab", { name: /Completed/i }));
    expect(screen.getByText("Maria Santos")).toBeTruthy();
  });

  it("9. search filters bookings within current workflow tab", () => {
    renderDashboard();
    // In Waiting stage, search for "non-existent"
    const searchInput = screen.getByPlaceholderText(/Customer, phone, booking ID, therapist/i);
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.queryByText("Lira Colado")).toBeNull();
    expect(screen.getByText(/No matching bookings/i)).toBeTruthy();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "Lira" } });
    expect(screen.getByText("Lira Colado")).toBeTruthy();
  });

  it("10. Contextual primary booking button renders correct stage action", () => {
    renderDashboard();
    // In Waiting stage: Check In
    expect(screen.getByRole("button", { name: "Check In" })).toBeTruthy();

    // In Service: Complete Service
    fireEvent.click(screen.getByRole("tab", { name: /In Service/i }));
    expect(screen.getByRole("button", { name: "Complete Service" })).toBeTruthy();

    // Ready to Pay: Collect Payment
    fireEvent.click(screen.getByRole("tab", { name: /Ready to Pay/i }));
    expect(screen.getByRole("button", { name: "Collect Payment" })).toBeTruthy();

    // Completed: View Record
    fireEvent.click(screen.getByRole("tab", { name: /Completed/i }));
    expect(screen.getByRole("button", { name: "View Record" })).toBeTruthy();
  });

  it("11. Fast Action 'Cash Flow Entry' opens centralized CashFlowEntryDialog in create mode", () => {
    renderDashboard();

    const cashFlowActionBtn = screen.getByRole("button", { name: /Cash Flow Entry/i });
    fireEvent.click(cashFlowActionBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("New Cash Flow Entry")).toBeTruthy();
    expect(within(dialog).getByText("Create")).toBeTruthy();
  });

  it("12-14. Fast Actions provide navigation links for Schedule, Cash Flow, and Follow-up", () => {
    renderDashboard();

    const scheduleLink = screen.getByRole("link", { name: /Check Schedule/i });
    expect(scheduleLink.getAttribute("href")).toBe("/crm/schedule");

    const financialSummaryLink = screen.getByRole("link", { name: /Review Financial Summary/i });
    expect(financialSummaryLink.getAttribute("href")).toBe("/crm/cash-flow");

    const followUpLink = screen.getByRole("link", { name: /Add Follow-up/i });
    expect(followUpLink.getAttribute("href")).toBe("/crm/customers?tab=followup");
  });

  it("15. Money Today card reflects canonical payment summary without fake Outflow or Net", () => {
    renderDashboard();

    expect(screen.getByText("Money Today")).toBeTruthy();
    // Inflow from recorded payments: ₱1,800.00
    expect(screen.getByText("₱1,800.00")).toBeTruthy();

    // Outflow and Net remain truthful '—' with 'Ledger pending'
    const pendingNotes = screen.getAllByText("Ledger pending");
    expect(pendingNotes.length).toBe(2);

    // Outstanding: ₱1,900.00
    expect(screen.getByText("₱1,900.00")).toBeTruthy();
    expect(screen.getByText("3 bookings")).toBeTruthy();
  });

  it("16. Attendance Activity preview displays recent staff scans", () => {
    renderDashboard();

    expect(screen.getByText("Attendance Activity")).toBeTruthy();
    expect(screen.getByText("Reynante Jacinto")).toBeTruthy();
    expect(screen.getByText("Ana Dela Cruz")).toBeTruthy();
    expect(screen.getAllByText("Late").length).toBeGreaterThan(0);
  });

  it("17. Recent Activity is not rendered on Today runtime", () => {
    renderDashboard();

    expect(screen.queryByText("Recent Activity")).toBeNull();
  });

  it("18. Readiness card shows status and counts", () => {
    renderDashboard();

    const readinessSection = screen.getByText("Readiness").closest("section")!;
    expect(within(readinessSection).getByText("Review warnings")).toBeTruthy();
    expect(within(readinessSection).getByText("1")).toBeTruthy(); // 1 warning
  });

  it("19. keyboard shortcuts F1-F4 open booking modal", () => {
    renderDashboard();

    fireEvent.keyDown(window, { key: "F1" });
    expect(mockBookingModal.openBookingModal).toHaveBeenCalledWith({ mode: "walkin" });

    fireEvent.keyDown(window, { key: "F3" });
    expect(mockBookingModal.openBookingModal).toHaveBeenCalledWith({ mode: "standard_future" });
  });

  it("20. prototype submission in Cash Flow Modal does NOT mutate database", () => {
    renderDashboard();

    // Open modal
    fireEvent.click(screen.getByRole("button", { name: /Cash Flow Entry/i }));
    const dialog = screen.getByRole("dialog");

    // Click Record Entry
    fireEvent.click(within(dialog).getByRole("button", { name: /Record entry/i }));

    // Zero mutations invoked
    expect(mockPaymentAction).not.toHaveBeenCalled();
    expect(mockStatusAction).not.toHaveBeenCalled();
  });

  it("21. Active Service Workflow and Attendance Activity provide internal scroll containers", () => {
    renderDashboard();

    // Check that Active Service Workflow has an internal scroll container
    const workflowSection = screen.getByText("Active Service Workflow").closest("section")!;
    const workflowScrollContainer = workflowSection.querySelector(".overflow-y-auto");
    expect(workflowScrollContainer).not.toBeNull();

    // Check that Attendance Activity has an internal scroll container
    const attendanceSection = screen.getByText("Attendance Activity").closest("section")!;
    const attendanceScrollContainer = attendanceSection.querySelector(".overflow-y-auto");
    expect(attendanceScrollContainer).not.toBeNull();
  });
});
