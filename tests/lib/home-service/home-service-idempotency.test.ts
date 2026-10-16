import { describe, it, expect, beforeEach } from "vitest";
import {
  BookingOrderTransactionSimulator,
  buildAtomicBookingOrderPayload,
  type CreateBookingOrderAtomicInput,
} from "@/lib/bookings/bkg3-atomic-contract";
import { calculateHomeServiceTravelFeeBreakdown } from "@/lib/home-service/distance-fee";

describe("Home Service atomic booking idempotency regression", () => {
  let sim: BookingOrderTransactionSimulator;

  const BRANCH_ID = "11111111-1111-4111-8111-111111111111";
  const ORGANIZER_ID = "22222222-2222-4222-8222-222222222222";
  const SERVICE_ID = "33333333-3333-4333-8333-333333333331";
  const STAFF_ID = "44444444-4444-4444-8444-444444444441";
  const IDEMPOTENCY_KEY = "55555555-5555-4555-8555-555555555555";

  beforeEach(() => {
    sim = new BookingOrderTransactionSimulator();
    sim.registerBranch(BRANCH_ID);
    sim.registerCustomer(ORGANIZER_ID);
    sim.registerService(SERVICE_ID);
    sim.registerStaff(STAFF_ID);
  });

  function createHomeServiceOrderPayload(overrides?: {
    drivingDistanceKm?: number;
    baseFee?: number;
    includedKm?: number;
    perKmFee?: number;
    idempotencyKey?: string;
  }): CreateBookingOrderAtomicInput {
    const drivingDistanceKm = overrides?.drivingDistanceKm ?? 3.0;
    const baseFee = overrides?.baseFee ?? 100;
    const includedKm = overrides?.includedKm ?? 1.0;
    const perKmFee = overrides?.perKmFee ?? 40;

    const breakdown = calculateHomeServiceTravelFeeBreakdown({
      drivingDistanceKm,
      baseFee,
      includedKm,
      perKmFee,
    });

    const orderMetadata = {
      source: "public_online",
      home_service_fee: breakdown.finalFee, // 180
      home_service_transport: breakdown.snapshot,
      home_service_address: {
        address: "123 Lacson Street",
        city: "Bacolod",
        lat: 10.6765,
        lng: 122.951,
      },
    };

    return buildAtomicBookingOrderPayload({
      idempotencyKey: overrides?.idempotencyKey ?? IDEMPOTENCY_KEY,
      branchId: BRANCH_ID,
      organizerCustomerId: ORGANIZER_ID,
      deliveryType: "home_service",
      bookingDate: "2026-10-20",
      currency: "PHP",
      paymentPreference: "pay_at_spa",
      orderMetadata,
      attendees: [
        {
          sequence: 1,
          displayName: "Maria Santos",
          customerId: ORGANIZER_ID,
        },
      ],
      serviceLines: [
        {
          attendeeSequence: 1,
          lineSequence: 1,
          serviceId: SERVICE_ID,
          staffId: STAFF_ID,
          startTime: "14:00",
          endTime: "15:00",
          travelBufferMins: 30,
          metadata: {
            service_price: 1200,
            service_duration_minutes: 60,
          },
        },
      ],
    });
  }

  it("first attempt commits atomic order with exact commercial snapshot and single service line", async () => {
    const payload = createHomeServiceOrderPayload();
    const result = await sim.executeAtomic(payload);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.idempotency_status).toBe("created");
    expect(result.service_line_ids).toHaveLength(1);
    expect(result.attendee_ids).toHaveLength(1);

    const order = sim.getOrder(result.order_id);
    expect(order).toBeDefined();
    expect(order?.delivery_type).toBe("home_service");

    const transport = order?.metadata?.home_service_transport as Record<string, unknown>;
    expect(transport).toBeDefined();
    expect(transport.pricing_version).toBe(1);
    expect(transport.distance_source).toBe("google_routes");
    expect(transport.driving_distance_km).toBe(3.0);
    expect(transport.base_fee).toBe(100);
    expect(transport.included_km).toBe(1.0);
    expect(transport.per_km_fee).toBe(40);
    expect(transport.calculated_fee).toBe(180);

    const serviceLines = sim.getServiceLinesForOrder(result.order_id);
    expect(serviceLines).toHaveLength(1);
  });

  it("replaying the exact same idempotency key does not create a second transportation charge or duplicate line items", async () => {
    const payload = createHomeServiceOrderPayload();

    // 1st attempt: Initial creation
    const firstResult = await sim.executeAtomic(payload);
    expect(firstResult.ok).toBe(true);
    if (!firstResult.ok) return;
    expect(firstResult.idempotency_status).toBe("created");
    const orderId = firstResult.order_id;

    // Verify initial line items count
    const initialLines = sim.getServiceLinesForOrder(orderId);
    expect(initialLines).toHaveLength(1);

    // 2nd attempt: Replay with identical payload and key
    const replayResult = await sim.executeAtomic(payload);
    expect(replayResult.ok).toBe(true);
    if (!replayResult.ok) return;

    // Must be marked replayed and return exact same order_id and line IDs
    expect(replayResult.idempotency_status).toBe("replayed");
    expect(replayResult.order_id).toBe(orderId);
    expect(replayResult.service_line_ids).toEqual(firstResult.service_line_ids);
    expect(replayResult.attendee_ids).toEqual(firstResult.attendee_ids);

    // CRITICAL: Database service lines must NOT have increased (no second charge)
    const afterReplayLines = sim.getServiceLinesForOrder(orderId);
    expect(afterReplayLines).toHaveLength(1);
    expect(afterReplayLines[0]!.id).toBe(initialLines[0]!.id);

    // CRITICAL: Original snapshot must remain strictly intact
    const order = sim.getOrder(orderId);
    const transport = order?.metadata?.home_service_transport as Record<string, unknown>;
    expect(transport.calculated_fee).toBe(180);
    expect(transport.driving_distance_km).toBe(3.0);
  });

  it("replaying the same idempotency key with conflicting pricing or payload is rejected", async () => {
    const initialPayload = createHomeServiceOrderPayload({ drivingDistanceKm: 3.0 });
    const firstResult = await sim.executeAtomic(initialPayload);
    expect(firstResult.ok).toBe(true);

    // Attempt to tamper or replay with different distance / fee under the SAME idempotency key
    const conflictingPayload = createHomeServiceOrderPayload({ drivingDistanceKm: 5.0 });
    const conflictResult = await sim.executeAtomic(conflictingPayload);

    expect(conflictResult.ok).toBe(false);
    if (conflictResult.ok) return;
    expect(conflictResult.code).toBe("IDEMPOTENCY_CONFLICT");

    // Order state remains untouched at original 3.0 km / ₱180
    if (!firstResult.ok) return;
    const order = sim.getOrder(firstResult.order_id);
    const transport = order?.metadata?.home_service_transport as Record<string, unknown>;
    expect(transport.calculated_fee).toBe(180);
    expect(transport.driving_distance_km).toBe(3.0);
  });
});
