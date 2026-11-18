import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logInfo: vi.fn(), logError: vi.fn(), logWarn: vi.fn() }));
vi.mock("@/lib/driver/native-push", () => ({
  processDriverNativePush: vi.fn().mockResolvedValue({ processed: 0 }),
  preferredNativeDriverIds: vi.fn().mockResolvedValue(new Set()),
}));
const { createNotificationOnceMock } = vi.hoisted(() => ({
  createNotificationOnceMock: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotificationOnce: createNotificationOnceMock,
  createStaffNotification: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue(undefined),
  resolveNotificationsForEntity: vi.fn().mockResolvedValue(undefined),
}));

import {
  buildBookingUpdatesFromOptimizerResponse,
  buildDispatchOptimizerSnapshot,
  commitOptimizedDispatchPlan,
  computeSnapshotTravelMatrix,
  requestDispatchOptimizationPlan,
  validateProposedPlanAgainstDb,
  type OptimizerLocationNode,
} from "@/lib/dispatch/optimizer-bridge";
import { buildDriverTripPlans } from "@/lib/driver/trip-plans";
import type { DriverJourney } from "@/lib/driver/journey";

const BRANCH_ID = "10000000-0000-4000-8000-000000000001";
const DRV_A = "30000000-0000-4000-8000-000000000002";
const DRV_B = "30000000-0000-4000-8000-000000000003";
const TH_1 = "30000000-0000-4000-8000-000000000004";
const TH_2 = "30000000-0000-4000-8000-000000000005";
const B1 = "50000000-0000-4000-8000-000000000001";
const B2 = "50000000-0000-4000-8000-000000000002";

function createFakeSupabase(options?: { failRpc?: boolean; cancelledBookingId?: string }) {
  const rpc = vi.fn().mockResolvedValue(
    options?.failRpc
      ? { data: null, error: { message: "locked_delivery_leg_cannot_reassign" } }
      : {
          data: { ok: true, snapshotId: "snap-1", committedCount: 2, notifiedDriverIds: [DRV_A] },
          error: null,
        }
  );

  const tables: Record<string, unknown[]> = {
    branches: [{ id: BRANCH_ID, name: "Bacolod Main", latitude: 10.6765, longitude: 122.9509 }],
    staff: [
      { id: DRV_A, branch_id: BRANCH_ID, full_name: "Driver A", nickname: "Driver A", staff_type: "driver", is_active: true, metadata: { vehicle_capacity: 4 } },
      { id: DRV_B, branch_id: BRANCH_ID, full_name: "Driver B", nickname: "Driver B", staff_type: "driver", is_active: true, metadata: { vehicle_capacity: 4 } },
      { id: TH_1, branch_id: BRANCH_ID, full_name: "Therapist 1", nickname: "T1", staff_type: "therapist", is_active: true, metadata: null },
      { id: TH_2, branch_id: BRANCH_ID, full_name: "Therapist 2", nickname: "T2", staff_type: "therapist", is_active: true, metadata: null },
    ],
    bookings: [
      {
        id: B1,
        branch_id: BRANCH_ID,
        staff_id: TH_1,
        driver_id: null,
        booking_date: "2026-11-17",
        start_time: "10:00:00",
        end_time: "11:00:00",
        status: options?.cancelledBookingId === B1 ? "cancelled" : "confirmed",
        booking_progress_status: "confirmed",
        delivery_type: "home_service",
        home_service_tracking_status: "awaiting_driver",
        session_started_at: null,
        session_due_at: null,
        session_completed_at: null,
        metadata: {
          home_service_address: { lat: 10.6805, lng: 122.955, full_address: "Mandalagan, Bacolod" },
        },
      },
      {
        id: B2,
        branch_id: BRANCH_ID,
        staff_id: TH_2,
        driver_id: null,
        booking_date: "2026-11-17",
        start_time: "10:15:00",
        end_time: "11:15:00",
        status: "confirmed",
        booking_progress_status: "confirmed",
        delivery_type: "home_service",
        home_service_tracking_status: "awaiting_driver",
        session_started_at: null,
        session_due_at: null,
        session_completed_at: null,
        metadata: {
          home_service_address: { lat: 10.686, lng: 122.961, full_address: "Bata, Bacolod" },
          driver_collection: {
            decision: "not_required",
            source: "schedule",
            approvedBy: "mgr-1",
            approvedAt: "2026-11-17T08:00:00+08:00",
            reasonCode: "APPROVED_INDEPENDENT_DEPARTURE",
          },
        },
      },
    ],
    staff_schedules: [
      { staff_id: DRV_A, day_of_week: 2, start_time: "08:00:00", end_time: "22:00:00", ends_next_day: false, is_active: true },
      { staff_id: DRV_B, day_of_week: 2, start_time: "08:00:00", end_time: "22:00:00", ends_next_day: false, is_active: true },
      { staff_id: TH_1, day_of_week: 2, start_time: "09:00:00", end_time: "21:00:00", ends_next_day: false, is_active: true },
      { staff_id: TH_2, day_of_week: 2, start_time: "09:00:00", end_time: "21:00:00", ends_next_day: false, is_active: true },
    ],
    schedule_overrides: [],
    staff_location_snapshots: [],
  };

  function makeQuery(table: string) {
    let rows = [...(tables[table] ?? [])] as Record<string, unknown>[];
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] === val);
        return q;
      },
      neq: (col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] !== val);
        return q;
      },
      not: () => q,
      in: (col: string, vals: unknown[]) => {
        const set = new Set(vals);
        rows = rows.filter((r) => set.has(r[col]));
        return q;
      },
      is: (col: string, val: unknown) => {
        rows = rows.filter((r) => (r[col] ?? null) === val);
        return q;
      },
      order: () => q,
      limit: () => q,
      single: async () => ({ data: rows[0] ?? null, error: rows[0] ? null : { message: "not found" } }),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: rows, error: null }),
    };
    return q;
  }

  return {
    rpc,
    from: vi.fn((table: string) => makeQuery(table)),
  } as unknown as Parameters<typeof buildDispatchOptimizerSnapshot>[0]["supabase"];
}

describe("O4 Optimizer Bridge, Travel Matrix & Android tripPlans", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uses server Google Routes API v2 when GOOGLE_MAPS_SERVER_API_KEY is configured without leaking keys", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "test-server-secret-key-not-exposed");
    const locations: OptimizerLocationNode[] = [
      { location_id: "branch:1", label: "Branch", lat: 10.6765, lng: 122.9509, location_type: "branch", branch_id: BRANCH_ID },
      { location_id: "customer:b1", label: "Cust", lat: 10.6805, lng: 122.955, location_type: "customer", branch_id: BRANCH_ID },
    ];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { originIndex: 0, destinationIndex: 1, duration: "660s", distanceMeters: 3400, condition: "ROUTE_EXISTS" },
        { originIndex: 1, destinationIndex: 0, duration: "720s", distanceMeters: 3500, condition: "ROUTE_EXISTS" },
      ],
    }) as unknown as typeof fetch;

    const matrix = await computeSnapshotTravelMatrix(locations, mockFetch);
    expect(matrix.matrix_version).toBe("google-routes-v2");
    expect(matrix.travel_time_minutes).toEqual([
      [0, 11],
      [12, 0],
    ]);
    expect(matrix.travel_distance_km).toEqual([
      [0, 3.4],
      [3.5, 0],
    ]);
  });

  it("builds valid OptimizeRequest and falls back safely when optimizer service is offline", async () => {
    vi.stubEnv("CRADLEHUB_OPTIMIZER_URL", "http://127.0.0.1:59999");
    const supabase = createFakeSupabase();
    const { request } = await buildDispatchOptimizerSnapshot({
      supabase,
      branchId: BRANCH_ID,
      planningDate: "2026-11-17",
    });

    expect(request.drivers).toHaveLength(2);
    expect(request.therapists).toHaveLength(2);
    expect(request.therapists[1]?.return_arrangement?.disposition).toBe("not_required");
    // B1 generates delivery + collection, B2 (approved not_required) generates delivery only
    expect(request.transport_obligations.filter((o) => o.booking_id === B1)).toHaveLength(2);
    expect(request.transport_obligations.filter((o) => o.booking_id === B2)).toHaveLength(1);

    const offlineFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    const plan = await requestDispatchOptimizationPlan({
      supabase,
      branchId: BRANCH_ID,
      planningDate: "2026-11-17",
      fetchImpl: offlineFetch,
    });
    expect(plan.available).toBe(false);
    if (!plan.available) {
      expect(plan.fallbackAllowed).toBe(true);
      expect(plan.reason).toContain("Manual dispatch");
    }
  });

  it("blocks stale/cancelled booking commits before RPC and projects pooled tripPlans for Android", async () => {
    vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "true");
    const fakeResponse = {
      snapshot_id: "snap-1",
      feasibility_status: "feasible" as const,
      all_obligations_served: true,
      collection_plan_safe: true,
      operational_commitment_allowed: true,
      routes: [
        {
          driver_id: DRV_A,
          driver_name: "Driver A",
          vehicle_capacity: 4,
          stops: [
            { sequence_index: 0, stop_type: "driver_start" as const, location_id: `branch:${BRANCH_ID}`, location_label: "Branch", arrival_minute: 540, departure_minute: 540 },
            { sequence_index: 1, obligation_id: `del:${B1}`, booking_id: B1, therapist_id: TH_1, leg_type: "delivery" as const, stop_type: "pickup" as const, location_id: `branch:${BRANCH_ID}`, location_label: "Branch", arrival_minute: 550, departure_minute: 553 },
            { sequence_index: 2, obligation_id: `del:${B2}`, booking_id: B2, therapist_id: TH_2, leg_type: "delivery" as const, stop_type: "pickup" as const, location_id: `branch:${BRANCH_ID}`, location_label: "Branch", arrival_minute: 553, departure_minute: 556 },
            { sequence_index: 3, obligation_id: `del:${B1}`, booking_id: B1, therapist_id: TH_1, leg_type: "delivery" as const, stop_type: "dropoff" as const, location_id: `customer:${B1}`, location_label: "Mandalagan", arrival_minute: 568, departure_minute: 571 },
            { sequence_index: 4, obligation_id: `del:${B2}`, booking_id: B2, therapist_id: TH_2, leg_type: "delivery" as const, stop_type: "dropoff" as const, location_id: `customer:${B2}`, location_label: "Bata", arrival_minute: 580, departure_minute: 583 },
          ],
          assigned_obligation_ids: [`del:${B1}`, `del:${B2}`],
          driving_minutes: 30,
          distance_km: 12,
          peak_occupancy: 2,
        },
      ],
      assignments: [
        { obligation_id: `del:${B1}`, booking_id: B1, therapist_id: TH_1, leg_type: "delivery" as const, driver_id: DRV_A, pickup_minute: 550, dropoff_minute: 568, is_pooled_leg: true, change_type: "new" as const },
        { obligation_id: `del:${B2}`, booking_id: B2, therapist_id: TH_2, leg_type: "delivery" as const, driver_id: DRV_A, pickup_minute: 553, dropoff_minute: 580, is_pooled_leg: true, change_type: "new" as const },
        { obligation_id: `col:${B1}`, booking_id: B1, therapist_id: TH_1, leg_type: "collection" as const, driver_id: DRV_B, pickup_minute: 660, dropoff_minute: 675, is_pooled_leg: false, change_type: "new" as const },
      ],
      return_decisions: [
        { booking_id: B1, therapist_id: TH_1, requirement: "required" as const, reason_code: "NEXT_BRANCH_SHIFT", decision_source: "schedule", destination_location_id: `branch:${BRANCH_ID}`, destination_type: "branch" as const },
        { booking_id: B2, therapist_id: TH_2, requirement: "not_required" as const, reason_code: "APPROVED_INDEPENDENT_DEPARTURE", decision_source: "explicit", destination_location_id: null, destination_type: "none" as const, approval_source: "schedule", approved_by: "mgr-1", approved_at: "2026-11-17T08:00:00+08:00" },
      ],
      collection_coverage: [],
      unassigned_obligations: [],
      infeasibility_reasons: [],
      constraint_violations: [],
      metrics: { total_driving_minutes: 30, total_distance_km: 12, pooled_route_count: 1, pooled_leg_count: 2, active_driver_count: 2, served_obligation_count: 3, unassigned_obligation_count: 0 },
      matrix_version: "haversine-fallback-v1",
    };

    const { request } = await buildDispatchOptimizerSnapshot({
      supabase: createFakeSupabase(),
      branchId: BRANCH_ID,
      planningDate: "2026-11-17",
    });

    const updates = buildBookingUpdatesFromOptimizerResponse(request, fakeResponse);
    expect(updates).toHaveLength(2);
    expect(updates[0]?.deliveryDriverId).toBe(DRV_A);
    expect(updates[0]?.collectionDriverId).toBe(DRV_B);
    expect(updates[1]?.collectionDecision).toBe("not_required");

    // Stale cancelled booking must be blocked by server guard before committing RPC
    const staleCheck = await validateProposedPlanAgainstDb({
      supabase: createFakeSupabase({ cancelledBookingId: B1 }),
      branchId: BRANCH_ID,
      bookingUpdates: updates,
    });
    expect(staleCheck.valid).toBe(false);

    // Valid commit succeeds via atomic RPC
    const supabaseValid = createFakeSupabase();
    const committed = await commitOptimizedDispatchPlan({
      supabase: supabaseValid,
      branchId: BRANCH_ID,
      actorStaffId: "crm-1",
      snapshotId: "snap-1",
      bookingUpdates: updates,
    });
    expect(committed).toEqual({ ok: true, committedCount: 2, notifiedDriverIds: [DRV_A] });

    // Android tripPlans groups pooled delivery for Driver A cleanly & separates Pick-up for Driver B
    const vjId = updates[0]!.vehicleJourneyId!;
    const journeysA: DriverJourney[] = [
      {
        bookingId: B1,
        revision: 1,
        stage: "pickup_pending",
        leg: "pickup",
        destination: { lat: 10.6765, lng: 122.9509, label: "Bacolod Main" },
        pickupCoords: { lat: 10.6765, lng: 122.9509 },
        customerCoords: { lat: 10.6805, lng: 122.955 },
        observedAt: "2026-11-17T01:00:00Z",
        therapistId: TH_1,
        therapistName: "Therapist 1",
        vehicleJourneyId: vjId,
        deliveryDriverId: DRV_A,
        collectionDriverId: DRV_B,
        viewerDriverId: DRV_A,
        stopOrder: 1,
        collectionDecision: "required",
        customerAddress: "Mandalagan",
      },
      {
        bookingId: B2,
        revision: 1,
        stage: "pickup_pending",
        leg: "pickup",
        destination: { lat: 10.6765, lng: 122.9509, label: "Bacolod Main" },
        pickupCoords: { lat: 10.6765, lng: 122.9509 },
        customerCoords: { lat: 10.686, lng: 122.961 },
        observedAt: "2026-11-17T01:00:00Z",
        therapistId: TH_2,
        therapistName: "Therapist 2",
        vehicleJourneyId: vjId,
        deliveryDriverId: DRV_A,
        collectionDriverId: null,
        viewerDriverId: DRV_A,
        stopOrder: 2,
        collectionDecision: "not_required",
        customerAddress: "Bata",
      },
    ];

    const plansA = buildDriverTripPlans(journeysA, DRV_A);
    expect(plansA).toHaveLength(1);
    expect(plansA[0]?.mode).toBe("DROP_OFF");
    expect(plansA[0]?.passengers).toHaveLength(2);
    expect(plansA[0]?.stops.map((s) => s.role)).toEqual([
      "BRANCH_PICKUP",
      "CUSTOMER_DROP",
      "CUSTOMER_DROP",
    ]);

    const plansB = buildDriverTripPlans(
      [
        {
          ...journeysA[0]!,
          stage: "collection_pending",
          leg: "collection",
          bookingProgressStatus: "completed",
          sessionCompletedAt: "2026-11-17T03:00:00Z",
          viewerDriverId: DRV_B,
        },
      ],
      DRV_B
    );
    expect(plansB[0]?.mode).toBe("PICK_UP");
    expect(plansB[0]?.routeAuthorized).toBe(true);
    expect(plansB[0]?.passengers[0]?.service).toBe("COMPLETED");
  });
});
