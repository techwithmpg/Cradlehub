import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, createAdmin } = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdmin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdmin }));
vi.mock("@/lib/queries/branch-booking-rules", () => ({
  validateBookingAgainstBranchRules: vi.fn().mockResolvedValue({
    ok: true, rules: { travelBufferMins: 0 },
  }),
  getBranchBookingRulesOrDefault: vi.fn().mockResolvedValue({
    homeServiceDriverCapacity: 1,
  }),
}));
vi.mock("@/lib/services/service-catalog", () => ({
  validateBranchServiceEligibility: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/lib/bookings/consultation-only-service", () => ({
  isConsultationOnlyService: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/engine/exact-crm-booking-time", () => ({
  resolveExactCrmBookingTime: vi.fn().mockResolvedValue({
    available: true,
    providers: [{
      staffId: "44444444-4444-4444-8444-444444444444",
      selectable: true,
      scheduleStartTime: "09:00:00", scheduleEndTime: "18:00:00",
      serviceEndTime: "11:00:00", operationalStartTime: "10:00:00",
      operationalEndTime: "11:00:00", overtimeMinutes: 0,
      operationalOvertimeMinutes: 0, operationalStartsBeforeShift: false,
    }],
  }),
}));
vi.mock("@/lib/engine/resource-availability", () => ({
  autoAssignBookingResource: vi.fn().mockResolvedValue(
    "55555555-5555-4555-8555-555555555555"
  ),
  isResourceAvailable: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/home-service/distance-service", () => ({
  calculateHomeServiceDistanceQuote: vi.fn().mockResolvedValue({
    ok: true,
    quote: {
      distanceKm: 3, distanceSource: "google", travelFee: 50,
      freeKm: 2, extraKm: 1, feePerExtraKm: 50,
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

const branchId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const serviceId = "33333333-3333-4333-8333-333333333333";
const operator = {
  authUserId: "66666666-6666-4666-8666-666666666666",
  staff: { id: "77777777-7777-4777-8777-777777777777", branch_id: branchId, system_role: "crm" },
  staffRole: "crm",
  isDevBypass: false,
};
const base = {
  idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  branchId, customerId, serviceIds: [serviceId],
  date: "2026-09-29", startTime: "10:00", type: "walkin",
  fullName: "Test Customer", phone: "09171234567",
};

function adminClient() {
  return {
    from(table: string) {
      const data = table === "services"
        ? [{
            id: serviceId, name: "Massage", price: 500, duration_minutes: 60,
            buffer_before: 0, buffer_after: 0, service_categories: null,
          }]
        : table === "branch_services"
          ? [{ service_id: serviceId, custom_price: 500, custom_duration_minutes: null }]
          : table === "customers" ? [{ id: customerId }] : [];
      const query = {
        select: () => query,
        in: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
        then: (resolve: (value: { data: typeof data; error: null }) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      };
      return query;
    },
    rpc,
  };
}

describe("in-house server to atomic database boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdmin.mockImplementation(adminClient);
    rpc.mockResolvedValue({
      data: {
        idempotency_status: "created",
        service_line_ids: ["88888888-8888-4888-8888-888888888888"],
      },
      error: null,
    });
  });

  it("creates an unpaid order with pay-on-site intent and no tender", async () => {
    const result = await executeInhouseBookingCreation(base, operator);
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "create_inhouse_order_with_payment_atomic",
      expect.objectContaining({
        p_options: expect.objectContaining({
          payment_received: false, payment_method: null, payments: null,
        }),
      })
    );
  });

  it("sends paid walk-in creation, price and rail through one RPC", async () => {
    const result = await executeInhouseBookingCreation({
      ...base, paymentReceived: true, paymentMethod: "cash",
    }, operator);
    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledOnce();
    const args = rpc.mock.calls[0]?.[1];
    expect(args.p_order.metadata.total_amount).toBe(500);
    expect(args.p_service_lines[0].metadata.price_paid).toBe(500);
    expect(args.p_options).toMatchObject({
      payment_received: true, payment_method: "cash",
    });
  });

  it("returns an ambiguous-account error without issuing a second write", async () => {
    rpc.mockResolvedValueOnce({
      data: null, error: { message: "ACCOUNT_SELECTION_REQUIRED: Select an account" },
    });
    const result = await executeInhouseBookingCreation({
      ...base, paymentReceived: true, paymentMethod: "gcash",
    }, operator);
    expect(result).toMatchObject({ ok: false, code: "ACCOUNT_SELECTION_REQUIRED" });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("keeps Home Service travel as an order-level fee in the atomic payload", async () => {
    const result = await executeInhouseBookingCreation({
      ...base,
      type: "home_service",
      deliveryType: "home_service",
      paymentReceived: true,
      paymentMethod: "cash",
      homeServiceAddress: "123 Test Street, Bacolod",
      homeServiceFormattedAddress: "123 Test Street, Bacolod",
      homeServicePlaceId: "test-place",
      homeServiceLat: 10.676,
      homeServiceLng: 122.95,
    }, operator);
    expect(result.ok).toBe(true);
    const args = rpc.mock.calls[0]?.[1];
    expect(args.p_order.metadata).toMatchObject({
      home_service_fee: 50, total_amount: 550,
    });
    expect(args.p_service_lines[0].metadata.price_paid).toBe(500);
    expect(args.p_options.payment_received).toBe(true);
  });

  it("preserves split tender amounts and selected accounts", async () => {
    const cashAccount = "99999999-9999-4999-8999-999999999999";
    const gcashAccount = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const result = await executeInhouseBookingCreation({
      ...base,
      paymentReceived: true,
      paymentMethod: "other",
      payments: [
        { amount: 200, paymentMethod: "cash", financialAccountId: cashAccount },
        { amount: 300, paymentMethod: "gcash", financialAccountId: gcashAccount },
      ],
    }, operator);
    expect(result.ok).toBe(true);
    expect(rpc.mock.calls[0]?.[1].p_options.payments).toEqual([
      { amount: 200, payment_method: "cash", financial_account_id: cashAccount, external_reference: null },
      { amount: 300, payment_method: "gcash", financial_account_id: gcashAccount, external_reference: null },
    ]);
  });
});
