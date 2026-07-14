import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  createNotification: vi.fn(),
  resolveNotificationsForEntity: vi.fn(),
  logError: vi.fn(),
  revalidateOperationalBookingSurfaces: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => false,
  getDevBypassLayoutStaff: vi.fn(),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: mocks.createNotification,
  resolveNotificationsForEntity: mocks.resolveNotificationsForEntity,
}));
vi.mock("@/lib/notifications/notification-targets", () => ({
  getNotificationTargetPath: () => "/staff-portal",
}));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: mocks.revalidateOperationalBookingSurfaces,
}));
vi.mock("@/lib/bookings/payment-transaction", () => ({
  recordBookingPaymentChange: vi.fn(),
}));
vi.mock("@/lib/bookings/staff-schedule-exception-signals", () => ({
  resolveStaffScheduleExceptionSignals: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
  logBusinessEvent: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  markBookingConfirmedAction,
  recordBookingFollowupAction,
} from "@/app/(dashboard)/crm/bookings/actions";

const BOOKING_ID = "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d";
const BRANCH_ID = "20a30d2a-2899-48c8-b643-c12ce26715f1";
const OTHER_BRANCH_ID = "e9f18631-858d-44e5-9985-ddd7e31f3e31";
const STAFF_ID = "3e7a6a0a-6cf1-4621-97ce-f7a63fde00f2";
const AUTH_USER_ID = "ac927cb1-8687-4da6-a4ac-9c3d58f42d80";

type QueryResult = { data: unknown; error: unknown };

function queryBuilder({
  maybeSingle = { data: null, error: null },
  awaited = { data: null, error: null },
}: {
  maybeSingle?: QueryResult;
  awaited?: QueryResult;
} = {}) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "neq", "not", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.select = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => maybeSingle);
  builder.single = vi.fn(async () => maybeSingle);
  builder.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(awaited).then(onFulfilled, onRejected);
  return builder as {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    [key: string]: unknown;
  };
}

type SetupOptions = {
  baseData?: Record<string, unknown> | null;
  baseError?: unknown;
  details?: Record<string, unknown> | null;
  diagnostic?: Record<string, unknown> | null;
  updateError?: unknown;
};

function setup(options: SetupOptions = {}) {
  const baseData = options.baseData === undefined
    ? { id: BOOKING_ID, branch_id: BRANCH_ID, status: "pending", booking_progress_status: "not_started", customer_id: null }
    : options.baseData;
  const details = options.details === undefined
    ? {
        id: BOOKING_ID,
        branch_id: BRANCH_ID,
        customer_id: null,
        service_id: null,
        booking_date: "2026-07-14",
        start_time: "10:00:00",
        end_time: "11:00:00",
        type: "online",
        delivery_type: "in_spa",
        staff_id: STAFF_ID,
        driver_id: null,
        status: "pending",
        booking_progress_status: "not_started",
        checked_in_at: null,
        session_started_at: null,
        resource_id: null,
        metadata: {},
      }
    : options.details;

  const staffQuery = queryBuilder({
    maybeSingle: {
      data: { id: STAFF_ID, branch_id: BRANCH_ID, system_role: "crm" },
      error: null,
    },
  });
  const baseQuery = queryBuilder({
    maybeSingle: { data: baseData, error: options.baseError ?? null },
  });
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: AUTH_USER_ID } } })) },
    from: vi.fn((table: string) => table === "staff" ? staffQuery : baseQuery),
  };

  const detailsQuery = queryBuilder({ maybeSingle: { data: details, error: null } });
  const diagnosticQuery = queryBuilder({
    maybeSingle: { data: options.diagnostic ?? null, error: null },
  });
  const updateQuery = queryBuilder({
    awaited: options.updateError
      ? { data: null, error: options.updateError }
      : { data: [{ id: BOOKING_ID }], error: null },
  });
  const eventQuery = queryBuilder({ maybeSingle: { data: null, error: null } });
  let bookingCalls = 0;
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "booking_events") return eventQuery;
      if (table !== "bookings") return queryBuilder();
      bookingCalls += 1;
      if (!baseData) return diagnosticQuery;
      if (bookingCalls === 1) return detailsQuery;
      return updateQuery;
    }),
  };

  mocks.createClient.mockResolvedValue(client);
  mocks.createAdminClient.mockReturnValue(admin);
  return { baseQuery, detailsQuery, diagnosticQuery, updateQuery, eventQuery, client, admin };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNotification.mockResolvedValue(undefined);
  mocks.resolveNotificationsForEntity.mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("CRM booking action identifier and lookup boundary", () => {
  it("rejects undefined and malformed booking identifiers before querying", async () => {
    expect(await markBookingConfirmedAction({ bookingId: undefined })).toEqual({
      success: false,
      error: "Invalid booking identifier.",
    });
    expect(await markBookingConfirmedAction({ bookingId: "BOOK-1042" })).toEqual({
      success: false,
      error: "Invalid booking identifier.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("starts with the real UUID and a base-only booking select", async () => {
    const { baseQuery, updateQuery } = setup();
    const result = await markBookingConfirmedAction({ bookingId: BOOKING_ID });

    expect(result).toEqual({ success: true });
    expect(baseQuery.select).toHaveBeenCalledWith(
      "id, branch_id, status, booking_progress_status, customer_id"
    );
    expect(baseQuery.eq).toHaveBeenCalledWith("id", BOOKING_ID);
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: "confirmed" }));
  });

  it("returns a branch-access error instead of Booking not found", async () => {
    setup({ baseData: null, diagnostic: { id: BOOKING_ID, branch_id: OTHER_BRANCH_ID } });
    const result = await markBookingConfirmedAction({ bookingId: BOOKING_ID });

    expect(result).toEqual({
      success: false,
      code: "booking_wrong_branch",
      error: "Booking belongs to another branch.",
    });
    expect(result.error).not.toContain("not found");
  });

  it("distinguishes RLS permission denial, missing rows, and database failures", async () => {
    setup({ baseData: null, diagnostic: { id: BOOKING_ID, branch_id: BRANCH_ID } });
    expect(await markBookingConfirmedAction({ bookingId: BOOKING_ID })).toEqual({
      success: false,
      code: "booking_permission_denied",
      error: "You do not have permission to access this booking.",
    });

    vi.clearAllMocks();
    setup({ baseData: null, diagnostic: null });
    expect(await markBookingConfirmedAction({ bookingId: BOOKING_ID })).toEqual({
      success: false,
      code: "booking_missing",
      error: "Booking does not exist.",
    });

    vi.clearAllMocks();
    setup({ baseError: { code: "PGRST500", message: "database unavailable" } });
    expect(await markBookingConfirmedAction({ bookingId: BOOKING_ID })).toEqual({
      success: false,
      code: "booking_load_failed",
      error: "Booking could not be loaded. Please try again.",
    });
  });
});

describe("CRM direct follow-up and cancellation actions", () => {
  it("records no-answer metadata with actor and timestamp without changing status", async () => {
    const { updateQuery, eventQuery } = setup();
    const result = await recordBookingFollowupAction({ bookingId: BOOKING_ID, result: "no_answer" });

    expect(result).toEqual({ success: true });
    const update = updateQuery.update.mock.calls[0]?.[0] as {
      status: string;
      metadata: { crm_followup: { result: string; updated_at: string; updated_by: string } };
    };
    expect(update.status).toBe("pending");
    expect(update.metadata.crm_followup.result).toBe("no_answer");
    expect(update.metadata.crm_followup.updated_by).toBe(STAFF_ID);
    expect(Number.isNaN(Date.parse(update.metadata.crm_followup.updated_at))).toBe(false);
    expect(eventQuery.insert).toHaveBeenCalled();
  });

  it("keeps confirm-later in the existing pending state", async () => {
    const { updateQuery } = setup();
    const result = await recordBookingFollowupAction({ bookingId: BOOKING_ID, result: "confirm_later" });

    expect(result).toEqual({ success: true });
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
  });

  it("blocks already-cancelled and completed bookings", async () => {
    setup({
      baseData: { id: BOOKING_ID, branch_id: BRANCH_ID, status: "cancelled", booking_progress_status: "not_started", customer_id: null },
      details: {
        id: BOOKING_ID, branch_id: BRANCH_ID, customer_id: null, service_id: null,
        booking_date: "2026-07-14", start_time: "10:00:00", end_time: "11:00:00",
        type: "online", delivery_type: "in_spa", staff_id: null, driver_id: null,
        status: "cancelled", booking_progress_status: "not_started", checked_in_at: null,
        session_started_at: null, resource_id: null, metadata: {},
      },
    });
    expect(await recordBookingFollowupAction({ bookingId: BOOKING_ID, result: "cancel", note: "Legacy reason" })).toEqual({
      success: false,
      error: "Booking is already cancelled.",
    });

    vi.clearAllMocks();
    setup({
      baseData: { id: BOOKING_ID, branch_id: BRANCH_ID, status: "completed", booking_progress_status: "completed", customer_id: null },
      details: {
        id: BOOKING_ID, branch_id: BRANCH_ID, customer_id: null, service_id: null,
        booking_date: "2026-07-14", start_time: "10:00:00", end_time: "11:00:00",
        type: "online", delivery_type: "in_spa", staff_id: null, driver_id: null,
        status: "completed", booking_progress_status: "completed", checked_in_at: null,
        session_started_at: null, resource_id: null, metadata: {},
      },
    });
    expect(await recordBookingFollowupAction({ bookingId: BOOKING_ID, result: "cancel", note: "Legacy reason" })).toEqual({
      success: false,
      error: "Completed bookings cannot be cancelled.",
    });
  });

  it("returns specific wrong-branch and missing-booking cancellation errors", async () => {
    setup({ baseData: null, diagnostic: { id: BOOKING_ID, branch_id: OTHER_BRANCH_ID } });
    expect(await recordBookingFollowupAction({ bookingId: BOOKING_ID, result: "cancel", note: "Legacy reason" })).toEqual({
      success: false,
      code: "booking_wrong_branch",
      error: "Booking belongs to another branch.",
    });

    vi.clearAllMocks();
    setup({ baseData: null, diagnostic: null });
    expect(await recordBookingFollowupAction({ bookingId: BOOKING_ID, result: "cancel", note: "Legacy reason" })).toEqual({
      success: false,
      code: "booking_missing",
      error: "Booking does not exist.",
    });
  });

  it("records a structured cancellation reason, note, event, and staff notification", async () => {
    const { updateQuery } = setup();
    const result = await recordBookingFollowupAction({
      bookingId: BOOKING_ID,
      result: "cancel",
      cancellationReason: "scheduling_conflict",
      note: "Customer requested another date.",
    });

    expect(result).toEqual({ success: true });
    const update = updateQuery.update.mock.calls[0]?.[0] as {
      status: string;
      metadata: { cancellation: { reason: string; note: string; cancelled_by: string } };
    };
    expect(update.status).toBe("cancelled");
    expect(update.metadata.cancellation).toEqual(expect.objectContaining({
      reason: "Scheduling conflict",
      note: "Customer requested another date.",
      cancelled_by: STAFF_ID,
    }));
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      entityId: BOOKING_ID,
      recipientStaffId: STAFF_ID,
      type: "booking_cancelled",
    }));
  });

  it("returns update failures without misreporting the booking as missing", async () => {
    setup({ updateError: { code: "23514", message: "constraint failed" } });
    const result = await recordBookingFollowupAction({ bookingId: BOOKING_ID, result: "no_answer" });

    expect(result).toEqual({ success: false, error: "Booking update failed. Please try again." });
    expect(result.error).not.toContain("not found");
  });
});
