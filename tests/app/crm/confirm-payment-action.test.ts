import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createNotification: vi.fn(),
  resolveNotificationsForEntity: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateOperationalBookingSurfaces: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => false,
  getDevBypassLayoutStaff: vi.fn(),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: mocks.createNotification,
  resolveNotificationsForEntity: mocks.resolveNotificationsForEntity,
}));
vi.mock("@/lib/notifications/notification-targets", () => ({
  getNotificationTargetPath: () => "/crm/bookings",
}));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: mocks.revalidateOperationalBookingSurfaces,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { confirmBookingPaymentAction } from "@/app/(dashboard)/crm/bookings/actions";

const BRANCH_ID = "20a30d2a-2899-48c8-b643-c12ce26715f1";
const STAFF_ID = "3e7a6a0a-6cf1-4621-97ce-f7a63fde00f2";
const AUTH_USER_ID = "ac927cb1-8687-4da6-a4ac-9c3d58f42d80";
const BOOKING_ID = "94c25f49-43a3-4889-be23-5e82490b4ad2";

type QueryResult = { data: unknown; error: unknown };

function queryBuilder(options: { maybeSingle?: QueryResult; single?: QueryResult } = {}) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "neq", "not", "order", "limit", "select"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.update = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => options.maybeSingle ?? { data: null, error: null });
  builder.single = vi.fn(async () => options.single ?? { data: null, error: null });
  return builder;
}

describe("Fix C: Booking Payment Finalization Safety", () => {
  let rpcMock: ReturnType<typeof vi.fn>;
  let bookingUpdateMock: ReturnType<typeof vi.fn>;

  function setupMocks(
    bookingOverrides: Record<string, unknown> = {},
    serviceOverrides: { price?: number } = {}
  ) {
    const bookingData = {
      id: BOOKING_ID,
      branch_id: BRANCH_ID,
      service_id: "service-uuid-1",
      metadata: { price_paid: 1500 },
      status: "pending",
      hold_expires_at: new Date(Date.now() + 600000).toISOString(),
      staff_id: STAFF_ID,
      driver_id: null,
      customer_id: "customer-uuid-1",
      booking_date: "2026-09-26",
      start_time: "10:00",
      end_time: "11:00",
      delivery_type: "in_spa",
      type: "regular",
      payment_method: "cash",
      payment_status: "pending",
      amount_paid: 0,
      payment_reference: null,
      ...bookingOverrides,
    };

    rpcMock = vi.fn(async () => ({
      data: [{ id: BOOKING_ID, branch_id: BRANCH_ID }],
      error: null,
    }));

    bookingUpdateMock = vi.fn(() => {
      const b: Record<string, unknown> = {};
      b.eq = vi.fn(() => b);
      b.then = (resolve: (val: unknown) => void) => resolve({ data: null, error: null });
      return b;
    });

    const staffQuery = queryBuilder({
      maybeSingle: {
        data: { id: STAFF_ID, branch_id: BRANCH_ID, system_role: "crm" },
        error: null,
      },
      single: {
        data: { id: STAFF_ID, branch_id: BRANCH_ID, system_role: "crm" },
        error: null,
      },
    });

    const bookingQuery = queryBuilder({
      maybeSingle: { data: bookingData, error: null },
      single: { data: bookingData, error: null },
    });

    const customerQuery = queryBuilder({
      maybeSingle: { data: { full_name: "Test Customer" }, error: null },
      single: { data: { full_name: "Test Customer" }, error: null },
    });

    const serviceQuery = queryBuilder({
      maybeSingle: { data: { price: serviceOverrides.price ?? 1200 }, error: null },
      single: { data: { price: serviceOverrides.price ?? 1200 }, error: null },
    });

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: AUTH_USER_ID } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "staff") return staffQuery;
        if (table === "customers") return customerQuery;
        if (table === "services") return serviceQuery;
        if (table === "bookings") {
          return {
            ...bookingQuery,
            update: bookingUpdateMock,
          };
        }
        return queryBuilder();
      }),
      rpc: rpcMock,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. frozen booking snapshot = ₱1,000 and current service price = ₱800 → payable remains ₱1,000", async () => {
    setupMocks(
      { metadata: { price_paid: 1000 }, amount_paid: 0 },
      { price: 800 } // Catalog price changed to 800
    );

    // Paying 800 satisfies catalog price but is SHORT of frozen snapshot (1000)
    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "cash",
      amountPaid: 800,
    });

    expect(result.success).toBe(true);
    // Must NOT be marked paid because payable is 1000, not 800
    expect(rpcMock).toHaveBeenCalledWith(
      "record_booking_payment_change",
      expect.objectContaining({
        p_booking_id: BOOKING_ID,
        p_payment_status: "pending",
        p_amount_paid: 800,
      })
    );
    expect(mocks.resolveNotificationsForEntity).not.toHaveBeenCalled();
  });

  it("2. frozen booking snapshot = ₱800 and current service price = ₱1,000 → payable remains ₱800", async () => {
    setupMocks(
      { metadata: { price_paid: 800 }, amount_paid: 0 },
      { price: 1000 } // Catalog price increased to 1000
    );

    // Paying 800 satisfies frozen snapshot (800) even though catalog is 1000
    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "cash",
      amountPaid: 800,
    });

    expect(result.success).toBe(true);
    // Must be marked paid because frozen snapshot is 800
    expect(rpcMock).toHaveBeenCalledWith(
      "record_booking_payment_change",
      expect.objectContaining({
        p_booking_id: BOOKING_ID,
        p_payment_status: "paid",
        p_amount_paid: 800,
      })
    );
    expect(mocks.resolveNotificationsForEntity).toHaveBeenCalledWith(
      "booking",
      BOOKING_ID,
      "crm",
      "payment_pending"
    );
  });

  it("3. missing frozen payable snapshot + current service price available → must NOT infer the current service price and mark paid", async () => {
    setupMocks(
      { metadata: null, amount_paid: 0 }, // No frozen snapshot
      { price: 1500 } // Catalog price exists in services table
    );

    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "cash",
      amountPaid: 1500,
    });

    // Must fail closed with clear error, NOT infer catalog price 1500 and mark paid
    expect(result.success).toBe(false);
    expect(result.error).toContain("historical payable price snapshot is missing");
    expect(result.error).toContain("Authorized review required");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("4. missing frozen payable snapshot → final paid transition fails closed with a clear error", async () => {
    setupMocks({
      metadata: {}, // Empty metadata, no frozen price
      amount_paid: 0,
    });

    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "cash",
      amountPaid: 1000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("historical payable price snapshot is missing");
    expect(result.error).toContain("Authorized review required");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("5. explicit frozen payable = ₱0 → complimentary booking may settle correctly", async () => {
    setupMocks({
      metadata: { price_paid: 0 },
      amount_paid: 0,
      payment_status: "unpaid",
    });

    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "other",
      amountPaid: 0,
      note: "Complimentary VIP service",
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "record_booking_payment_change",
      expect.objectContaining({
        p_booking_id: BOOKING_ID,
        p_payment_status: "paid",
        p_amount_paid: 0,
      })
    );
    expect(mocks.resolveNotificationsForEntity).toHaveBeenCalledWith(
      "booking",
      BOOKING_ID,
      "crm",
      "payment_pending"
    );
  });

  it("6. partial payment with known frozen payable remains permitted", async () => {
    setupMocks({
      metadata: { price_paid: 2000 },
      amount_paid: 0,
      status: "pending",
      payment_status: "pending",
    });

    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "gcash",
      amountPaid: 500, // 500 deposit
      paymentReference: "GCASH-DEP-123",
      note: "Initial 25% deposit",
    });

    expect(result.success).toBe(true);
    // Payment recorded as pending with amount 500, booking confirmed and hold cleared
    expect(rpcMock).toHaveBeenCalledWith(
      "record_booking_payment_change",
      expect.objectContaining({
        p_payment_method: "gcash",
        p_payment_status: "pending",
        p_amount_paid: 500,
        p_payment_reference: "GCASH-DEP-123",
        p_next_status: "confirmed",
        p_clear_hold: true,
      })
    );
    expect(mocks.resolveNotificationsForEntity).not.toHaveBeenCalled();
  });

  it("7. full payment with known frozen payable becomes paid", async () => {
    setupMocks({
      metadata: { price_paid: 1500 },
      amount_paid: 0,
      payment_status: "pending",
    });

    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "cash",
      amountPaid: 1500, // Full payment
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith(
      "record_booking_payment_change",
      expect.objectContaining({
        p_booking_id: BOOKING_ID,
        p_payment_status: "paid",
        p_amount_paid: 1500,
      })
    );
    expect(mocks.resolveNotificationsForEntity).toHaveBeenCalledWith(
      "booking",
      BOOKING_ID,
      "crm",
      "payment_pending"
    );
  });

  it("8. positive payable + zero amount cannot become paid", async () => {
    setupMocks({
      metadata: { price_paid: 1500 },
      amount_paid: 0,
    });

    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "cash",
      amountPaid: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("less than payable amount");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("9. positive payable + omitted amount without sufficient existing paid value cannot become paid", async () => {
    setupMocks({
      metadata: { price_paid: 1500 },
      amount_paid: 0,
    });

    const result = await confirmBookingPaymentAction({
      bookingId: BOOKING_ID,
      paymentMethod: "cash",
      // amountPaid omitted
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("less than payable amount");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
