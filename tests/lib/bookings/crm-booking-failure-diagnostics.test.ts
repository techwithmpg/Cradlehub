import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, createAdmin } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdmin }));
vi.mock("@/lib/queries/branch-booking-rules", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries/branch-booking-rules")>();
  return {
    ...actual,
    validateBookingAgainstBranchRules: vi.fn(),
    getBranchBookingRulesOrDefault: vi.fn().mockResolvedValue({
      homeServiceDriverCapacity: 1,
      maxAdvanceBookingDays: 30,
      homeServiceEnabled: true,
    }),
  };
});
vi.mock("@/lib/services/service-catalog", () => ({
  validateBranchServiceEligibility: vi.fn(),
}));
vi.mock("@/lib/services/resolve-booking-line-quotes", () => ({
  resolveBookingLineQuotes: vi.fn().mockImplementation(async ({ serviceIds }: { serviceIds: string[] }) =>
    serviceIds.map((id) => ({
      serviceId: id,
      durationPolicy: "fixed",
      baseDurationMinutes: 60,
      selectedDurationMinutes: 60,
      basePrice: 600,
      extensionIncrementMinutes: null,
      extensionPrice: null,
      maximumDurationMinutes: null,
      extensionUnits: 0,
      calculatedPrice: 600,
      quoteVersion: "fixture-quote-v1",
    }))
  ),
}));
vi.mock("@/lib/engine/exact-crm-booking-time", () => ({
  resolveExactCrmBookingTime: vi.fn(),
}));
vi.mock("@/lib/engine/resource-availability", () => ({
  autoAssignBookingResource: vi.fn().mockResolvedValue("55555555-5555-4555-8555-555555555551"),
  isResourceAvailable: vi.fn(),
  allocateResourcesForAttendees: vi.fn(),
}));
vi.mock("@/lib/engine/availability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine/availability")>();
  return {
    ...actual,
    assignTherapistsForOrder: vi.fn(),
  };
});
vi.mock("@/lib/home-service/distance-service", () => ({
  calculateHomeServiceDistanceQuote: vi.fn(),
}));
vi.mock("@/lib/bookings/dispatch-conflict", () => ({
  checkHomeServiceDispatchConflict: vi.fn(),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));

import { executeInhouseBookingCreation, type InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";
import { assignTherapistsForOrder, GroupTherapistAllocationError } from "@/lib/engine/availability";
import { resolveExactCrmBookingTime } from "@/lib/engine/exact-crm-booking-time";
import { allocateResourcesForAttendees, autoAssignBookingResource, isResourceAvailable } from "@/lib/engine/resource-availability";
import { getBranchBookingRulesOrDefault, validateBookingAgainstBranchRules } from "@/lib/queries/branch-booking-rules";
import { validateBranchServiceEligibility } from "@/lib/services/service-catalog";
import { calculateHomeServiceDistanceQuote } from "@/lib/home-service/distance-service";
import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";
import { resolveBookingLineQuotes } from "@/lib/services/resolve-booking-line-quotes";

const branchId = "11111111-1111-4111-8111-111111111111";
const serviceA = "22222222-2222-4222-8222-222222222222";
const serviceB = "33333333-3333-4333-8333-333333333333";
const customerId = "77777777-7777-4777-8777-777777777777";
const staffId1 = "44444444-4444-4444-8444-444444444441";
const resourceId1 = "55555555-5555-4555-8555-555555555551";

const operator: InhouseBookingOperator = {
  authUserId: "user-1",
  staff: {
    id: "staff-op-1",
    branch_id: branchId,
    system_role: "crm",
  },
  staffRole: "crm",
  isDevBypass: false,
};

describe("CRM Booking Creation Diagnostics & Structured Feedback Contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(getBranchBookingRulesOrDefault).mockResolvedValue({
      homeServiceDriverCapacity: 1,
      maxAdvanceBookingDays: 30,
      homeServiceEnabled: true,
      travelBufferMins: 0,
      operatingHours: [],
    } as unknown as Awaited<ReturnType<typeof getBranchBookingRulesOrDefault>>);
    vi.mocked(autoAssignBookingResource).mockResolvedValue("55555555-5555-4555-8555-555555555551");
    vi.mocked(resolveBookingLineQuotes).mockImplementation(async ({ serviceIds }: { serviceIds: string[] }) =>
      serviceIds.map((id) => ({
        serviceId: id,
        durationPolicy: "fixed",
        baseDurationMinutes: 60,
        selectedDurationMinutes: 60,
        basePrice: 600,
        extensionIncrementMinutes: null,
        extensionPrice: null,
        maximumDurationMinutes: null,
        extensionUnits: 0,
        calculatedPrice: 600,
        quoteVersion: "fixture-quote-v1",
      }))
    );
    vi.mocked(validateBranchServiceEligibility).mockResolvedValue({
      ok: true,
      invalidServiceIds: [],
      results: {},
    });
    vi.mocked(validateBookingAgainstBranchRules).mockResolvedValue({
      ok: true,
      rules: { travelBufferMins: 0, maxAdvanceBookingDays: 30 },
    } as unknown as Awaited<ReturnType<typeof validateBookingAgainstBranchRules>>);
    vi.mocked(resolveExactCrmBookingTime).mockResolvedValue({
      available: true,
      providers: [{ staffId: staffId1, selectable: true }],
    } as unknown as Awaited<ReturnType<typeof resolveExactCrmBookingTime>>);
    vi.mocked(isResourceAvailable).mockResolvedValue(true);
    vi.mocked(allocateResourcesForAttendees).mockImplementation(async ({ windows }: { windows: unknown[] }) =>
      windows.map((_, idx) => `55555555-5555-4555-8555-55555555555${idx + 1}`)
    );
    vi.mocked(assignTherapistsForOrder).mockImplementation(async ({ attendees }) =>
      attendees.map((attendee, index) => ({
        attendeeId: attendee.id ?? `att-${index}`,
        staffId: `44444444-4444-4444-8444-44444444444${index + 1}`,
      }))
    );
    vi.mocked(calculateHomeServiceDistanceQuote).mockResolvedValue({
      ok: true,
      quote: { distanceKm: 4, distanceSource: "google", travelFee: 100, freeKm: 2 },
    } as unknown as Awaited<ReturnType<typeof calculateHomeServiceDistanceQuote>>);
    vi.mocked(checkHomeServiceDispatchConflict).mockResolvedValue({ conflict: "none" } as unknown as Awaited<ReturnType<typeof checkHomeServiceDispatchConflict>>);

    const services = [
      { id: serviceA, name: "Swedish Massage", price: 600, duration_minutes: 60, buffer_before: 0, buffer_after: 0, is_active: true, metadata: null, service_categories: { name: "Massages" } },
      { id: serviceB, name: "Signature Facial", price: 800, duration_minutes: 60, buffer_before: 0, buffer_after: 0, is_active: true, metadata: null, service_categories: { name: "Facials" } },
    ];
    const overrides = services.map((s) => ({
      service_id: s.id,
      custom_price: null,
      custom_duration_minutes: null,
    }));

    createAdmin.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        let filteredIds: string[] | null = null;
        const queryObj: Record<string, unknown> = {};
        queryObj.eq = vi.fn().mockReturnValue(queryObj);
        queryObj.not = vi.fn().mockReturnValue(queryObj);
        queryObj.order = vi.fn().mockReturnValue(queryObj);
        queryObj.in = vi.fn().mockImplementation((col: string, values: string[]) => {
          if (col === "id" || col === "service_id") filteredIds = values;
          return queryObj;
        });
        queryObj.maybeSingle = vi.fn().mockImplementation(async () => {
          if (table === "customers") return { data: { id: customerId }, error: null };
          if (table === "branch_resources") return { data: { id: resourceId1 }, error: null };
          return { data: null, error: null };
        });
        queryObj.then = (resolve: (v: unknown) => void) => {
          if (table === "services") {
            const result = filteredIds ? services.filter((s) => filteredIds!.includes(s.id)) : services;
            return resolve({ data: result, error: null });
          }
          if (table === "branch_services") {
            const result = filteredIds ? overrides.filter((o) => filteredIds!.includes(o.service_id)) : overrides;
            return resolve({ data: result, error: null });
          }
          if (table === "branch_resources") {
            return resolve({ data: [{ id: resourceId1 }], count: 1, error: null });
          }
          return resolve({ data: [], error: null });
        };
        return { select: vi.fn().mockReturnValue(queryObj) };
      }),
      rpc: rpc.mockImplementation(async (name: string) => {
        if (name === "upsert_customer") {
          return { data: customerId, error: null };
        }
        return {
          data: {
            service_line_ids: ["line-1"],
            attendee_ids: ["att-1"],
            order_id: "order-1",
            order_number: "ORD-1",
            idempotency_status: "created",
          },
          error: null,
        };
      }),
    });
  });

  describe("A & B. Therapist Qualification, Availability & Group Contention", () => {
    it("reports specific guest attribution when an individual attendee has no qualified therapist", async () => {
      vi.mocked(assignTherapistsForOrder).mockRejectedValueOnce(
        new GroupTherapistAllocationError(
          "INDIVIDUAL_THERAPIST_UNAVAILABLE",
          1,
          [serviceB],
          "No qualified therapist is available for attendee 2 at this time."
        )
      );

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Primary Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA, serviceB],
          type: "walkin",
          bookingFor: "me_and_others",
          attendees: [
            { id: "66666666-6666-4666-8666-666666666661", name: "Primary Guest", isOrganizer: true, serviceIds: [serviceA] },
            { id: "66666666-6666-4666-8666-666666666662", name: "Second Guest", isOrganizer: false, serviceIds: [serviceB] },
          ],
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("INDIVIDUAL_THERAPIST_UNAVAILABLE");
        expect(result.title).toBe("Therapist unavailable");
        expect(result.guestIndex).toBe(1);
        expect(result.guestName).toBe("Second Guest");
        expect(result.message).toContain("Second Guest");
        expect(result.field).toBe("staffId");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports group-level capacity explanation when distinct therapists cannot be assigned concurrently", async () => {
      vi.mocked(assignTherapistsForOrder).mockRejectedValueOnce(
        new GroupTherapistAllocationError(
          "GROUP_THERAPIST_CAPACITY_EXCEEDED",
          undefined,
          undefined,
          "Not enough distinct therapists are available to serve all 2 guests simultaneously."
        )
      );

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Primary Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
          bookingFor: "me_and_others",
          attendees: [
            { id: "66666666-6666-4666-8666-666666666661", name: "Primary Guest", isOrganizer: true, serviceIds: [serviceA] },
            { id: "66666666-6666-4666-8666-666666666662", name: "Second Guest", isOrganizer: false, serviceIds: [serviceA] },
          ],
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("GROUP_THERAPIST_CAPACITY_EXCEEDED");
        expect(result.title).toBe("Not enough therapists for this group");
        expect(result.guestIndex).toBeUndefined();
        expect(result.message).toContain("Not enough distinct qualified therapists");
        expect(result.field).toBe("staffId");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports specific operating hours violation when single-guest exact time is outside in-spa hours", async () => {
      vi.mocked(resolveExactCrmBookingTime).mockResolvedValueOnce({
        available: false,
        reasonCode: "outside_in_spa_hours",
        message: "In-spa appointments at this branch are available from 10:00 to 22:00.",
        warning: null,
        totalBlockMinutes: 60,
        travelBufferMinutes: 0,
        serviceEndTime: null,
        operationalStartTime: null,
        operationalEndTime: null,
        availableStaffIds: [],
        providers: [],
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "23:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("OPERATING_HOURS_VIOLATION");
        expect(result.title).toBe("Outside operating hours");
        expect(result.field).toBe("time");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports therapist booking conflict when the selected staff has an overlapping booking", async () => {
      vi.mocked(resolveExactCrmBookingTime).mockResolvedValueOnce({
        available: false,
        reasonCode: "blocked_by_booking",
        message: "The selected therapist is currently performing another service.",
        warning: null,
        totalBlockMinutes: 60,
        travelBufferMinutes: 0,
        serviceEndTime: null,
        operationalStartTime: null,
        operationalEndTime: null,
        availableStaffIds: [],
        providers: [],
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          staffId: staffId1,
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("THERAPIST_BOOKING_CONFLICT");
        expect(result.title).toBe("Therapist already booked");
        expect(result.field).toBe("staffId");
        expect(result.retrySafety).toBe("safe");
      }
    });
  });

  describe("C. Branch Booking Rules: Date & Operating Hours", () => {
    it("reports PAST_DATE accurately when the requested date has already passed", async () => {
      vi.mocked(validateBookingAgainstBranchRules).mockResolvedValueOnce({
        ok: false,
        code: "PAST_DATE",
        field: "date",
        message: "The selected booking date has already passed. Please choose today or a future date.",
        correctiveAction: "Choose today or a future date for this booking.",
        rules: { travelBufferMins: 0, maxAdvanceBookingDays: 30 },
      } as unknown as Awaited<ReturnType<typeof validateBookingAgainstBranchRules>>);

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2020-01-01",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("PAST_DATE");
        expect(result.title).toBe("Selected date has passed");
        expect(result.field).toBe("date");
        expect(result.message).toContain("already passed");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports ADVANCE_LIMIT_EXCEEDED when booking too far in advance", async () => {
      vi.mocked(validateBookingAgainstBranchRules).mockResolvedValueOnce({
        ok: false,
        code: "ADVANCE_LIMIT_EXCEEDED",
        field: "date",
        message: "Bookings for this branch can be made up to 30 days in advance.",
        correctiveAction: "Choose a date within 30 days from today.",
        rules: { travelBufferMins: 0, maxAdvanceBookingDays: 30 },
      } as unknown as Awaited<ReturnType<typeof validateBookingAgainstBranchRules>>);

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2027-01-01",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ADVANCE_LIMIT_EXCEEDED");
        expect(result.title).toBe("Branch booking rule limit");
        expect(result.field).toBe("date");
        expect(result.retrySafety).toBe("safe");
      }
    });
  });

  describe("D. Room Availability & Resource Capacity", () => {
    it("reports treatment room shortage for group bookings", async () => {
      vi.mocked(allocateResourcesForAttendees).mockResolvedValueOnce(null);

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Primary Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA, serviceB],
          type: "walkin",
          bookingFor: "me_and_others",
          attendees: [
            { id: "66666666-6666-4666-8666-666666666661", name: "Primary Guest", isOrganizer: true, serviceIds: [serviceA] },
            { id: "66666666-6666-4666-8666-666666666662", name: "Second Guest", isOrganizer: false, serviceIds: [serviceB] },
          ],
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("RESOURCE_UNAVAILABLE");
        expect(result.title).toBe("Treatment rooms unavailable");
        expect(result.field).toBe("resourceId");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports manual room occupied when selected resource is in use", async () => {
      vi.mocked(isResourceAvailable).mockResolvedValueOnce(false);

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          resourceId: resourceId1,
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("RESOURCE_UNAVAILABLE");
        expect(result.title).toBe("Treatment room occupied");
        expect(result.field).toBe("resourceId");
        expect(result.retrySafety).toBe("safe");
      }
    });
  });

  describe("E. Service Eligibility & Consultation Package", () => {
    it("reports SERVICE_INELIGIBLE when a service is not offered for the delivery mode", async () => {
      vi.mocked(validateBranchServiceEligibility).mockResolvedValueOnce({
        ok: false,
        invalidServiceIds: [serviceB],
        results: {},
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceB],
          type: "home_service",
          homeServiceAddress: "123 Main St, Barangay San Antonio, Pasig City",
          homeServiceFormattedAddress: "123 Main St, Barangay San Antonio, Pasig City",
          homeServicePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          homeServiceLat: 14.58,
          homeServiceLng: 121.06,
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVICE_INELIGIBLE");
        expect(result.title).toBe("Service unavailable");
        expect(result.field).toBe("service");
        expect(result.retrySafety).toBe("safe");
      }
    });
  });

  describe("F. Home Service Address & Dispatch", () => {
    it("reports validation error targeting homeServiceAddress when address is empty", async () => {
      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "home_service",
          homeServiceAddress: "",
          homeServiceFormattedAddress: "",
          homeServicePlaceId: "",
          homeServiceLat: null,
          homeServiceLng: null,
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION_ERROR");
        expect(result.field).toBe("homeServiceAddress");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports DISPATCH_CONFLICT when driver travel buffers conflict", async () => {
      vi.mocked(checkHomeServiceDispatchConflict).mockResolvedValueOnce({
        conflict: "hard",
        message: "No driver is available to accommodate travel buffers for this booking.",
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "home_service",
          homeServiceAddress: "123 Main St, Pasig",
          homeServiceFormattedAddress: "123 Main St, Pasig",
          homeServicePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
          homeServiceLat: 14.58,
          homeServiceLng: 121.06,
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("DISPATCH_CONFLICT");
        expect(result.title).toBe("Home service dispatch conflict");
        expect(result.field).toBe("time");
        expect(result.retrySafety).toBe("safe");
      }
    });
  });

  describe("H. Authorization & Branch Access", () => {
    it("reports UNAUTHORIZED with do_not_retry safety when operator lacks permission", async () => {
      const unauthOperator: InhouseBookingOperator = {
        authUserId: "unauth-user",
        staff: null,
        staffRole: null,
        isDevBypass: false,
      };

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        unauthOperator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
        expect(result.title).toBe("Access restricted");
        expect(result.retrySafety).toBe("do_not_retry");
      }
    });
  });

  describe("I. Atomic Persistence Errors, Concurrency & Idempotency", () => {
    it("translates BOOKING_STAFF_TIME_CONFLICT into actionable concurrent booking feedback", async () => {
      rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "BOOKING_STAFF_TIME_CONFLICT: Therapist was just reserved", code: "P0001" },
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BOOKING_STAFF_TIME_CONFLICT");
        expect(result.title).toBe("Therapist booked concurrently");
        expect(result.field).toBe("staffId");
        expect(result.message).toContain("just reserved");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("translates BOOKING_RESOURCE_TIME_CONFLICT into actionable room conflict feedback", async () => {
      rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "BOOKING_RESOURCE_TIME_CONFLICT: Room occupied", code: "P0001" },
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BOOKING_RESOURCE_TIME_CONFLICT");
        expect(result.title).toBe("Treatment room conflict");
        expect(result.field).toBe("resourceId");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("translates CASH_DRAWER_SESSION_REQUIRED into clear Cash Flow guidance", async () => {
      rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "CASH_DRAWER_SESSION_REQUIRED: Open the drawer", code: "P0001" },
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
          idempotencyKey: "88888888-8888-4888-8888-888888888888",
          paymentReceived: true,
          paymentMethod: "cash",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("CASH_DRAWER_SESSION_REQUIRED");
        expect(result.title).toBe("Cash drawer session required");
        expect(result.field).toBe("paymentMethod");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("translates IDEMPOTENCY_CONFLICT with verify_first retry safety to prevent double bookings", async () => {
      rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "IDEMPOTENCY_CONFLICT: Key collision", code: "P0001" },
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("IDEMPOTENCY_CONFLICT");
        expect(result.title).toBe("Conflicting booking submission");
        expect(result.retrySafety).toBe("verify_first");
      }
    });

    it("reports SERVICE_NOT_CONFIGURED_FOR_BRANCH when branch_services lacks configuration for service", async () => {
      createAdmin.mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          const queryObj: Record<string, unknown> = {};
          queryObj.eq = vi.fn().mockReturnValue(queryObj);
          queryObj.not = vi.fn().mockReturnValue(queryObj);
          queryObj.order = vi.fn().mockReturnValue(queryObj);
          queryObj.in = vi.fn().mockReturnValue(queryObj);
          queryObj.maybeSingle = vi.fn().mockImplementation(async () => {
            if (table === "customers") return { data: { id: customerId }, error: null };
            return { data: null, error: null };
          });
          queryObj.then = (resolve: (v: unknown) => void) => {
            if (table === "services") {
              return resolve({
                data: [
                  { id: serviceA, name: "Swedish Massage", price: 600, duration_minutes: 60, buffer_before: 0, buffer_after: 0, is_active: true, metadata: null, service_categories: { name: "Massages" } },
                ],
                error: null,
              });
            }
            if (table === "branch_services") {
              return resolve({ data: [], error: null }); // Not configured for branch
            }
            return resolve({ data: [], error: null });
          };
          return { select: vi.fn().mockReturnValue(queryObj) };
        }),
        rpc,
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVICE_NOT_CONFIGURED_FOR_BRANCH");
        expect(result.title).toBe("Service not configured for branch");
        expect(result.field).toBe("service");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports SERVICE_UNAVAILABLE when requested catalog service is inactive or missing", async () => {
      createAdmin.mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          const queryObj: Record<string, unknown> = {};
          queryObj.eq = vi.fn().mockReturnValue(queryObj);
          queryObj.not = vi.fn().mockReturnValue(queryObj);
          queryObj.order = vi.fn().mockReturnValue(queryObj);
          queryObj.in = vi.fn().mockReturnValue(queryObj);
          queryObj.maybeSingle = vi.fn().mockImplementation(async () => {
            if (table === "customers") return { data: { id: customerId }, error: null };
            return { data: null, error: null };
          });
          queryObj.then = (resolve: (v: unknown) => void) => {
            if (table === "services") {
              return resolve({ data: [], error: null }); // Inactive or not found
            }
            return resolve({ data: [], error: null });
          };
          return { select: vi.fn().mockReturnValue(queryObj) };
        }),
        rpc,
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
        expect(result.title).toBe("Service inactive");
        expect(result.field).toBe("service");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports MISSING_SERVICE_CAPABILITY when selected therapist lacks skill qualification", async () => {
      vi.mocked(resolveExactCrmBookingTime).mockResolvedValueOnce({
        available: false,
        reasonCode: "missing_service_capability",
        message: "Therapist does not possess required skill capability.",
      } as unknown as Awaited<ReturnType<typeof resolveExactCrmBookingTime>>);

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          staffId: staffId1,
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("MISSING_SERVICE_CAPABILITY");
        expect(result.title).toBe("Therapist qualification mismatch");
        expect(result.field).toBe("staffId");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports NO_SCHEDULE_AT_START when therapist is not on duty at the requested time", async () => {
      vi.mocked(resolveExactCrmBookingTime).mockResolvedValueOnce({
        available: false,
        reasonCode: "no_schedule_for_time",
        message: "No therapist shift schedule covers the requested start time.",
      } as unknown as Awaited<ReturnType<typeof resolveExactCrmBookingTime>>);

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          staffId: staffId1,
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("NO_SCHEDULE_AT_START");
        expect(result.title).toBe("Therapist not scheduled");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports RESOURCE_INVALID when selected treatment room is inactive or does not belong to branch", async () => {
      createAdmin.mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          const queryObj: Record<string, unknown> = {};
          queryObj.eq = vi.fn().mockReturnValue(queryObj);
          queryObj.not = vi.fn().mockReturnValue(queryObj);
          queryObj.order = vi.fn().mockReturnValue(queryObj);
          queryObj.in = vi.fn().mockReturnValue(queryObj);
          queryObj.maybeSingle = vi.fn().mockImplementation(async () => {
            if (table === "branch_resources") return { data: null, error: null }; // Invalid room
            if (table === "customers") return { data: { id: customerId }, error: null };
            return { data: null, error: null };
          });
          queryObj.then = (resolve: (v: unknown) => void) => {
            if (table === "branch_resources") return resolve({ data: [], error: null });
            return resolve({ data: [], error: null });
          };
          return { select: vi.fn().mockReturnValue(queryObj) };
        }),
        rpc,
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          resourceId: "55555555-5555-4555-8555-999999999999",
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("RESOURCE_INVALID");
        expect(result.title).toBe("Invalid room selected");
        expect(result.field).toBe("resourceId");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports HOME_SERVICE_DISABLED when branch does not support home service delivery", async () => {
      vi.mocked(validateBookingAgainstBranchRules).mockResolvedValueOnce({
        ok: false,
        code: "HOME_SERVICE_DISABLED",
        message: "Home service is currently disabled for this branch.",
        field: "general",
      } as unknown as Awaited<ReturnType<typeof validateBookingAgainstBranchRules>>);

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Home Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "home_service",
          deliveryType: "home_service",
          homeServiceAddress: "123 Main St",
          homeServiceFormattedAddress: "123 Main St, Bacolod City",
          homeServicePlaceId: "place-1",
          homeServiceLat: 14.5,
          homeServiceLng: 121.0,
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("HOME_SERVICE_DISABLED");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports CUSTOMER_ERROR when customer upsert fails due to database error", async () => {
      rpc.mockImplementation(async (name: string) => {
        if (name === "upsert_customer") {
          return { data: null, error: { message: "Invalid phone number constraint", code: "23514" } };
        }
        return { data: null, error: null };
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          fullName: "New Customer",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("CUSTOMER_ERROR");
        expect(result.title).toBe("Customer details error");
        expect(result.field).toBe("phone");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("reports VALIDATION_ERROR when customer name or phone is invalid", async () => {
      const shortNameResult = await executeInhouseBookingCreation(
        {
          branchId,
          fullName: "X",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(shortNameResult.ok).toBe(false);
      if (!shortNameResult.ok) {
        expect(shortNameResult.code).toBe("VALIDATION_ERROR");
        expect(shortNameResult.field).toBe("fullName");
        expect(shortNameResult.retrySafety).toBe("safe");
      }

      const shortPhoneResult = await executeInhouseBookingCreation(
        {
          branchId,
          fullName: "Valid Name",
          phone: "123",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(shortPhoneResult.ok).toBe(false);
      if (!shortPhoneResult.ok) {
        expect(shortPhoneResult.code).toBe("VALIDATION_ERROR");
        expect(shortPhoneResult.field).toBe("phone");
        expect(shortPhoneResult.retrySafety).toBe("safe");
      }
    });

    it("reports TIME_TOO_LATE with midnight rollover feedback when booking finishes after midnight", async () => {
      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Late Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "23:30",
          serviceIds: [serviceA], // 60 mins -> 00:30 rollover
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("TIME_TOO_LATE");
        expect(result.title).toBe("Booking crosses midnight");
        expect(result.message).toContain("crosses midnight");
        expect(result.field).toBe("time");
        expect(result.retrySafety).toBe("safe");
      }
    });

    it("classifies unexpected atomic persistence failure as BOOKING_ATOMIC_PERSISTENCE_FAILED with verify_first retry safety", async () => {
      rpc.mockImplementation(async (name: string) => {
        if (name === "create_inhouse_booking_atomic_v2") {
          return { data: null, error: { message: "Internal transaction failure in atomic RPC", code: "XX000" } };
        }
        return { data: null, error: null };
      });

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BOOKING_ATOMIC_PERSISTENCE_FAILED");
        expect(result.title).toBe("Booking submission unresolved");
        expect(result.field).toBe("general");
        expect(result.retrySafety).toBe("verify_first");
      }
    });

    it("classifies unhandled runtime exception as UNKNOWN_ERROR with verify_first retry safety", async () => {
      rpc.mockRejectedValueOnce(new Error("Unexpected network abort during RPC invocation"));

      const result = await executeInhouseBookingCreation(
        {
          branchId,
          customerId,
          fullName: "Solo Guest",
          phone: "09171234567",
          date: "2026-11-02",
          startTime: "14:00",
          serviceIds: [serviceA],
          type: "walkin",
        },
        operator
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNKNOWN_ERROR");
        expect(result.title).toBe("Booking submission unconfirmed");
        expect(result.retrySafety).toBe("verify_first");
      }
    });
  });
});
