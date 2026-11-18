import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));

const {
  publishCrmMock,
  createOnceMock,
  processPushMock,
  createClientMock,
  createAdminClientMock,
} = vi.hoisted(() => ({
  publishCrmMock: vi.fn().mockResolvedValue({ published: true, dedupeKey: "driver_arrival:k1" }),
  createOnceMock: vi.fn().mockResolvedValue(true),
  processPushMock: vi.fn().mockResolvedValue({ sent: 1 }),
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/notifications/driver-arrival-notifications", () => ({
  publishCrmDriverArrivalNotification: publishCrmMock,
  resolveCrmDriverArrivalNotifications: vi.fn(),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotificationOnce: createOnceMock,
  createStaffNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/driver/native-push", () => ({
  processDriverNativePush: processPushMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { GET, POST } from "@/app/api/staff/driver/journeys/route";
import { confirmDriverCollectionReady } from "@/lib/driver/collection-ready";

const BRANCH_ID = "10000000-0000-4000-8000-000000000001";
const DRV_A = "30000000-0000-4000-8000-000000000002";
const TH_1 = "30000000-0000-4000-8000-000000000004";
const B1 = "50000000-0000-4000-8000-000000000001";
const REQ_ID = "80000000-0000-4000-8000-000000000001";

describe("O4 driver arrivals, tripPlans projection & conditional collection signals", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns server-projected tripPlans on GET /api/staff/driver/journeys", async () => {
    vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "true");
    createClientMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "auth-1" } }, error: null }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: DRV_A, branch_id: BRANCH_ID, system_role: "driver", staff_type: "driver", is_active: true },
                error: null,
              }),
            }),
          }),
        }),
      }),
      rpc: async () => ({
        data: [
          {
            bookingId: B1,
            revision: 2,
            stage: "pickup_enroute",
            leg: "pickup",
            destination: { lat: 10.6765, lng: 122.9509, label: "Bacolod Main" },
            pickupCoords: { lat: 10.6765, lng: 122.9509 },
            customerCoords: { lat: 10.6805, lng: 122.955 },
            observedAt: "2026-11-17T02:00:00Z",
            therapistId: TH_1,
            therapistName: "Therapist 1",
            viewerDriverId: DRV_A,
            deliveryDriverId: DRV_A,
            collectionDecision: "required",
          },
        ],
        error: null,
      }),
    });

    const res = await GET(new NextRequest("https://driver.test/api/staff/driver/journeys"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.journeys).toHaveLength(1);
    expect(body.tripPlans).toHaveLength(1);
    expect(body.tripPlans[0].mode).toBe("DROP_OFF");
    expect(body.tripPlans[0].stops.map((s: { role: string }) => s.role)).toEqual([
      "BRANCH_PICKUP",
      "CUSTOMER_DROP",
    ]);
  });

  it("emits deduplicated CRM customer_arrival notification on gps_arrival transition", async () => {
    vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "true");
    vi.stubEnv("CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED", "true");

    createClientMock.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "auth-1" } }, error: null }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: DRV_A, branch_id: BRANCH_ID, system_role: "driver", staff_type: "driver", is_active: true },
                error: null,
              }),
            }),
          }),
        }),
      }),
      rpc: async () => ({
        data: {
          bookingId: B1,
          revision: 5,
          stage: "customer_arrived",
          leg: null,
          destination: null,
          observedAt: "2026-11-17T02:15:00Z",
          therapistId: TH_1,
          therapistName: "Therapist 1",
          customerName: "Dawn Navarro",
          customerAddress: "Mandalagan",
          collectionDecision: "required",
          collectionDriverId: DRV_A,
        },
        error: null,
      }),
    });

    createAdminClientMock.mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              table === "bookings"
                ? {
                    data: {
                      id: B1,
                      branch_id: BRANCH_ID,
                      driver_id: DRV_A,
                      status: "confirmed",
                      booking_progress_status: "confirmed",
                      session_completed_at: null,
                      session_completion_source: null,
                      metadata: {},
                    },
                  }
                : { data: { id: DRV_A, full_name: "Driver Alpha", nickname: "Driver A" } },
          }),
        }),
      }),
    });

    const req = new NextRequest("https://driver.test/api/staff/driver/journeys", {
      method: "POST",
      headers: { origin: "https://driver.test", "content-type": "application/json" },
      body: JSON.stringify({
        bookingId: B1,
        requestId: REQ_ID,
        expectedRevision: 4,
        action: "gps_arrival",
        point: { lat: 10.6805, lng: 122.955, accuracyMeters: 10, observedAt: "2026-11-17T02:15:00Z" },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(publishCrmMock).toHaveBeenCalledTimes(1);
    expect(publishCrmMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "customer_arrival",
      bookingId: B1,
      driverId: DRV_A,
      driverName: "Driver A",
      authorizedByServer: true,
    });
    expect(processPushMock).toHaveBeenCalled();
  });

  it("evaluates conditional collection decision after confirmDriverCollectionReady", async () => {
    vi.stubEnv("CRADLEHUB_DRIVER_JOURNEYS_ENABLED", "true");
    vi.stubEnv("CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED", "true");

    // Case 1: required -> publishes collection_ready + wakes native push
    const dbRequired = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: B1,
                branch_id: BRANCH_ID,
                staff_id: TH_1,
                driver_id: DRV_A,
                status: "completed",
                booking_progress_status: "completed",
                session_completed_at: "2026-11-17T03:00:00Z",
                session_completion_source: "manual",
                metadata: { driver_collection: { decision: "required", collectionDriverId: DRV_A } },
                customer: { full_name: "Dawn" },
                staff: { full_name: "Therapist 1", nickname: "T1" },
                driver: { full_name: "Driver A", nickname: "Driver A" },
              },
            }),
          }),
        }),
      }),
    };
    expect(await confirmDriverCollectionReady(dbRequired as never, B1)).toBeUndefined();
    expect(publishCrmMock).toHaveBeenCalledTimes(1);
    expect(publishCrmMock.mock.calls[0]?.[0]).toMatchObject({ kind: "collection_ready", bookingId: B1 });
    expect(processPushMock).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // Case 2: approved not_required -> no pickup alert or push triggered
    const dbNotRequired = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: B1,
                branch_id: BRANCH_ID,
                staff_id: TH_1,
                driver_id: DRV_A,
                status: "completed",
                booking_progress_status: "completed",
                session_completed_at: "2026-11-17T03:00:00Z",
                session_completion_source: "manual",
                metadata: {
                  driver_collection: {
                    decision: "not_required",
                    source: "schedule",
                    approvedBy: "crm-1",
                    approvedAt: "2026-11-17T01:00:00Z",
                  },
                },
                customer: { full_name: "Dawn" },
                staff: { full_name: "Therapist 1", nickname: "T1" },
                driver: { full_name: "Driver A", nickname: "Driver A" },
              },
            }),
          }),
        }),
      }),
    };
    expect(await confirmDriverCollectionReady(dbNotRequired as never, B1)).toBeUndefined();
    expect(publishCrmMock).not.toHaveBeenCalled();
    expect(processPushMock).not.toHaveBeenCalled();

    // Case 3: undecided -> sends CRM confirmation alert without collection pickup push
    const dbUndecided = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: B1,
                branch_id: BRANCH_ID,
                staff_id: TH_1,
                driver_id: DRV_A,
                status: "completed",
                booking_progress_status: "completed",
                session_completed_at: "2026-11-17T03:00:00Z",
                session_completion_source: "manual",
                metadata: { driver_collection: { decision: "undecided" } },
                customer: { full_name: "Dawn" },
                staff: { full_name: "Therapist 1", nickname: "T1" },
                driver: { full_name: "Driver A", nickname: "Driver A" },
              },
            }),
          }),
        }),
      }),
    };
    expect(await confirmDriverCollectionReady(dbUndecided as never, B1)).toBeUndefined();
    expect(createOnceMock).toHaveBeenCalledTimes(1);
    expect(processPushMock).not.toHaveBeenCalled();
  });
});
