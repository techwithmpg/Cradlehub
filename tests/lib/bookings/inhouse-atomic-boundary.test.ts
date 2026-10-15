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
  allocateResourcesForAttendees: vi.fn().mockResolvedValue([
    "55555555-5555-4555-8555-555555555555",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ]),
}));
vi.mock("@/lib/engine/availability", () => ({
  assignTherapistsForOrder: vi.fn().mockImplementation(async ({ attendees }: { attendees: Array<{ id: string }> }) =>
    attendees.map((attendee, index) => ({ attendeeId: attendee.id, staffId: index === 0
      ? "44444444-4444-4444-8444-444444444444"
      : "99999999-9999-4999-8999-999999999999" }))),
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
import { allocateResourcesForAttendees } from "@/lib/engine/resource-availability";
import { assignTherapistsForOrder } from "@/lib/engine/availability";
import { SlotUnavailableError } from "@/types/errors";

const branchId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const serviceId = "33333333-3333-4333-8333-333333333333";
const serviceB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const serviceC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const attendeeOne = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const attendeeTwo = "ffffffff-ffff-4fff-8fff-ffffffffffff";
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
const group = {
  ...base, bookingFor: "me_and_others", serviceIds: [serviceId, serviceB, serviceC],
  attendees: [
    { id: attendeeOne, name: "Test Customer", isOrganizer: true, serviceIds: [serviceId, serviceB] },
    { id: attendeeTwo, name: "Anna Guest", isOrganizer: false, serviceIds: [serviceC] },
  ],
};

let replayOrder: Record<string, unknown> | null = null;
let replayAttendees: Array<Record<string, unknown>> = [];
let replayBookings: Array<Record<string, unknown>> = [];
let serviceBBufferAfter = 0;
function adminClient() {
  return {
    from(table: string) {
      const data = table === "services"
        ? [{
            id: serviceId, name: "Massage", price: 500, duration_minutes: 60,
            buffer_before: 0, buffer_after: 0, service_categories: null,
          }, { id: serviceB, name: "Foot Massage", price: 200, duration_minutes: 30,
            buffer_before: 0, buffer_after: serviceBBufferAfter, service_categories: null },
          { id: serviceC, name: "Facial", price: 700, duration_minutes: 90,
            buffer_before: 0, buffer_after: 0, service_categories: null }]
        : table === "branch_services"
          ? [{ service_id: serviceId, custom_price: 500, custom_duration_minutes: null },
            { service_id: serviceB, custom_price: 200, custom_duration_minutes: null },
            { service_id: serviceC, custom_price: 700, custom_duration_minutes: null }]
          : table === "customers" ? [{ id: customerId }]
          : table === "booking_orders" ? (replayOrder ? [replayOrder] : [])
          : table === "booking_attendees" ? replayAttendees
          : table === "bookings" ? replayBookings : [];
      let selectedIds: unknown[] | null = null;
      const selected = () => selectedIds ? data.filter((row) => selectedIds!.includes(table === "branch_services" ? row.service_id : row.id)) : data;
      const query = {
        select: () => query,
        in: (_column: string, values: unknown[]) => { selectedIds = values; return query; },
        eq: () => query,
        maybeSingle: async () => ({ data: selected()[0] ?? null, error: null }),
        then: (resolve: (value: { data: typeof data; error: null }) => unknown) =>
          Promise.resolve({ data: selected(), error: null }).then(resolve),
      };
      return query;
    },
    rpc,
  };
}

describe("in-house server to atomic database boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replayOrder = null;
    replayAttendees = [];
    replayBookings = [];
    serviceBBufferAfter = 0;
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

  it("creates one order for concurrent guests with attendee-local sequences and distinct assignments", async () => {
    rpc.mockResolvedValueOnce({ data: {
      order_id: "order-1", order_number: "CRD-1", attendee_ids: ["att-1", "att-2"],
      service_line_ids: ["line-1", "line-2", "line-3"], idempotency_status: "created",
    }, error: null });
    const result = await executeInhouseBookingCreation(group, operator);
    expect(result).toMatchObject({ ok: true, orderId: "order-1", serviceCount: 3, attendeeCount: 2,
      serviceLineIds: ["line-1", "line-2", "line-3"] });
    expect(assignTherapistsForOrder).toHaveBeenCalledOnce();
    expect(allocateResourcesForAttendees).toHaveBeenCalledWith(expect.objectContaining({ windows: [
      { startTime: "10:00:00", endTime: "11:30:00" },
      { startTime: "10:00:00", endTime: "11:30:00" },
    ] }));
    expect(rpc).toHaveBeenCalledOnce();
    const args = rpc.mock.calls[0]?.[1];
    expect(args.p_attendees).toEqual([
      { sequence: 1, display_name: "Test Customer", customer_id: customerId },
      { sequence: 2, display_name: "Anna Guest", customer_id: null },
    ]);
    expect(args.p_service_lines.map((line: Record<string, unknown>) => [
      line.attendee_sequence, line.line_sequence, line.start_time, line.end_time,
      line.staff_id, line.resource_id,
    ])).toEqual([
      [1, 1, "10:00:00", "11:00:00", "44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"],
      [1, 2, "11:00:00", "11:30:00", "44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"],
      [2, 1, "10:00:00", "11:30:00", "99999999-9999-4999-8999-999999999999", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ]);
    expect(args.p_order.metadata).toMatchObject({ total_amount: 1400, total_duration_minutes: 90,
      total_attendees: 2, total_services: 3 });
  });

  it("creates two attendee rows and two concurrent service rows for one service each", async () => {
    rpc.mockResolvedValueOnce({ data: { order_id: "order-2", order_number: "CRD-2",
      attendee_ids: ["att-1", "att-2"], service_line_ids: ["line-1", "line-2"] }, error: null });
    const input = { ...group, serviceIds: [serviceId, serviceC], attendees: [
      { ...group.attendees[0], serviceIds: [serviceId] }, group.attendees[1],
    ] };
    const result = await executeInhouseBookingCreation(input, operator);
    expect(result).toMatchObject({ ok: true, orderId: "order-2", attendeeCount: 2, serviceCount: 2 });
    const args = rpc.mock.calls[0]?.[1];
    expect(args.p_attendees).toHaveLength(2);
    expect(args.p_service_lines).toHaveLength(2);
    expect(args.p_service_lines[0].start_time).toBe(args.p_service_lines[1].start_time);
    expect(args.p_service_lines[0].staff_id).not.toBe(args.p_service_lines[1].staff_id);
  });

  it("includes service buffers in each attendee chain and takes the longest elapsed range", async () => {
    serviceBBufferAfter = 5;
    rpc.mockResolvedValueOnce({ data: { service_line_ids: ["line-1", "line-2", "line-3"] }, error: null });
    expect((await executeInhouseBookingCreation(group, operator)).ok).toBe(true);
    const args = rpc.mock.calls[0]?.[1];
    expect(args.p_service_lines.map((line: { end_time: string }) => line.end_time))
      .toEqual(["11:00:00", "11:35:00", "11:30:00"]);
    expect(args.p_order.metadata.total_duration_minutes).toBe(95);
  });

  it("enforces CRM branch authority for group creation before any database write", async () => {
    const otherBranch = "abababab-abab-4bab-8bab-abababababab";
    expect(await executeInhouseBookingCreation({ ...group, branchId: otherBranch }, operator))
      .toMatchObject({ ok: false, code: "CRM_BRANCH_FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails before persistence when concurrent rooms are insufficient", async () => {
    vi.mocked(allocateResourcesForAttendees).mockResolvedValueOnce(null);
    expect(await executeInhouseBookingCreation(group, operator)).toMatchObject({ ok: false, code: "RESOURCE_UNAVAILABLE" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails before persistence when distinct qualified therapists cannot be assigned", async () => {
    vi.mocked(assignTherapistsForOrder).mockRejectedValueOnce(new SlotUnavailableError());
    expect(await executeInhouseBookingCreation(group, operator))
      .toMatchObject({ ok: false, code: "SLOT_UNAVAILABLE" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses one atomic call for a paid group and surfaces payment rejection", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "PAYMENT_DELTA_MISMATCH" } });
    const result = await executeInhouseBookingCreation({ ...group,
      paymentReceived: true, paymentMethod: "cash",
    }, operator);
    expect(result).toMatchObject({ ok: false, code: "PAYMENT_DELTA_MISMATCH" });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0]?.[1].p_order.metadata.total_amount).toBe(1400);
  });

  it("returns the existing group order on an identical retry without creating new rows", async () => {
    await executeInhouseBookingCreation(group, operator);
    const hash = rpc.mock.calls[0]?.[1].p_order.metadata.crm_input_hash;
    rpc.mockClear();
    replayOrder = { id: "existing-order", order_number: "CRD-EXISTING", metadata: { crm_input_hash: hash } };
    replayAttendees = [{ id: "att-1", sequence: 1 }, { id: "att-2", sequence: 2 }];
    replayBookings = [
      { id: "line-3", attendee_id: "att-2", line_sequence: 1 },
      { id: "line-2", attendee_id: "att-1", line_sequence: 2 },
      { id: "line-1", attendee_id: "att-1", line_sequence: 1 },
    ];
    expect(await executeInhouseBookingCreation(group, operator)).toMatchObject({ ok: true,
      orderId: "existing-order", serviceLineIds: ["line-1", "line-2", "line-3"] });
    expect(rpc).not.toHaveBeenCalled();
    expect(await executeInhouseBookingCreation({ ...group, notes: "different" }, operator))
      .toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" });
  });
});
