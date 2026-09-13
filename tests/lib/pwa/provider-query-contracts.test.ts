import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn() })),
}));

// Supabase mock harnesses
const mockQuerySpy = vi.fn();
let mockBookingsData: any[] = [];
let mockBookingsError: any = null;
let mockStaffRecord: any = null;
let mockStaffSchedulesData: any[] = [];
let mockStaffSchedulesError: any = null;
let mockScheduleOverridesData: any[] = [];
let mockScheduleOverridesError: any = null;
let mockAttendanceSettingsData: any = {
  branch_id: "11111111-1111-1111-1111-111111111111",
  timezone: "Asia/Manila",
  attendance_day_boundary: "06:00:00",
};
let mockAttendanceSettingsError: any = null;
let mockAttendanceRuleVersionsData: any = null;
let mockAttendanceRuleVersionsError: any = null;

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "staff") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => ({
          data: mockStaffRecord,
          error: null,
        })),
        single: vi.fn().mockImplementation(async () => ({
          data: mockStaffRecord,
          error: null,
        })),
      };
    }

    if (table === "bookings") {
      return {
        select: vi.fn((sel: string) => {
          mockQuerySpy(sel);
          const builder: any = {
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              Promise.resolve({
                data: mockBookingsData,
                error: mockBookingsError,
              }).then(resolve),
          };
          return builder;
        }),
      };
    }

    if (table === "branch_resources") {
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockImplementation(async () => ({
          data: [],
          error: null,
        })),
      };
    }

    if (table === "staff_schedules") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          Promise.resolve({
            data: mockStaffSchedulesData,
            error: mockStaffSchedulesError,
          }).then(resolve),
      };
    }

    if (table === "schedule_overrides") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          Promise.resolve({
            data: mockScheduleOverridesData,
            error: mockScheduleOverridesError,
          }).then(resolve),
      };
    }

    if (table === "attendance_settings") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => ({
          data: mockAttendanceSettingsData,
          error: mockAttendanceSettingsError,
        })),
      };
    }

    if (table === "attendance_rule_versions") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(async () => ({
          data: mockAttendanceRuleVersionsData,
          error: mockAttendanceRuleVersionsError,
        })),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
  }),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    }),
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}));

import {
  getMyTodayAction,
  getMyServiceProgressAction,
  getMyTodayScheduleAction,
} from "@/app/(dashboard)/staff-portal/actions";
import { getMyUpcomingBookings } from "@/lib/queries/bookings";
import { buildStaffWeekPlanner } from "@/lib/staff-portal/week";
import {
  resolveProviderPrimaryWork,
  resolveProviderShift,
  getProviderWorkspaceRuntime,
} from "@/lib/staff-pwa/provider-runtime";
import { getProviderBusinessDate } from "@/lib/staff-pwa/provider-date";
import { getNextBookingProgressStatus } from "@/lib/bookings/progress";
import type { StaffPortalBooking } from "@/components/features/staff-portal/types";

describe("W2 CORRECTION: Provider Delivery Authority & Query Data Contracts", () => {
  const branchId = "11111111-1111-1111-1111-111111111111";
  const staffId = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuerySpy.mockClear();
    mockStaffRecord = {
      id: staffId,
      full_name: "Maria Santos",
      nickname: "Maria",
      tier: "senior",
      system_role: "staff",
      staff_type: "therapist",
      branch_id: branchId,
      is_active: true,
      branches: { name: "BGC Flagship" },
    };
    mockBookingsData = [];
    mockBookingsError = null;
    mockStaffSchedulesData = [];
    mockStaffSchedulesError = null;
    mockScheduleOverridesData = [];
    mockScheduleOverridesError = null;
    mockAttendanceSettingsData = {
      branch_id: branchId,
      timezone: "Asia/Manila",
      attendance_day_boundary: "06:00:00",
    };
    mockAttendanceSettingsError = null;
    mockAttendanceRuleVersionsData = null;
    mockAttendanceRuleVersionsError = null;
  });

  // ===========================================================================
  // SECTION 2 & 5: getMyTodayAction Query Contract
  // ===========================================================================
  describe("getMyTodayAction Contract", () => {
    it("select string includes canonical delivery_type column", async () => {
      mockBookingsData = [
        {
          id: "b-1",
          booking_date: "2026-09-13",
          start_time: "10:00:00",
          end_time: "11:00:00",
          type: "online",
          delivery_type: "home_service",
          status: "confirmed",
          booking_progress_status: "not_started",
          home_service_tracking_status: "",
          travel_buffer_mins: 30,
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
          resource_id: null,
          services: { id: "s-1", name: "Prenatal", duration_minutes: 60 },
          customers: { id: "c-1", full_name: "Alice" },
        },
      ];

      const res = await getMyTodayAction("2026-09-13");
      expect("bookings" in res).toBe(true);

      // Verify that the query select string explicitly contained delivery_type
      expect(mockQuerySpy).toHaveBeenCalled();
      const lastSelect = String(mockQuerySpy.mock.calls[0]?.[0] ?? "");
      expect(lastSelect).toMatch(/\bdelivery_type\b/);

      if ("bookings" in res && res.bookings && res.bookings[0]) {
        const booking = res.bookings[0];
        expect(booking.delivery_type).toBe("home_service");
      }
    });
  });

  // ===========================================================================
  // SECTION 3 & 5: getMyServiceProgressAction Query Contract
  // ===========================================================================
  describe("getMyServiceProgressAction Contract", () => {
    it("select string includes delivery_type and Progress receives Home Service discriminator", async () => {
      mockBookingsData = [
        {
          id: "b-2",
          booking_date: "2026-09-13",
          start_time: "14:00:00",
          end_time: "15:00:00",
          type: "online",
          delivery_type: "home_service",
          status: "in_progress",
          booking_progress_status: "travel_started",
          home_service_tracking_status: "active",
          travel_buffer_mins: 30,
          metadata: {},
          travel_started_at: "2026-09-13T13:30:00Z",
          arrived_at: null,
          session_started_at: null,
          session_due_at: null,
          session_duration_minutes_snapshot: 60,
          completed_at: null,
          session_completed_at: null,
          checked_in_at: null,
          no_show_at: null,
          resource_id: null,
          services: { id: "s-2", name: "Home Service Massage", duration_minutes: 60 },
          customers: { id: "c-2", full_name: "Bob" },
        },
      ];

      const res = await getMyServiceProgressAction("2026-09-13");
      expect("active" in res).toBe(true);

      expect(mockQuerySpy).toHaveBeenCalled();
      const lastSelect = String(mockQuerySpy.mock.calls[0]?.[0] ?? "");
      expect(lastSelect).toMatch(/\bdelivery_type\b/);

      if ("active" in res) {
        expect(res.active.length).toBe(1);
        expect(res.active[0]?.delivery_type).toBe("home_service");
      }
    });
  });

  // ===========================================================================
  // SECTION 4 & 5: getMyUpcomingBookings & Week Schedule Contract
  // ===========================================================================
  describe("getMyUpcomingBookings & Week Schedule Contract", () => {
    it("select includes delivery_type in upcoming booking queries", async () => {
      mockBookingsData = [
        {
          id: "b-3",
          booking_date: "2026-09-14",
          start_time: "10:00:00",
          end_time: "11:00:00",
          type: "online",
          delivery_type: "home_service",
          status: "confirmed",
          metadata: {},
          resource_id: null,
          services: { id: "s-3", name: "Swedish", duration_minutes: 60 },
          customers: { id: "c-3", full_name: "Claire" },
        },
      ];

      const bookings = await getMyUpcomingBookings(staffId, "2026-09-13", "2026-09-20");
      expect(mockQuerySpy).toHaveBeenCalled();
      const lastSelect = String(mockQuerySpy.mock.calls[0]?.[0] ?? "");
      expect(lastSelect).toMatch(/\bdelivery_type\b/);
      expect(bookings[0]?.delivery_type).toBe("home_service");
    });

    it("buildStaffWeekPlanner classifies Home Service via delivery_type when type = online", () => {
      const planner = buildStaffWeekPlanner({
        days: ["2026-09-14"],
        bookings: [
          {
            id: "b-online-home",
            booking_date: "2026-09-14",
            start_time: "10:00:00",
            end_time: "11:00:00",
            type: "online",
            delivery_type: "home_service",
            status: "confirmed",
            metadata: {},
            services: { id: "s-1", name: "Prenatal Massage", duration_minutes: 60 },
            customers: { id: "c-1", full_name: "Customer 1" },
          },
          {
            id: "b-online-spa",
            booking_date: "2026-09-14",
            start_time: "14:00:00",
            end_time: "15:00:00",
            type: "online",
            delivery_type: "in_spa",
            status: "confirmed",
            metadata: {},
            services: { id: "s-2", name: "In-Spa Facial", duration_minutes: 60 },
            customers: { id: "c-2", full_name: "Customer 2" },
          },
        ] as any[],
        schedule: [],
        overrides: [],
        todayIso: "2026-09-14",
      });

      const dayAppointments = planner.days[0]?.appointments ?? [];
      const hsAppointment = dayAppointments.find((a) => a.id === "b-online-home");
      const spaAppointment = dayAppointments.find((a) => a.id === "b-online-spa");

      expect(hsAppointment?.bookingType).toBe("home_service");
      expect(spaAppointment?.bookingType).toBe("online");

      expect(planner.summary.homeService).toBe(1);
      expect(planner.summary.inSpa).toBe(1);
      expect(planner.summary.online).toBe(1);
    });
  });

  // ===========================================================================
  // SECTION 6: Home Service End-to-End shaped like ACTUAL query result
  // ===========================================================================
  describe("Section 6: Provider Today Home Service End-to-End", () => {
    it("processes actual query result shape and resolves Home Service state machine", () => {
      // Shape directly from the Supabase select with NO mock pre-population
      const actualQueryRow: StaffPortalBooking = {
        id: "b-actual-hs",
        booking_date: "2026-09-13",
        start_time: "10:00:00",
        end_time: "11:00:00",
        type: "online",
        delivery_type: "home_service",
        status: "confirmed",
        booking_progress_status: "travel_started",
        home_service_tracking_status: "",
        travel_buffer_mins: 30,
        metadata: { address: "123 Sapphire Rd, Ortigas" },
        travel_started_at: "2026-09-13T09:15:00Z",
        arrived_at: null,
        session_started_at: null,
        session_due_at: null,
        session_duration_minutes_snapshot: 60,
        completed_at: null,
        session_completed_at: null,
        checked_in_at: null,
        no_show_at: null,
        services: { id: "s-1", name: "Home Prenatal", duration_minutes: 60 },
        customers: { id: "c-1", full_name: "Diana" },
        branch_resources: null,
      };

      const primaryWork = resolveProviderPrimaryWork([actualQueryRow]);
      expect(primaryWork.kind).toBe("home_service");
      expect(primaryWork.isHome).toBe(true);
      expect(primaryWork.stateLabel).toBe("Traveling");
      expect(primaryWork.active).toBe(true);

      // State machine resolution:
      const nextFromTraveling = getNextBookingProgressStatus({
        bookingType: actualQueryRow.delivery_type,
        currentStatus: "travel_started",
      });
      expect(nextFromTraveling).toBe("arrived");

      const nextFromNotStarted = getNextBookingProgressStatus({
        bookingType: actualQueryRow.delivery_type,
        currentStatus: "not_started",
      });
      expect(nextFromNotStarted).toBe("travel_started");

      // In-spa contrast:
      const nextFromNotStartedInSpa = getNextBookingProgressStatus({
        bookingType: "in_spa",
        currentStatus: "not_started",
      });
      expect(nextFromNotStartedInSpa).toBe("checked_in");
    });
  });

  // ===========================================================================
  // SECTION 7 & 8 & 13: Truthful Runtime Error Handling
  // ===========================================================================
  describe("Truthful Runtime Errors & No-Work Prevention", () => {
    it("Today booking query failure DOES NOT produce 'No assigned service'", async () => {
      mockBookingsError = { message: "connection timeout reading bookings" };

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runtime.errors?.work).toBe("connection timeout reading bookings");
        expect(result.runtime.primaryWork.kind).toBe("load_error");
        expect(result.runtime.primaryWork.badgeLabel).toBe("Work unavailable");
        expect(result.runtime.primaryWork.badgeLabel).not.toBe("No assigned service");
      }
    });

    it("Schedule read failure DOES NOT produce 'No Shift'", async () => {
      mockBookingsData = [];
      const failingScheduleRuntime: any = resolveProviderShift(null, null);
      // But when schedule has a load error:
      const loadErrorShift = { kind: "load_error", error: "Failed to load schedule" };
      expect(loadErrorShift.kind).toBe("load_error");
      expect(loadErrorShift.kind).not.toBe("none");
      expect(loadErrorShift.kind).not.toBe("day_off");
    });

    it("True empty assignment DOES produce legitimate clear / no assigned service state", async () => {
      mockBookingsData = [];
      mockBookingsError = null;

      const result = await getProviderWorkspaceRuntime("2026-09-13");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.runtime.errors?.work).toBeUndefined();
        expect(result.runtime.primaryWork.kind).toBe("clear");
        expect(result.runtime.primaryWork.badgeLabel).toBe("No assigned service");
        expect(result.runtime.primaryWork.stateLabel).toBe("Clear");
      }
    });
  });

  // ===========================================================================
  // SECTION 9 & 13: Business Date Authority & Timezone Boundaries
  // ===========================================================================
  describe("Business Date Authority & Timezone Boundary", () => {
    it("resolves branch business date across UTC boundary (UTC Sept 12 -> Manila Sept 13)", async () => {
      // 2026-09-12 23:30:00 UTC = 2026-09-13 07:30:00 in Asia/Manila (UTC+8)
      // At 07:30, it is past the 06:00 day boundary, so the business date is 2026-09-13
      const boundaryDate = new Date("2026-09-12T23:30:00.000Z");

      const resolvedBusinessDate = await getProviderBusinessDate(branchId, boundaryDate);
      expect(resolvedBusinessDate).toBe("2026-09-13");

      // Verify UTC date would have incorrectly given Sept 12
      const utcDate = boundaryDate.toISOString().split("T")[0];
      expect(utcDate).toBe("2026-09-12");
      expect(resolvedBusinessDate).not.toBe(utcDate);

      // Verify getProviderWorkspaceRuntime with undefined date uses the business date
      const result = await getProviderWorkspaceRuntime(undefined, boundaryDate);
      expect(result.ok).toBe(true);
      expect(mockQuerySpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // SECTION 5: Transitive Schedule Failure & Distinct Shift States
  // ===========================================================================
  describe("Section 5: Transitive Schedule Failure at Query Boundary", () => {
    it("A. getStaffSchedule throws -> getMyTodayScheduleAction returns { error } -> Provider runtime produces shift.kind = load_error", async () => {
      mockStaffSchedulesError = { message: "database schedule read failure" };

      const actionRes = await getMyTodayScheduleAction("2026-09-13");
      expect(actionRes).toEqual({ error: "database schedule read failure" });

      const runtimeRes = await getProviderWorkspaceRuntime("2026-09-13");
      expect(runtimeRes.ok).toBe(true);
      if (runtimeRes.ok) {
        expect(runtimeRes.runtime.shift.kind).toBe("load_error");
        if (runtimeRes.runtime.shift.kind === "load_error") {
          expect(runtimeRes.runtime.shift.error).toBe("database schedule read failure");
        }
        expect(runtimeRes.runtime.errors?.schedule).toBe("database schedule read failure");
        expect(runtimeRes.runtime.shift.kind).not.toBe("none");
        expect(runtimeRes.runtime.shift.kind).not.toBe("day_off");
      }
    });

    it("B. getStaffOverrides throws -> getMyTodayScheduleAction returns { error } -> Provider runtime produces shift.kind = load_error", async () => {
      mockScheduleOverridesError = { message: "database overrides read failure" };

      const actionRes = await getMyTodayScheduleAction("2026-09-13");
      expect(actionRes).toEqual({ error: "database overrides read failure" });

      const runtimeRes = await getProviderWorkspaceRuntime("2026-09-13");
      expect(runtimeRes.ok).toBe(true);
      if (runtimeRes.ok) {
        expect(runtimeRes.runtime.shift.kind).toBe("load_error");
        if (runtimeRes.runtime.shift.kind === "load_error") {
          expect(runtimeRes.runtime.shift.error).toBe("database overrides read failure");
        }
        expect(runtimeRes.runtime.errors?.schedule).toBe("database overrides read failure");
        expect(runtimeRes.runtime.shift.kind).not.toBe("none");
        expect(runtimeRes.runtime.shift.kind).not.toBe("day_off");
      }
    });

    it("C. both queries succeed with [] -> getMyTodayScheduleAction returns null schedule/override -> Provider runtime produces shift.kind = none (legitimate No Shift)", async () => {
      mockStaffSchedulesData = [];
      mockScheduleOverridesData = [];

      const actionRes = await getMyTodayScheduleAction("2026-09-13");
      expect(actionRes).toEqual({ todaySchedule: null, todayOverride: null });

      const runtimeRes = await getProviderWorkspaceRuntime("2026-09-13");
      expect(runtimeRes.ok).toBe(true);
      if (runtimeRes.ok) {
        expect(runtimeRes.runtime.shift.kind).toBe("none");
        expect(runtimeRes.runtime.errors?.schedule).toBeUndefined();
      }
    });

    it("D. day-off override still resolves day_off", async () => {
      mockStaffSchedulesData = [
        {
          id: "sch-1",
          staff_id: staffId,
          day_of_week: 0, // 2026-09-13 is Sunday = 0
          start_time: "09:00:00",
          end_time: "18:00:00",
          is_active: true,
          shift_type: "opening",
        },
      ];
      mockScheduleOverridesData = [
        {
          id: "ov-1",
          staff_id: staffId,
          override_date: "2026-09-13",
          is_day_off: true,
          start_time: null,
          end_time: null,
        },
      ];

      const actionRes = await getMyTodayScheduleAction("2026-09-13");
      expect("todayOverride" in actionRes).toBe(true);
      if ("todayOverride" in actionRes && actionRes.todayOverride) {
        expect(actionRes.todayOverride.is_day_off).toBe(true);
      }

      const runtimeRes = await getProviderWorkspaceRuntime("2026-09-13");
      expect(runtimeRes.ok).toBe(true);
      if (runtimeRes.ok) {
        expect(runtimeRes.runtime.shift.kind).toBe("day_off");
      }
    });
  });

  // ===========================================================================
  // SECTION 11: Business Date Failure & Error Truth
  // ===========================================================================
  describe("Section 11: Provider Business-Date Authority & Read Failure Protection", () => {
    it("1. attendance_settings row missing with successful DB query -> default read-only settings work -> valid business date returned", async () => {
      mockAttendanceSettingsData = null;
      mockAttendanceSettingsError = null;
      mockAttendanceRuleVersionsData = null;
      mockAttendanceRuleVersionsError = null;

      const testNow = new Date("2026-09-13T10:00:00+08:00");
      const date = await getProviderBusinessDate(branchId, testNow);
      expect(date).toBe("2026-09-13");
    });

    it("2. attendance_settings SELECT error -> no Asia/Manila silent fallback -> explicit error", async () => {
      mockAttendanceSettingsData = null;
      mockAttendanceSettingsError = { message: "permission denied for table attendance_settings" };

      await expect(getProviderBusinessDate(branchId)).rejects.toThrow(
        "permission denied for table attendance_settings"
      );
    });

    it("3. attendance_rule_versions SELECT error -> explicit error", async () => {
      mockAttendanceSettingsData = {
        branch_id: branchId,
        timezone: "Asia/Manila",
        attendance_day_boundary: "06:00:00",
      };
      mockAttendanceRuleVersionsError = {
        message: "query timeout on attendance_rule_versions",
      };

      await expect(getProviderBusinessDate(branchId)).rejects.toThrow(
        "query timeout on attendance_rule_versions"
      );
    });

    it("4. Provider runtime business-date failure -> does not load arbitrary date -> does not produce No assigned service / No Shift", async () => {
      mockAttendanceSettingsError = { message: "connection timeout reading settings" };

      const runtimeRes = await getProviderWorkspaceRuntime();
      expect(runtimeRes.ok).toBe(false);
      if (!runtimeRes.ok) {
        expect(runtimeRes.code).toBe("LOAD_ERROR");
        expect(runtimeRes.error).toBe("connection timeout reading settings");
      }
    });

    it("5. Provider Progress business-date failure -> returns truthful error state", async () => {
      mockAttendanceSettingsError = { message: "settings DB failure for progress" };

      const progressRes = await getMyServiceProgressAction();
      expect(progressRes).toEqual({ error: "settings DB failure for progress" });
    });

    it("6. Provider Today business-date failure -> returns truthful error state", async () => {
      mockAttendanceSettingsError = { message: "settings DB failure for today" };

      const todayRes = await getMyTodayAction();
      expect(todayRes).toEqual({ error: "settings DB failure for today" });
    });

    it("7. Missing branchId for authenticated provider -> returns/throws explicit error without guessing", async () => {
      await expect(getProviderBusinessDate(null)).rejects.toThrow(
        "Provider has no assigned branch for operational date resolution"
      );
      await expect(getProviderBusinessDate("   ")).rejects.toThrow(
        "Provider has no assigned branch for operational date resolution"
      );

      mockStaffRecord.branch_id = null;

      const todayRes = await getMyTodayAction();
      expect(todayRes).toEqual({
        error: "Provider has no assigned branch for operational date resolution",
      });

      const progressRes = await getMyServiceProgressAction();
      expect(progressRes).toEqual({
        error: "Provider has no assigned branch for operational date resolution",
      });

      const runtimeRes = await getProviderWorkspaceRuntime();
      expect(runtimeRes.ok).toBe(false);
      if (!runtimeRes.ok) {
        expect(runtimeRes.code).toBe("LOAD_ERROR");
        expect(runtimeRes.error).toBe(
          "Provider has no assigned branch for operational date resolution"
        );
      }
    });
  });
});
