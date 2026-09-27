import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logBusinessEvent: vi.fn(),
}));

vi.mock("@/lib/queries/assignment-recommendations", () => ({
  buildRecommendationContext: vi.fn(),
}));

vi.mock("@/lib/assignments/recommendation-engine", () => ({
  scoreTherapistCandidates: vi.fn(),
}));

vi.mock("@/lib/engine/booking-time", () => ({
  computeEndTime: vi.fn().mockResolvedValue("15:00:00"),
}));

vi.mock("@/lib/engine/resource-availability", () => ({
  isResourceAvailable: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/notifications/create", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
  resolveNotificationsForEntity: vi.fn().mockResolvedValue(undefined),
  getNotificationTargetPath: vi
    .fn()
    .mockReturnValue("/staff-portal/bookings/550e8400-e29b-41d4-a716-446655440000"),
}));

vi.mock("@/lib/bookings/staff-schedule-exception-signals", () => ({
  resolveStaffScheduleExceptionSignals: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));

vi.mock("@/lib/cache/cache-tags", () => ({
  invalidateCrmWorkspace: vi.fn(),
  invalidateManagerWorkspace: vi.fn(),
}));

const mockAdminClient = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

import { rescheduleBooking } from "@/lib/bookings/crm-booking-operations";
import { buildRecommendationContext } from "@/lib/queries/assignment-recommendations";
import { scoreTherapistCandidates } from "@/lib/assignments/recommendation-engine";
import { createNotification, resolveNotificationsForEntity } from "@/lib/notifications/create";
import { resolveStaffScheduleExceptionSignals } from "@/lib/bookings/staff-schedule-exception-signals";

const mockedBuildRec = vi.mocked(buildRecommendationContext);
const mockedScore = vi.mocked(scoreTherapistCandidates);
const mockedCreateNotification = vi.mocked(createNotification);
const mockedResolveNotifications = vi.mocked(resolveNotificationsForEntity);
const mockedResolveSignals = vi.mocked(resolveStaffScheduleExceptionSignals);

const BOOKING_ID = "550e8400-e29b-41d4-a716-446655440000";
const THERAPIST_CURRENT = "550e8400-e29b-41d4-a716-446655440001";
const THERAPIST_OLD = "550e8400-e29b-41d4-a716-446655440002";
const THERAPIST_NEW = "550e8400-e29b-41d4-a716-446655440003";
const THERAPIST_BUSY = "550e8400-e29b-41d4-a716-446655440004";
const THERAPIST_UNQUALIFIED = "550e8400-e29b-41d4-a716-446655440005";
const THERAPIST_INACTIVE = "550e8400-e29b-41d4-a716-446655440006";
const THERAPIST_NORTH = "550e8400-e29b-41d4-a716-446655440007";
const DRIVER_ID = "550e8400-e29b-41d4-a716-446655440008";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440009";
const SERVICE_ID = "550e8400-e29b-41d4-a716-446655440010";
const BRANCH_MAIN = "550e8400-e29b-41d4-a716-446655440011";
const BRANCH_NORTH = "550e8400-e29b-41d4-a716-446655440012";
const USER_CRM = "550e8400-e29b-41d4-a716-446655440013";
const STAFF_CRM = "550e8400-e29b-41d4-a716-446655440014";

type QueryChain = {
  eq: ReturnType<typeof vi.fn>;
  select?: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function makeSelectChain(data: unknown): QueryChain {
  const chain: QueryChain = {
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  return chain;
}

type UpdateChain = {
  eq: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
};

function makeUpdateChain(
  updatedRows: unknown[],
  capturePayload?: (payload: Record<string, unknown>) => void
) {
  return vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    if (capturePayload) capturePayload(payload);
    const chain: UpdateChain = {
      eq: vi.fn(() => chain),
      select: vi.fn().mockResolvedValue({ data: updatedRows, error: null }),
    };
    return chain;
  });
}

function makeCtx(role = "crm", branchId = BRANCH_MAIN) {
  const ctxChain: QueryChain = {
    eq: vi.fn(() => ctxChain),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: BOOKING_ID,
        branch_id: branchId,
        status: "confirmed",
        booking_progress_status: "pending",
        customer_id: CUSTOMER_ID,
      },
      error: null,
    }),
  };
  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(ctxChain),
      }),
      rpc: vi.fn().mockResolvedValue({ data: "15:00:00", error: null }),
    } as unknown as Parameters<typeof rescheduleBooking>[0]["supabase"],
    authUserId: USER_CRM,
    me: { id: STAFF_CRM, branch_id: branchId, system_role: role } as Parameters<
      typeof rescheduleBooking
    >[0]["me"],
    allowOwnerCrossBranch: false,
  };
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    branch_id: BRANCH_MAIN,
    status: "confirmed",
    booking_progress_status: "pending",
    customer_id: CUSTOMER_ID,
    service_id: SERVICE_ID,
    staff_id: THERAPIST_OLD,
    resource_id: null,
    booking_date: "2026-09-15",
    start_time: "10:00:00",
    end_time: "11:00:00",
    payment_status: "paid",
    delivery_type: "in_store",
    type: "in_store",
    metadata: {},
    staff: [{ full_name: "Old Therapist" }],
    service: [{ duration_minutes: 60, name: "Massage" }],
    ...overrides,
  };
}

function setupDefaultStaffTable() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockImplementation((_col: string, val: string) => {
        let staffData: Record<string, unknown> = {
          id: val,
          branch_id: BRANCH_MAIN,
          full_name: "Staff Member",
          is_active: true,
        };
        if (val === THERAPIST_NORTH) {
          staffData = {
            id: THERAPIST_NORTH,
            branch_id: BRANCH_NORTH,
            full_name: "North Staff",
            is_active: true,
          };
        } else if (val === THERAPIST_INACTIVE) {
          staffData = {
            id: THERAPIST_INACTIVE,
            branch_id: BRANCH_MAIN,
            full_name: "Inactive Staff",
            is_active: false,
          };
        }
        return {
          maybeSingle: vi.fn().mockResolvedValue({ data: staffData, error: null }),
        };
      }),
    }),
  };
}

describe("rescheduleBooking — Service-Level Combined Authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. schedule-only change keeps existing therapist validation", async () => {
    const booking = makeBooking({ staff_id: THERAPIST_CURRENT });
    const updateMock = makeUpdateChain([{ id: BOOKING_ID }]);

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain(booking)),
          update: updateMock,
        };
      }
      if (table === "staff") {
        return setupDefaultStaffTable();
      }
      if (table === "services") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain({ duration_minutes: 60 })),
        };
      }
      if (table === "booking_events") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockedBuildRec.mockResolvedValueOnce({} as never);
    mockedScore.mockReturnValueOnce([
      { staffId: THERAPIST_CURRENT, status: "unavailable", warnings: ["Therapist on break"] },
    ] as never);

    const res = await rescheduleBooking(makeCtx(), {
      bookingId: BOOKING_ID,
      date: "2026-09-20",
      startTime: "14:00",
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Therapist on break");
  });

  it("2. replacement therapist is validated against PROPOSED schedule, not old schedule", async () => {
    const booking = makeBooking();
    const updateMock = makeUpdateChain([{ id: BOOKING_ID }]);

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain(booking)),
          update: updateMock,
        };
      }
      if (table === "staff") {
        return setupDefaultStaffTable();
      }
      if (table === "services") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain({ duration_minutes: 60 })),
        };
      }
      if (table === "booking_events") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockedBuildRec.mockResolvedValueOnce({} as never);
    mockedScore.mockReturnValueOnce([
      { staffId: THERAPIST_NEW, status: "available", warnings: [] },
    ] as never);

    const res = await rescheduleBooking(makeCtx(), {
      bookingId: BOOKING_ID,
      date: "2026-09-20",
      startTime: "14:00",
      therapistId: THERAPIST_NEW,
    });

    expect(res.success).toBe(true);
    expect(mockedBuildRec).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.objectContaining({
        booking_date: "2026-09-20",
        start_time: "14:00:00",
        end_time: "15:00:00",
      }),
      expect.anything()
    );
  });

  it("3. old therapist being unavailable at proposed time does NOT reject when a valid replacement therapist is supplied", async () => {
    const booking = makeBooking({ staff_id: THERAPIST_OLD });
    const updateMock = makeUpdateChain([{ id: BOOKING_ID }]);

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain(booking)),
          update: updateMock,
        };
      }
      if (table === "staff") {
        return setupDefaultStaffTable();
      }
      if (table === "services") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain({ duration_minutes: 60 })),
        };
      }
      if (table === "booking_events") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockedBuildRec.mockResolvedValueOnce({} as never);
    // Old therapist is unavailable, but new therapist is available
    mockedScore.mockReturnValueOnce([
      { staffId: THERAPIST_OLD, status: "unavailable", warnings: ["Booked"] },
      { staffId: THERAPIST_NEW, status: "available", warnings: [] },
    ] as never);

    const res = await rescheduleBooking(makeCtx(), {
      bookingId: BOOKING_ID,
      date: "2026-09-20",
      startTime: "14:00",
      therapistId: THERAPIST_NEW,
    });

    expect(res.success).toBe(true);
  });

  it("4. proposed therapist wrong branch -> rejected", async () => {
    const booking = makeBooking({ branch_id: BRANCH_MAIN });

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain(booking)),
        };
      }
      if (table === "staff") {
        return setupDefaultStaffTable();
      }
      if (table === "services") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain({ duration_minutes: 60 })),
        };
      }
      return {};
    });

    mockedBuildRec.mockResolvedValueOnce({} as never);
    mockedScore.mockReturnValueOnce([] as never);

    const res = await rescheduleBooking(makeCtx(), {
      bookingId: BOOKING_ID,
      date: "2026-09-20",
      startTime: "14:00",
      therapistId: THERAPIST_NORTH,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Selected therapist is not available for this branch.");
  });

  it("5. proposed therapist inactive -> rejected", async () => {
    const booking = makeBooking({ branch_id: BRANCH_MAIN });

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain(booking)),
        };
      }
      if (table === "staff") {
        return setupDefaultStaffTable();
      }
      if (table === "services") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain({ duration_minutes: 60 })),
        };
      }
      return {};
    });

    mockedBuildRec.mockResolvedValueOnce({} as never);
    mockedScore.mockReturnValueOnce([] as never);

    const res = await rescheduleBooking(makeCtx(), {
      bookingId: BOOKING_ID,
      date: "2026-09-20",
      startTime: "14:00",
      therapistId: THERAPIST_INACTIVE,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Selected therapist is not available for this branch.");
  });

  it("6. proposed therapist unqualified -> rejected", async () => {
    const booking = makeBooking({ branch_id: BRANCH_MAIN });

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain(booking)),
        };
      }
      if (table === "staff") {
        return setupDefaultStaffTable();
      }
      if (table === "services") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain({ duration_minutes: 60 })),
        };
      }
      return {};
    });

    mockedBuildRec.mockResolvedValueOnce({} as never);
    // Unqualified therapist not in scored list
    mockedScore.mockReturnValueOnce([] as never);

    const res = await rescheduleBooking(makeCtx(), {
      bookingId: BOOKING_ID,
      date: "2026-09-20",
      startTime: "14:00",
      therapistId: THERAPIST_UNQUALIFIED,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Selected therapist is not qualified for this service.");
  });

  it("7. proposed therapist unavailable -> rejected", async () => {
    const booking = makeBooking({ branch_id: BRANCH_MAIN });

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain(booking)),
        };
      }
      if (table === "staff") {
        return setupDefaultStaffTable();
      }
      if (table === "services") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain({ duration_minutes: 60 })),
        };
      }
      return {};
    });

    mockedBuildRec.mockResolvedValueOnce({} as never);
    mockedScore.mockReturnValueOnce([
      { staffId: THERAPIST_BUSY, status: "unavailable", warnings: ["Therapist on leave"] },
    ] as never);

    const res = await rescheduleBooking(makeCtx(), {
      bookingId: BOOKING_ID,
      date: "2026-09-20",
      startTime: "14:00",
      therapistId: THERAPIST_BUSY,
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe("Therapist on leave");
  });

  it("8-16. combined reschedule & reassignment side effects and audit verification", async () => {
    const openException = {
      version: 1,
      status: "open",
      reason_code: "selected_staff_on_leave",
      reason_label: "Selected staff leave",
      selected_staff_id: THERAPIST_OLD,
      selected_staff_name: "Old Therapist",
      customer_name: "Customer One",
      branch_id: BRANCH_MAIN,
      booking_date: "2026-09-15",
      start_time: "10:00:00",
      end_time: "11:00:00",
      created_at: "2026-09-15T00:00:00.000Z",
    };
    const booking = makeBooking({
      staff_id: THERAPIST_OLD,
      delivery_type: "home_service",
      type: "home_service",
      driver_id: DRIVER_ID,
      metadata: {
        staff_schedule_exception: openException,
      },
    });

    const updateCapture: { payload?: Record<string, unknown> } = {};
    const updateMock = makeUpdateChain(
      [
        {
          id: BOOKING_ID,
          branch_id: BRANCH_MAIN,
          booking_date: "2026-09-20",
          start_time: "14:00:00",
        },
      ],
      (payload) => {
        updateCapture.payload = payload;
      }
    );

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "bookings") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain(booking)),
          update: updateMock,
        };
      }
      if (table === "staff") {
        return setupDefaultStaffTable();
      }
      if (table === "services") {
        return {
          select: vi.fn().mockReturnValue(makeSelectChain({ duration_minutes: 60 })),
        };
      }
      if (table === "booking_events") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    mockedBuildRec.mockResolvedValueOnce({} as never);
    mockedScore.mockReturnValueOnce([
      { staffId: THERAPIST_NEW, status: "available", warnings: [] },
    ] as never);

    const res = await rescheduleBooking(makeCtx(), {
      bookingId: BOOKING_ID,
      date: "2026-09-20",
      startTime: "14:00",
      therapistId: THERAPIST_NEW,
      overrideReason: "workload_balance",
    });

    expect(res.success).toBe(true);

    // 8. ONE bookings update containing booking_date, start_time, end_time, staff_id, metadata
    expect(updateCapture.payload).toMatchObject({
      booking_date: "2026-09-20",
      start_time: "14:00:00",
      end_time: "15:00:00",
      staff_id: THERAPIST_NEW,
    });
    expect(updateCapture.payload?.metadata).toBeDefined();

    // 9. Previous therapist receives canonical reassignment consequence (booking_reassigned)
    expect(mockedCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientStaffId: THERAPIST_OLD,
        type: "booking_reassigned",
      })
    );

    // 10. Stale assignment notifications resolved
    expect(mockedResolveNotifications).toHaveBeenCalledWith(
      "booking",
      BOOKING_ID,
      "staff",
      "booking_assigned"
    );
    expect(mockedResolveNotifications).toHaveBeenCalledWith(
      "booking",
      BOOKING_ID,
      "staff",
      "home_service_assigned"
    );

    // 11 & 12. New therapist receives home_service_assigned for Home Service
    expect(mockedCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientStaffId: THERAPIST_NEW,
        type: "home_service_assigned",
      })
    );

    // 13. Paid Home Service driver reschedule notification preserved
    expect(mockedCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientStaffId: DRIVER_ID,
        targetWorkspace: "driver",
        type: "booking_rescheduled",
      })
    );

    // 14. Staff schedule exception resolved for reassigned_staff
    const meta = updateCapture.payload?.metadata as {
      staff_schedule_exception?: {
        resolution?: string;
        previous_staff_id?: string;
        new_staff_id?: string;
      };
    };
    expect(meta?.staff_schedule_exception?.resolution).toBe("reassigned_staff");
    expect(meta?.staff_schedule_exception?.previous_staff_id).toBe(THERAPIST_OLD);
    expect(meta?.staff_schedule_exception?.new_staff_id).toBe(THERAPIST_NEW);
    expect(mockedResolveSignals).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: BOOKING_ID,
        staffId: THERAPIST_OLD,
        reasonCode: "selected_staff_on_leave",
      })
    );

    // 16. No contradictory duplicate notifications: therapist-new only receives home_service_assigned, not booking_rescheduled
    const newTherapistNotifs = mockedCreateNotification.mock.calls.filter(
      (call) => call[0].recipientStaffId === THERAPIST_NEW
    );
    expect(newTherapistNotifs.length).toBe(1);
    expect(newTherapistNotifs[0]?.[0]?.type).toBe("home_service_assigned");
  });
});
