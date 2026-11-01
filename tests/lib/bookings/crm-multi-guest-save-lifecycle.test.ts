import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, createAdmin } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdmin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdmin }));
vi.mock("@/lib/queries/branch-booking-rules", () => ({
  validateBookingAgainstBranchRules: vi.fn().mockResolvedValue({
    ok: true,
    rules: { travelBufferMins: 0 },
  }),
  getBranchBookingRulesOrDefault: vi.fn().mockResolvedValue({
    homeServiceDriverCapacity: 1,
  }),
}));
vi.mock("@/lib/services/service-catalog", () => ({
  validateBranchServiceEligibility: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/services/resolve-booking-line-quotes", () => ({
  resolveBookingLineQuotes: vi.fn().mockImplementation(async ({ serviceIds, serviceLines }: {
    serviceIds: string[];
    serviceLines?: Array<{ requestedDurationMinutes?: number }>;
  }) => serviceIds.map((id, index) => {
    const baseDuration = id === "cccccccc-cccc-4ccc-8ccc-cccccccccccc" ? 30
      : id === "dddddddd-dddd-4ddd-8ddd-dddddddddddd" ? 90
      : id === "55555555-5555-4555-8555-555555555555" ? 120 : 60;
    const basePrice = id === "cccccccc-cccc-4ccc-8ccc-cccccccccccc" ? 300
      : id === "dddddddd-dddd-4ddd-8ddd-dddddddddddd" ? 800
      : id === "55555555-5555-4555-8555-555555555555" ? 2500 : 600;
    const selectedDurationMinutes = serviceLines?.[index]?.requestedDurationMinutes ?? baseDuration;
    return {
      serviceId: id,
      durationPolicy: "fixed",
      baseDurationMinutes: baseDuration,
      selectedDurationMinutes,
      basePrice,
      extensionIncrementMinutes: null,
      extensionPrice: null,
      maximumDurationMinutes: null,
      extensionUnits: 0,
      calculatedPrice: basePrice,
      quoteVersion: "fixture-quote-v1",
    };
  })),
}));
vi.mock("@/lib/engine/exact-crm-booking-time", () => ({
  resolveExactCrmBookingTime: vi.fn().mockResolvedValue({
    available: true,
    providers: [{ staffId: "staff-1", selectable: true }],
  }),
}));
vi.mock("@/lib/engine/resource-availability", () => ({
  autoAssignBookingResource: vi.fn().mockResolvedValue("room-1"),
  isResourceAvailable: vi.fn().mockResolvedValue(true),
  allocateResourcesForAttendees: vi.fn().mockImplementation(async ({ windows }: { windows: unknown[] }) =>
    windows.map((_, idx) => `room-${idx + 1}`)
  ),
}));
vi.mock("@/lib/engine/availability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine/availability")>();
  return {
    ...actual,
    assignTherapistsForOrder: vi.fn().mockImplementation(async ({ attendees, preferredStaffId }: { attendees: Array<{ id: string }>; preferredStaffId?: string }) =>
      attendees.map((attendee, index) => ({
        attendeeId: attendee.id,
        staffId: index === 0 && preferredStaffId ? preferredStaffId : `staff-${index + 1}`,
      }))
    ),
  };
});
vi.mock("@/lib/home-service/distance-service", () => ({
  calculateHomeServiceDistanceQuote: vi.fn().mockResolvedValue({
    ok: true,
    quote: {
      distanceKm: 4,
      distanceSource: "google",
      travelFee: 100,
      freeKm: 2,
      extraKm: 2,
      feePerExtraKm: 50,
    },
  }),
  buildHomeServicePricingBreakdown: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/bookings/dispatch-conflict", () => ({
  checkHomeServiceDispatchConflict: vi.fn().mockResolvedValue({ conflict: "none" }),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));

import { executeInhouseBookingCreation } from "@/lib/bookings/inhouse-booking-engine";
import { assignTherapistsForOrder, findDistinctStaffAssignment } from "@/lib/engine/availability";
import { allocateResourcesForAttendees } from "@/lib/engine/resource-availability";
import { SlotUnavailableError } from "@/types/errors";

const branchId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const serviceA = "33333333-3333-4333-8333-333333333333";
const serviceB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const serviceC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const serviceConsultation = "55555555-5555-4555-8555-555555555555";
const att1 = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const att2 = "22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const att3 = "33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const att4 = "44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const operator = {
  authUserId: "user-123",
  staff: { id: "staff-op", branch_id: branchId, system_role: "crm" },
  staffRole: "crm",
  isDevBypass: false,
};

function setupMockDatabase(options?: {
  existingOrder?: Record<string, unknown> | null;
  attendeeRows?: unknown[];
  bookingRows?: unknown[];
}) {
  const services = [
    { id: serviceA, name: "Massage 60", price: 600, duration_minutes: 60, buffer_before: 0, buffer_after: 0, is_active: true, metadata: null, service_categories: { name: "Massages" } },
    { id: serviceB, name: "Massage 30", price: 300, duration_minutes: 30, buffer_before: 0, buffer_after: 0, is_active: true, metadata: null, service_categories: { name: "Massages" } },
    { id: serviceC, name: "Facial 90", price: 800, duration_minutes: 90, buffer_before: 0, buffer_after: 0, is_active: true, metadata: null, service_categories: { name: "Facials" } },
    { id: serviceConsultation, name: "Heavenly Harmony Couples or Besties Spa", price: 2500, duration_minutes: 120, buffer_before: 0, buffer_after: 0, is_active: true, metadata: null, service_categories: { name: "Spa Packages" } },
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
        if (table === "booking_orders") return { data: options?.existingOrder ?? null, error: null };
        if (table === "customers") return { data: { id: customerId }, error: null };
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
        if (table === "booking_attendees") return resolve({ data: options?.attendeeRows ?? [], error: null });
        if (table === "bookings") return resolve({ data: options?.bookingRows ?? [], error: null });
        return resolve({ data: [], error: null });
      };
      return { select: vi.fn().mockReturnValue(queryObj) };
    }),
    rpc,
  });
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({
    data: {
      order_id: "order-uuid-1",
      order_number: "CRD-202611-001",
      service_line_ids: ["line-1", "line-2"],
      attendee_ids: [att1, att2],
      idempotency_status: "created",
    },
    error: null,
  });
  setupMockDatabase();
});

describe("CRM Multi-Guest Booking Save Lifecycle", () => {
  it("creates a 2-guest booking under one atomic order with distinct staff and rooms", async () => {
    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA, serviceB],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceB] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      orderId: "order-uuid-1",
      orderNumber: "CRD-202611-001",
      attendeeCount: 2,
    });

    expect(assignTherapistsForOrder).toHaveBeenCalledOnce();
    expect(allocateResourcesForAttendees).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledOnce();

    const [, rpcArgs] = rpc.mock.calls[0] as [string, {
      p_attendees: Array<{ display_name: string; sequence: number }>;
      p_service_lines: Array<{ attendee_sequence: number; line_sequence: number; staff_id: string; resource_id: string }>;
    }];
    expect(rpcArgs.p_attendees).toEqual([
      { sequence: 1, display_name: "Organizer Name", customer_id: customerId },
      { sequence: 2, display_name: "Guest 2", customer_id: null },
    ]);
    expect(rpcArgs.p_service_lines).toHaveLength(2);
    expect(rpcArgs.p_service_lines[0]?.staff_id).toBe("staff-1");
    expect(rpcArgs.p_service_lines[1]?.staff_id).toBe("staff-2");
    expect(rpcArgs.p_service_lines[0]?.resource_id).toBe("room-1");
    expect(rpcArgs.p_service_lines[1]?.resource_id).toBe("room-2");
  });

  it("handles sequential multi-services for Guest 1 concurrently with single service for Guest 2", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        order_id: "order-uuid-multi",
        order_number: "CRD-202611-002",
        service_line_ids: ["line-1", "line-2", "line-3"],
        attendee_ids: [att1, att2],
        idempotency_status: "created",
      },
      error: null,
    });

    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174001",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA, serviceB, serviceC],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA, serviceB] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceC] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result.ok).toBe(true);

    const [, rpcArgs] = rpc.mock.calls[0] as [string, {
      p_service_lines: Array<{
        attendee_sequence: number;
        line_sequence: number;
        start_time: string;
        end_time: string;
        staff_id: string;
      }>;
    }];

    expect(rpcArgs.p_service_lines).toHaveLength(3);
    // Guest 1 Line 1: 14:00 to 15:00
    expect(rpcArgs.p_service_lines[0]).toMatchObject({
      attendee_sequence: 1,
      line_sequence: 1,
      start_time: "14:00:00",
      end_time: "15:00:00",
      staff_id: "staff-1",
    });
    // Guest 1 Line 2: 15:00 to 15:30 (sequential with Line 1)
    expect(rpcArgs.p_service_lines[1]).toMatchObject({
      attendee_sequence: 1,
      line_sequence: 2,
      start_time: "15:00:00",
      end_time: "15:30:00",
      staff_id: "staff-1",
    });
    // Guest 2 Line 1: 14:00 to 15:30 (concurrent with Guest 1, distinct staff)
    expect(rpcArgs.p_service_lines[2]).toMatchObject({
      attendee_sequence: 2,
      line_sequence: 1,
      start_time: "14:00:00",
      end_time: "15:30:00",
      staff_id: "staff-2",
    });
  });

  it("successfully creates a 4-guest booking (maximum contract capacity)", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        order_id: "order-uuid-4",
        order_number: "CRD-202611-004",
        service_line_ids: ["line-1", "line-2", "line-3", "line-4"],
        attendee_ids: [att1, att2, att3, att4],
        idempotency_status: "created",
      },
      error: null,
    });

    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174004",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceA] },
        { id: att3, name: "Guest 3", isOrganizer: false, serviceIds: [serviceA] },
        { id: att4, name: "Guest 4", isOrganizer: false, serviceIds: [serviceA] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      attendeeCount: 4,
      serviceCount: 4,
    });
  });

  it("fails with SLOT_UNAVAILABLE when distinct qualified therapists cannot cover all guests", async () => {
    vi.mocked(assignTherapistsForOrder).mockRejectedValueOnce(new SlotUnavailableError());

    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174099",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceA] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: false,
      code: "SLOT_UNAVAILABLE",
      message: "No scheduled therapist is available at this time. Try another time or check staff schedules.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails with RESOURCE_UNAVAILABLE when rooms cannot accommodate all guests concurrently", async () => {
    vi.mocked(allocateResourcesForAttendees).mockResolvedValueOnce(null);

    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174098",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceA] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: false,
      code: "RESOURCE_UNAVAILABLE",
      message: "Not enough rooms are available for all guests.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns existing group order upon identical retry (idempotency replay)", async () => {
    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceA] },
      ],
    };

    await executeInhouseBookingCreation(input, operator);
    const hash = rpc.mock.calls[0]?.[1].p_order.metadata.crm_input_hash;
    rpc.mockClear();

    setupMockDatabase({
      existingOrder: {
        id: "existing-order-id",
        order_number: "CRD-REPLAY-001",
        metadata: { crm_input_hash: hash },
      },
      attendeeRows: [
        { id: "att-row-1", sequence: 1 },
        { id: "att-row-2", sequence: 2 },
      ],
      bookingRows: [
        { id: "line-row-1", attendee_id: "att-row-1", line_sequence: 1 },
        { id: "line-row-2", attendee_id: "att-row-2", line_sequence: 1 },
      ],
    });

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: true,
      orderId: "existing-order-id",
      orderNumber: "CRD-REPLAY-001",
      serviceLineIds: ["line-row-1", "line-row-2"],
      attendeeCount: 2,
    });
    // When replayed, RPC writer is not called again
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects retry with IDEMPOTENCY_CONFLICT when key is reused with altered group details", async () => {
    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceA] },
      ],
    };

    setupMockDatabase({
      existingOrder: {
        id: "existing-order-id",
        order_number: "CRD-REPLAY-001",
        metadata: { crm_input_hash: "different-hash-from-previous-payload" },
      },
    });

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: false,
      code: "IDEMPOTENCY_CONFLICT",
      message: "This booking request key was already used for different details.",
    });
  });

  it("rejects a consultation-required group booking with MANUAL_ARRANGEMENT_REQUIRED when staffId is missing", async () => {
    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174099",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceConsultation, serviceA],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      staffId: undefined,
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceConsultation] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceA] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: false,
      code: "MANUAL_ARRANGEMENT_REQUIRED",
      message:
        "Select a coordinating provider and confirm the full participant and staffing arrangement manually.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects group booking with EXACT_THERAPIST_UNSUPPORTED_FOR_GROUP when customerRequestedTherapist is true", async () => {
    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174090",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA, serviceB],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      staffId: "44444444-4444-4444-8444-444444444444",
      customerRequestedTherapist: true,
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceB] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: false,
      code: "EXACT_THERAPIST_UNSUPPORTED_FOR_GROUP",
      message:
        "Exact therapist allocation is unsupported for group bookings. Proceed with a non-guaranteed preference after customer agreement, or return to single booking.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("never promises A to Guest 1 when Guest 2 can only use A, assigning A to Guest 2 and B to Guest 1 with system_assigned provenance", async () => {
    const staffA = "aaaaaaaa-1111-4111-8111-111111111111";
    const staffB = "bbbbbbbb-2222-4222-8222-222222222222";

    // 1. Verify bipartite matching solver directly
    const candidates = [
      [staffA, staffB], // Guest 1 can take A or B (A is preferred)
      [staffA],         // Guest 2 can only take A
    ];
    const assigned = findDistinctStaffAssignment(candidates);
    expect(assigned).toEqual([staffB, staffA]);

    // 2. Verify lifecycle behavior:
    // When Guest 1 expresses soft preference for staffA, but availability forces staffB for Guest 1 and staffA for Guest 2:
    vi.mocked(assignTherapistsForOrder).mockResolvedValueOnce([
      { attendeeId: att1, staffId: staffB },
      { attendeeId: att2, staffId: staffA },
    ]);

    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174091",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA, serviceB],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      staffId: staffA, // Soft preference for Organizer
      customerRequestedTherapist: false,
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceB] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result.ok).toBe(true);

    expect(rpc).toHaveBeenCalledOnce();
    const rpcPayload = rpc.mock.calls[0]?.[1];
    const lines = rpcPayload.p_service_lines;
    expect(lines).toHaveLength(2);

    // Guest 1 was given staffB (since staffA went to Guest 2)
    expect(lines[0].staff_id).toBe(staffB);
    // Ensure system never promised A to Guest 1: requested_staff_id is null, provenance is system_assigned
    expect(lines[0].metadata._therapist_provenance).toEqual({
      requested_staff_id: null,
      therapist_selection_source: "system_assigned",
    });

    // Guest 2 was given staffA
    expect(lines[1].staff_id).toBe(staffA);
    expect(lines[1].metadata._therapist_provenance).toEqual({
      requested_staff_id: null,
      therapist_selection_source: "system_assigned",
    });
  });

  it("accepts a consultation-required group booking when coordinating staffId is provided, propagating preferred staff and provenance", async () => {
    const coordinatingStaffId = "44444444-4444-4444-8444-444444444444";
    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174098",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceConsultation, serviceA],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      staffId: coordinatingStaffId,
      customerRequestedTherapist: false,
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceConsultation] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceA] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: true,
      orderId: "order-uuid-1",
      warning:
        "Manual arrangement required: confirm every participant, provider, room, and time before finalizing.",
    });
    expect(assignTherapistsForOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredStaffId: coordinatingStaffId,
      })
    );
    expect(rpc).toHaveBeenCalledOnce();
    const rpcPayload = rpc.mock.calls[0]?.[1];
    const lines = rpcPayload.p_service_lines;
    expect(lines).toHaveLength(2);
    expect(lines[0].metadata._therapist_provenance).toMatchObject({
      requested_staff_id: null,
      therapist_selection_source: "front_desk_selected",
    });
    expect(lines[1].metadata._therapist_provenance).toMatchObject({
      requested_staff_id: null,
      therapist_selection_source: "system_assigned",
    });
  });

  it("processes normal automatic group booking when staffId is undefined without manual warning", async () => {
    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174097",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA, serviceB],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      staffId: undefined,
      customerRequestedTherapist: false,
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceB] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: true,
      orderId: "order-uuid-1",
    });
    expect((result as { warning?: string }).warning).toBeUndefined();
    expect(assignTherapistsForOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredStaffId: undefined,
      })
    );
    const rpcPayload = rpc.mock.calls[0]?.[1];
    const lines = rpcPayload.p_service_lines;
    expect(lines[0].metadata._therapist_provenance).toMatchObject({
      requested_staff_id: null,
      therapist_selection_source: "system_assigned",
    });
    expect(lines[1].metadata._therapist_provenance).toMatchObject({
      requested_staff_id: null,
      therapist_selection_source: "system_assigned",
    });
  });

  it("returns SLOT_UNAVAILABLE when therapist assignment fails due to insufficient staff", async () => {
    vi.mocked(assignTherapistsForOrder).mockRejectedValueOnce(new SlotUnavailableError());

    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174096",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA, serviceB],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceB] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: false,
      code: "SLOT_UNAVAILABLE",
      message: "No scheduled therapist is available at this time. Try another time or check staff schedules.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rolls back and returns BOOKING_ATOMIC_PERSISTENCE_FAILED when the atomic RPC fails", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Atomic transaction constraint violation" },
    });

    const input = {
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174095",
      branchId,
      customerId,
      bookingFor: "me_and_others" as const,
      serviceIds: [serviceA, serviceB],
      date: "2026-11-02",
      startTime: "14:00",
      type: "walkin" as const,
      fullName: "Organizer Name",
      phone: "09171234567",
      attendees: [
        { id: att1, name: "Organizer Name", isOrganizer: true, serviceIds: [serviceA] },
        { id: att2, name: "Guest 2", isOrganizer: false, serviceIds: [serviceB] },
      ],
    };

    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({
      ok: false,
      code: "BOOKING_ATOMIC_PERSISTENCE_FAILED",
      message: "Could not create the booking and payment together. Please review the booking and try again.",
    });
  });
});
