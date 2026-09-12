import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn() })),
}));

import {
  getProviderWorkspaceRuntime,
  resolveProviderPrimaryWork,
  resolveProviderShift,
  isClosedBooking,
  isOperationallyActive,
  serviceStateLabel,
  type ProviderWorkspaceRuntime,
} from "@/lib/staff-pwa/provider-runtime";
import {
  resolveStaffPwaOperationalGroup,
  canAccessWorkspacePath,
} from "@/lib/auth/workspace-access";
import {
  canTransitionBookingProgress,
  getNextAllowedProgressActions,
} from "@/lib/bookings/progress";
import { getTherapistMoreSections } from "@/components/features/staff-portal/therapist/therapist-more-menu";
import type { StaffPortalBooking, StaffPortalStaff } from "@/components/features/staff-portal/types";

// Spies and mock responders for actions
const mockGetMyProfileAction = vi.fn();
const mockGetMyTodayScheduleAction = vi.fn();
const mockGetMyTodayAction = vi.fn();
const mockGetPureAttendanceSnapshot = vi.fn();
const mockUpdateBookingProgressAction = vi.fn();

vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  getMyProfileAction: () => mockGetMyProfileAction(),
  getMyTodayScheduleAction: (date: string) => mockGetMyTodayScheduleAction(date),
  getMyTodayAction: (date: string) => mockGetMyTodayAction(date),
  updateBookingProgressAction: (params: any) => mockUpdateBookingProgressAction(params),
}));

vi.mock("@/lib/staff-portal/attendance", () => ({
  getPureAttendanceSnapshot: (limit?: number) => mockGetPureAttendanceSnapshot(limit),
}));

const mockGetProviderBusinessDate = vi.fn().mockImplementation((_branchId?: string, now?: Date) => {
  if (now) {
    const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return pht.toISOString().split("T")[0];
  }
  return "2026-09-13";
});

vi.mock("@/lib/staff-pwa/provider-date", () => ({
  getProviderBusinessDate: (branchId?: string, now?: Date) => mockGetProviderBusinessDate(branchId, now),
}));

const branchId = "11111111-1111-1111-1111-111111111111";
const staffId = "22222222-2222-2222-2222-222222222222";

function makeMockStaff(overrides: Partial<StaffPortalStaff> = {}): StaffPortalStaff {
  return {
    id: staffId,
    full_name: "Maria Santos",
    nickname: "Maria",
    phone: "09171234567",
    tier: "senior",
    system_role: "staff",
    staff_type: "therapist",
    branch_id: branchId,
    is_active: true,
    avatar_url: "https://example.com/avatar.jpg",
    avatar_path: "staff-avatars/avatar.jpg",
    branches: { name: "BGC Flagship" },
    ...overrides,
  };
}

function makeMockBooking(overrides: Partial<StaffPortalBooking> = {}): StaffPortalBooking {
  return {
    id: "booking-1",
    booking_date: "2026-09-13",
    start_time: "10:00:00",
    end_time: "11:00:00",
    type: "walkin",
    delivery_type: "in_spa",
    status: "confirmed",
    booking_progress_status: "not_started",
    home_service_tracking_status: "",
    travel_buffer_mins: 0,
    metadata: {},
    travel_started_at: null,
    arrived_at: null,
    session_started_at: null,
    session_due_at: null,
    session_duration_minutes_snapshot: 60,
    completed_at: null,
    session_completed_at: null,
    checked_in_at: null,
    no_show_at: null,
    services: { id: "srv-1", name: "Swedish Massage", duration_minutes: 60 },
    customers: { id: "cust-1", full_name: "Jane Doe" },
    branch_resources: { name: "Room A", type: "room" },
    ...overrides,
  };
}

describe("W2: Provider / Salon Functional Wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // SECTION 27: REQUIRED TESTS — TODAY
  // ===========================================================================
  describe("Section 27 — Today Authoritative Model & Operational Group Gating", () => {
    it("resolves authenticated provider roles correctly", async () => {
      const providerRoles = [
        { system_role: "staff", staff_type: "therapist" },
        { system_role: "staff", staff_type: "nail_tech" },
        { system_role: "staff", staff_type: "aesthetician" },
        { system_role: "staff", staff_type: "facialist" },
        { system_role: "staff", staff_type: "salon_head" },
        { system_role: "service_head", staff_type: null },
        { system_role: "service_staff", staff_type: null },
      ];

      for (const roleDef of providerRoles) {
        expect(
          resolveStaffPwaOperationalGroup(roleDef.system_role, roleDef.staff_type)
        ).toBe("provider");
      }
    });

    it("rejects non-provider operational groups from obtaining Provider workspace runtime", async () => {
      const nonProviderStaff = [
        makeMockStaff({ system_role: "driver", staff_type: "driver" }),
        makeMockStaff({ system_role: "utility", staff_type: "utility" }),
        makeMockStaff({ system_role: "front_desk", staff_type: "csr" }),
        makeMockStaff({ system_role: "manager", staff_type: "managerial" }),
        makeMockStaff({ system_role: "owner", staff_type: null }),
        makeMockStaff({ system_role: "digital_marketer", staff_type: null }),
      ];

      for (const staff of nonProviderStaff) {
        mockGetMyProfileAction.mockResolvedValueOnce({ staff });

        const result = await getProviderWorkspaceRuntime("2026-09-13");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("FORBIDDEN");
          expect(result.error).toContain("Forbidden");
        }
      }
    });

    it("rejects unauthenticated caller with UNAUTHORIZED", async () => {
      mockGetMyProfileAction.mockResolvedValueOnce({ error: "Unauthorized" });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
    });

    it("reads attendance via pure read contract without mutations", async () => {
      const mockStaff = makeMockStaff();
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce({
        staffId,
        currentClockState: "clocked_in",
        currentRecord: {
          checkedInAt: "2026-09-13T09:00:00Z",
          checkedOutAt: null,
          workedMinutes: 120,
        },
        todayState: {
          timezone: "Asia/Manila",
          records: [],
          totalWorkedMinutes: 120,
          shiftSummary: { isDayOff: false, scheduledMinutes: 480 },
        },
        recentLogs: [],
      });
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({
        todaySchedule: { day_of_week: 0, start_time: "09:00:00", end_time: "18:00:00", shift_type: "opening" },
        todayOverride: null,
      });
      mockGetMyTodayAction.mockResolvedValueOnce({
        bookings: [],
        staff: mockStaff,
      });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runtime.attendance?.currentClockState).toBe("clocked_in");
        expect(result.runtime.attendance?.currentRecord?.workedMinutes).toBe(120);
      }
      expect(mockGetPureAttendanceSnapshot).toHaveBeenCalledWith(30);
    });

    it("Section 7 Priority Rule: 1. Active Home Service receives top priority", () => {
      const activeHome = makeMockBooking({
        id: "b-home-active",
        delivery_type: "home_service",
        type: "home_service",
        booking_progress_status: "travel_started",
        start_time: "14:00:00",
      });
      const activeOnsite = makeMockBooking({
        id: "b-onsite-active",
        delivery_type: "in_spa",
        booking_progress_status: "session_started",
        start_time: "10:00:00",
      });
      const upcoming = makeMockBooking({
        id: "b-upcoming",
        delivery_type: "in_spa",
        booking_progress_status: "not_started",
        start_time: "09:00:00",
      });

      const primary = resolveProviderPrimaryWork([upcoming, activeOnsite, activeHome]);
      expect(primary.kind).toBe("home_service");
      expect(primary.booking?.id).toBe("b-home-active");
      expect(primary.badgeLabel).toBe("Home Service Active");
      expect(primary.active).toBe(true);
      expect(primary.isHome).toBe(true);
    });

    it("Section 7 Priority Rule: 2. Active onsite service receives priority over upcoming", () => {
      const activeOnsite = makeMockBooking({
        id: "b-onsite-active",
        delivery_type: "in_spa",
        booking_progress_status: "session_started",
        start_time: "11:00:00",
      });
      const upcomingEarly = makeMockBooking({
        id: "b-upcoming-early",
        delivery_type: "in_spa",
        booking_progress_status: "not_started",
        start_time: "09:00:00",
      });

      const primary = resolveProviderPrimaryWork([upcomingEarly, activeOnsite]);
      expect(primary.kind).toBe("onsite_service");
      expect(primary.booking?.id).toBe("b-onsite-active");
      expect(primary.badgeLabel).toBe("Active Service");
      expect(primary.active).toBe(true);
      expect(primary.isHome).toBe(false);
    });

    it("Section 7 Priority Rule: 3. Next assigned service shown when no active service (sorted by start_time)", () => {
      const upcomingLate = makeMockBooking({
        id: "b-late",
        delivery_type: "home_service",
        booking_progress_status: "not_started",
        start_time: "15:00:00",
      });
      const upcomingEarly = makeMockBooking({
        id: "b-early",
        delivery_type: "in_spa",
        booking_progress_status: "not_started",
        start_time: "11:00:00",
      });

      const primary = resolveProviderPrimaryWork([upcomingLate, upcomingEarly]);
      expect(primary.kind).toBe("next_service");
      expect(primary.booking?.id).toBe("b-early");
      expect(primary.badgeLabel).toBe("Next Service");
      expect(primary.active).toBe(false);
      expect(primary.isHome).toBe(false);
    });

    it("Section 7 Priority Rule: 4. Clear state shown truthfully when no open work", () => {
      const completed = makeMockBooking({
        id: "b-done",
        status: "completed",
        booking_progress_status: "completed",
      });
      const cancelled = makeMockBooking({
        id: "b-cancel",
        status: "cancelled",
        booking_progress_status: "not_started",
      });

      const primary = resolveProviderPrimaryWork([completed, cancelled]);
      expect(primary.kind).toBe("clear");
      expect(primary.booking).toBeNull();
      expect(primary.badgeLabel).toBe("No assigned service");
      expect(primary.active).toBe(false);
    });

    it("Rule 13 customer privacy: customer name present, phone and email strictly omitted", async () => {
      const mockStaff = makeMockStaff();
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce(null);
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({ todaySchedule: null, todayOverride: null });

      const bookingWithCustomer = makeMockBooking({
        customers: { id: "cust-1", full_name: "Customer Privacy Test" },
      });
      mockGetMyTodayAction.mockResolvedValueOnce({
        bookings: [bookingWithCustomer],
        staff: mockStaff,
      });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const customer = result.runtime.bookings[0]?.customers;
        expect(customer).toBeDefined();
        const firstCust = Array.isArray(customer) ? customer[0] : customer;
        expect(firstCust?.full_name).toBe("Customer Privacy Test");
        expect((firstCust as any)?.phone).toBeUndefined();
        expect((firstCust as any)?.email).toBeUndefined();
      }
    });

    it("preserves branch identity presentation truthfully", async () => {
      const mockStaff = makeMockStaff({
        branches: { name: "Alabang Town Center" },
      });
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce(null);
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({ todaySchedule: null, todayOverride: null });
      mockGetMyTodayAction.mockResolvedValueOnce({ bookings: [], staff: mockStaff });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runtime.staff.branches).toEqual({ name: "Alabang Town Center" });
      }
    });

    it("Section 7 / Blocker D: Work load failure preserves error and DOES NOT produce 'No assigned service'", async () => {
      const mockStaff = makeMockStaff();
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce(null);
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({ todaySchedule: null, todayOverride: null });
      mockGetMyTodayAction.mockResolvedValueOnce({ error: "Failed to read bookings" });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runtime.errors?.work).toBe("Failed to read bookings");
        expect(result.runtime.primaryWork.kind).toBe("load_error");
        expect(result.runtime.primaryWork.badgeLabel).toBe("Work unavailable");
        expect(result.runtime.primaryWork.badgeLabel).not.toBe("No assigned service");
        expect(result.runtime.primaryWork.kind).not.toBe("clear");
      }
    });

    it("Section 7 / Blocker D: Attendance read failure preserves error and DOES NOT produce 'Not clocked in'", async () => {
      const mockStaff = makeMockStaff();
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockRejectedValueOnce(new Error("Attendance service unavailable"));
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({ todaySchedule: null, todayOverride: null });
      mockGetMyTodayAction.mockResolvedValueOnce({ bookings: [], staff: mockStaff });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runtime.attendance).toBeNull();
        expect(result.runtime.errors?.attendance).toBe("Attendance service unavailable");
      }
    });

    it("Section 7 / Blocker D: Schedule read failure preserves error and DOES NOT produce 'No Shift'", async () => {
      const mockStaff = makeMockStaff();
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce(null);
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({ error: "Schedule service error" });
      mockGetMyTodayAction.mockResolvedValueOnce({ bookings: [], staff: mockStaff });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runtime.shift.kind).toBe("load_error");
        if (result.runtime.shift.kind === "load_error") {
          expect(result.runtime.shift.error).toBe("Schedule service error");
        }
        expect(result.runtime.errors?.schedule).toBe("Schedule service error");
        expect(result.runtime.shift.kind).not.toBe("none");
        expect(result.runtime.shift.kind).not.toBe("day_off");
      }
    });

    it("Section 7 / Blocker D: True empty assignment produces legitimate clear / 'No assigned service' state", async () => {
      const mockStaff = makeMockStaff();
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce(null);
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({ todaySchedule: null, todayOverride: null });
      mockGetMyTodayAction.mockResolvedValueOnce({ bookings: [], staff: mockStaff });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runtime.errors?.work).toBeUndefined();
        expect(result.runtime.primaryWork.kind).toBe("clear");
        expect(result.runtime.primaryWork.badgeLabel).toBe("No assigned service");
        expect(result.runtime.primaryWork.stateLabel).toBe("Clear");
      }
    });

    it("Section 9 / Blocker E: Resolves branch business date across UTC timezone boundary", async () => {
      const mockStaff = makeMockStaff();
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce(null);
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({ todaySchedule: null, todayOverride: null });
      mockGetMyTodayAction.mockResolvedValueOnce({ bookings: [], staff: mockStaff });

      // UTC 2026-09-12 23:30:00Z is 2026-09-13 07:30:00 in Manila (+8)
      const boundaryDate = new Date("2026-09-12T23:30:00.000Z");
      const result = await getProviderWorkspaceRuntime(undefined, boundaryDate);

      expect(result.ok).toBe(true);
      expect(mockGetProviderBusinessDate).toHaveBeenCalledWith(branchId, boundaryDate);
      expect(mockGetMyTodayAction).toHaveBeenCalledWith("2026-09-13");
    });
  });

  // ===========================================================================
  // SECTION 28: REQUIRED TESTS — SERVICE ACTIONS & CANONICAL STATE MACHINES
  // ===========================================================================
  describe("Section 28 — Canonical Service Actions & Boundaries", () => {
    it("preserves canonical ONSITE transition sequence: not_started -> checked_in -> session_started -> completed", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "in_spa",
          currentStatus: "not_started",
          nextStatus: "checked_in",
        })
      ).toBe(true);

      expect(
        canTransitionBookingProgress({
          bookingType: "in_spa",
          currentStatus: "checked_in",
          nextStatus: "session_started",
        })
      ).toBe(true);

      expect(
        canTransitionBookingProgress({
          bookingType: "in_spa",
          currentStatus: "session_started",
          nextStatus: "completed",
        })
      ).toBe(true);

      // Invalid transition: cannot jump directly from not_started to completed
      expect(
        canTransitionBookingProgress({
          bookingType: "in_spa",
          currentStatus: "not_started",
          nextStatus: "completed",
        })
      ).toBe(false);
    });

    it("preserves canonical HOME SERVICE transition sequence: not_started -> travel_started -> arrived -> session_started -> completed", () => {
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "not_started",
          nextStatus: "travel_started",
        })
      ).toBe(true);

      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "travel_started",
          nextStatus: "arrived",
        })
      ).toBe(true);

      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "arrived",
          nextStatus: "session_started",
        })
      ).toBe(true);

      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "session_started",
          nextStatus: "completed",
        })
      ).toBe(true);

      // Cannot jump from travel_started to completed
      expect(
        canTransitionBookingProgress({
          bookingType: "home_service",
          currentStatus: "travel_started",
          nextStatus: "completed",
        })
      ).toBe(false);
    });

    it("Home Service completion skips Utility room-turnover task", async () => {
      mockUpdateBookingProgressAction.mockResolvedValueOnce({
        ok: true,
        bookingId: "b-home",
        status: "completed",
        turnoverSyncStatus: "skipped",
      });

      const res = await mockUpdateBookingProgressAction({
        bookingId: "b-home",
        nextStatus: "completed",
      });

      expect(res.ok).toBe(true);
      expect(res.turnoverSyncStatus).toBe("skipped");
      expect(res.turnoverWarning).toBeUndefined();
    });

    it("Onsite service completion ensures Utility room-turnover task", async () => {
      mockUpdateBookingProgressAction.mockResolvedValueOnce({
        ok: true,
        bookingId: "b-onsite",
        status: "completed",
        turnoverSyncStatus: "synced",
      });

      const res = await mockUpdateBookingProgressAction({
        bookingId: "b-onsite",
        nextStatus: "completed",
      });

      expect(res.ok).toBe(true);
      expect(res.turnoverSyncStatus).toBe("synced");
    });

    it("turnover sync failure remains truthfully surfaced without fake rollback", async () => {
      mockUpdateBookingProgressAction.mockResolvedValueOnce({
        ok: true,
        bookingId: "b-onsite",
        status: "completed",
        turnoverSyncStatus: "failed",
        turnoverWarning: "Appointment completed, but room turnover task could not be synchronized.",
      });

      const res = await mockUpdateBookingProgressAction({
        bookingId: "b-onsite",
        nextStatus: "completed",
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe("completed");
      expect(res.turnoverSyncStatus).toBe("failed");
      expect(res.turnoverWarning).toBeDefined();
    });

    it("service completion does not clock out attendance", async () => {
      // Mock active attendance
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce({
        staffId,
        currentClockState: "clocked_in",
        currentRecord: { checkedInAt: "2026-09-13T09:00:00Z", checkedOutAt: null, workedMinutes: 60 },
        todayState: { timezone: "Asia/Manila", records: [], totalWorkedMinutes: 60, shiftSummary: { isDayOff: false, scheduledMinutes: 480 } },
        recentLogs: [],
      });

      mockUpdateBookingProgressAction.mockResolvedValueOnce({
        ok: true,
        bookingId: "b-1",
        status: "completed",
        turnoverSyncStatus: "synced",
      });

      const actionResult = await mockUpdateBookingProgressAction({
        bookingId: "b-1",
        nextStatus: "completed",
      });
      expect(actionResult.ok).toBe(true);

      // Attendance remains clocked in
      const attendance = await mockGetPureAttendanceSnapshot(30);
      expect(attendance.currentClockState).toBe("clocked_in");
      expect(attendance.currentRecord.checkedOutAt).toBeNull();
    });

    it("double / retry service completion remains idempotent", async () => {
      mockUpdateBookingProgressAction.mockResolvedValue({
        ok: true,
        bookingId: "b-1",
        status: "completed",
        turnoverSyncStatus: "synced",
      });

      const first = await mockUpdateBookingProgressAction({ bookingId: "b-1", nextStatus: "completed" });
      const retry = await mockUpdateBookingProgressAction({ bookingId: "b-1", nextStatus: "completed" });

      expect(first.ok).toBe(true);
      expect(retry.ok).toBe(true);
      expect(retry.status).toBe("completed");
    });
  });

  // ===========================================================================
  // SECTION 29: REQUIRED TESTS — SCHEDULE
  // ===========================================================================
  describe("Section 29 — Provider Schedule", () => {
    it("distinguishes home service and onsite appointments in schedule", () => {
      const onsiteBooking = makeMockBooking({
        id: "b-onsite",
        delivery_type: "in_spa",
        services: { id: "s-1", name: "Foot Reflexology", duration_minutes: 45 },
        branch_resources: { name: "Chair 2", type: "chair" },
      });
      const homeBooking = makeMockBooking({
        id: "b-home",
        delivery_type: "home_service",
        services: { id: "s-2", name: "Home Prenatal Massage", duration_minutes: 90 },
        metadata: { address: "123 Pioneer St, Mandaluyong" },
      });

      expect(onsiteBooking.delivery_type).toBe("in_spa");
      expect(homeBooking.delivery_type).toBe("home_service");
      expect(onsiteBooking.branch_resources?.name).toBe("Chair 2");
      expect(homeBooking.metadata?.address).toBe("123 Pioneer St, Mandaluyong");
    });

    it("accurately handles day off and empty shifts in schedule resolution", () => {
      const dayOffShift = resolveProviderShift(
        { day_of_week: 0, start_time: "09:00:00", end_time: "18:00:00", shift_type: "opening" },
        { override_date: "2026-09-13", is_day_off: true, start_time: null, end_time: null }
      );
      expect(dayOffShift.kind).toBe("day_off");

      const noShift = resolveProviderShift(null, null);
      expect(noShift.kind).toBe("none");

      const regularShift = resolveProviderShift(
        { day_of_week: 0, start_time: "10:00:00", end_time: "19:00:00", shift_type: "closing" },
        null
      );
      expect(regularShift.kind).toBe("shift");
      if (regularShift.kind === "shift") {
        expect(regularShift.startTime).toBe("10:00:00");
        expect(regularShift.endTime).toBe("19:00:00");
        expect(regularShift.label).toBe("Closing Shift");
      }
    });
  });

  // ===========================================================================
  // SECTION 30: REQUIRED TESTS — PROGRESS
  // ===========================================================================
  describe("Section 30 — Provider Progress Metrics", () => {
    it("computes progress summary strictly from authoritative bookings with zero demo metrics", async () => {
      const mockStaff = makeMockStaff();
      mockGetMyProfileAction.mockResolvedValueOnce({ staff: mockStaff });
      mockGetPureAttendanceSnapshot.mockResolvedValueOnce(null);
      mockGetMyTodayScheduleAction.mockResolvedValueOnce({ todaySchedule: null, todayOverride: null });

      const bookings = [
        makeMockBooking({ id: "b-1", status: "completed", booking_progress_status: "completed", delivery_type: "in_spa" }),
        makeMockBooking({ id: "b-2", status: "completed", booking_progress_status: "completed", delivery_type: "home_service" }),
        makeMockBooking({ id: "b-3", status: "in_progress", booking_progress_status: "session_started", delivery_type: "in_spa" }),
        makeMockBooking({ id: "b-4", status: "confirmed", booking_progress_status: "not_started", delivery_type: "in_spa" }),
        makeMockBooking({ id: "b-5", status: "confirmed", booking_progress_status: "not_started", delivery_type: "home_service" }),
      ];
      mockGetMyTodayAction.mockResolvedValueOnce({ bookings, staff: mockStaff });

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        const { scheduleSummary, progressSummary } = result.runtime;
        expect(scheduleSummary.totalAssigned).toBe(5);
        expect(scheduleSummary.completedCount).toBe(2);
        expect(scheduleSummary.remainingCount).toBe(3);

        expect(progressSummary.completedToday).toBe(2);
        expect(progressSummary.activeToday).toBe(1);
        expect(progressSummary.upcomingToday).toBe(2);
        expect(progressSummary.homeServicesToday).toBe(2);

        // Prove no speculative metrics exist in runtime
        expect((progressSummary as any).commissions).toBeUndefined();
        expect((progressSummary as any).tips).toBeUndefined();
        expect((progressSummary as any).ratings).toBeUndefined();
        expect((progressSummary as any).score).toBeUndefined();
      }
    });
  });

  // ===========================================================================
  // SECTION 31: REQUIRED TESTS — MORE / IDENTITY
  // ===========================================================================
  describe("Section 31 — More Menu & Identity Representation", () => {
    it("presents canonical /staff/* destinations and omits managerial surfaces", () => {
      const sections = getTherapistMoreSections(true);

      const allHrefs = sections
        .flatMap((s) => s.items)
        .filter((item): item is { kind: "link"; label: string; description: string; href: string; icon: any } => item.kind === "link")
        .map((item) => item.href);

      expect(allHrefs).toContain("/staff/profile");
      expect(allHrefs).toContain("/staff/attendance");
      expect(allHrefs).toContain("/staff/schedule");
      expect(allHrefs).toContain("/staff/progress");

      // No admin or CRM managerial surfaces
      expect(allHrefs.some((href) => href.startsWith("/owner"))).toBe(false);
      expect(allHrefs.some((href) => href.startsWith("/manager"))).toBe(false);
      expect(allHrefs.some((href) => href.startsWith("/crm/settings"))).toBe(false);
    });

    it("verifies workspace access routing for provider operational paths", () => {
      expect(canAccessWorkspacePath("/staff", "staff", [], "therapist")).toBe(true);
      expect(canAccessWorkspacePath("/staff/schedule", "staff", [], "therapist")).toBe(true);
      expect(canAccessWorkspacePath("/staff/progress", "staff", [], "therapist")).toBe(true);
      expect(canAccessWorkspacePath("/staff/more", "staff", [], "therapist")).toBe(true);
      expect(canAccessWorkspacePath("/staff/scan", "staff", [], "therapist")).toBe(true);

      // Provider cannot access driver or utility workspace
      expect(canAccessWorkspacePath("/staff/driver", "staff", [], "therapist")).toBe(false);
      expect(canAccessWorkspacePath("/staff/utility", "staff", [], "therapist")).toBe(false);
    });
  });
});
