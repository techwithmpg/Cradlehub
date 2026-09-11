import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakeDatabase } from "../helpers/stage08a-db";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), cookie: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/auth/desktop-bearer-auth", () => ({ verifyDesktopBearerAuth: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.cookie }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
import { GET as home } from "@/app/api/desktop/v1/home-service/route";
import { GET as detail } from "@/app/api/desktop/v1/bookings/[bookingId]/route";
import { GET as recommendations } from "@/app/api/desktop/v1/home-service/recommendations/route";
import { GET as drivers } from "@/app/api/desktop/v1/home-service/drivers/route";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import {
  buildRecommendationContext,
  buildDriverRecommendationContext,
} from "@/lib/queries/assignment-recommendations";
import {
  scoreTherapistCandidates,
  scoreDriverCandidates,
} from "@/lib/assignments/recommendation-engine";
const id = "11111111-1111-4111-8111-111111111111",
  branch = "22222222-2222-4222-8222-222222222222",
  driver = "33333333-3333-4333-8333-333333333333",
  therapist = "44444444-4444-4444-8444-444444444444";
const date = "2026-10-10";
let db: ReturnType<typeof fakeDatabase>;
const request = (suffix = "") =>
  new NextRequest("https://example.test/api?date=" + date + "&bookingId=" + id + suffix);
const route = { params: Promise.resolve({ bookingId: id }) };
const handlers = [
  () => home(request()),
  () => detail(request(), route),
  () => recommendations(request()),
  () => drivers(request()),
];
beforeEach(() => {
  vi.clearAllMocks();
  db = fakeDatabase({
    branches: [{ id: branch, name: "Test Branch", is_active: true, latitude: 10, longitude: 122 }],
    bookings: [
      {
        id,
        branch_id: branch,
        booking_date: date,
        start_time: "10:00:00",
        end_time: "11:00:00",
        service_id: "service",
        type: "home_service",
        delivery_type: "home_service",
        status: "confirmed",
        booking_progress_status: "not_started",
        payment_status: "paid",
        driver_id: driver,
        staff_id: therapist,
        metadata: {
          private_admin_note: "SECRET_METADATA",
          home_service_address: {
            full_address: "Test address",
            access_note: "Side gate",
            lat: 10.1,
            lng: 122.1,
          },
          dispatch: { eta_minutes: 25 },
        },
        customers: {
          id: "customer",
          full_name: "Test Customer",
          phone: "555-0100",
          email: "test@example.test",
          private_health: "SECRET_HEALTH",
        },
        services: { id: "service", name: "Test Service", duration_minutes: 60 },
        staff: { id: therapist, full_name: "Test Therapist" },
        therapist: { id: therapist, full_name: "Test Therapist" },
        driver: { id: driver, full_name: "Test Driver" },
        branches: { name: "Test Branch", latitude: 10, longitude: 122 },
        booking_events: [
          {
            id: "event",
            from_status: "pending",
            to_status: "confirmed",
            notes: "Confirmed",
            created_at: "2026-09-11",
            private: "SECRET_EVENT",
          },
        ],
      },
    ],
    staff: [
      {
        id: driver,
        branch_id: branch,
        full_name: "Test Driver",
        staff_type: "driver",
        system_role: "driver",
        is_active: true,
        archived_at: null,
        merged_into_staff_id: null,
        metadata: {},
      },
      {
        id: therapist,
        branch_id: branch,
        full_name: "Test Therapist",
        staff_type: "therapist",
        system_role: "therapist",
        is_active: true,
        archived_at: null,
        merged_into_staff_id: null,
        metadata: {},
      },
      {
        id: "outsider",
        branch_id: "other",
        full_name: "Other Branch Secret",
        staff_type: "driver",
        system_role: "driver",
        is_active: true,
        archived_at: null,
        merged_into_staff_id: null,
        metadata: {},
      },
    ],
    services: [
      {
        id: "service",
        name: "Test Service",
        duration_minutes: 60,
        service_categories: { name: "Massage" },
      },
    ],
    staff_services: [{ staff_id: therapist, service_id: "service" }],
    staff_schedules: [
      {
        id: "schedule",
        staff_id: therapist,
        day_of_week: 6,
        start_time: "08:00",
        end_time: "18:00",
        is_active: true,
        shift_type: "day",
      },
    ],
    staff_scheduling_preferences: [
      { staff_id: driver, can_drive: true, can_do_home_service: true },
      { staff_id: therapist, can_drive: false, can_do_home_service: true },
    ],
    staff_location_snapshots: [
      {
        booking_id: id,
        staff_id: driver,
        branch_id: branch,
        lat: 10.2,
        lng: 122.2,
        recorded_at: "2026-09-11T01:00:00Z",
      },
      {
        booking_id: id,
        staff_id: therapist,
        branch_id: branch,
        lat: 20,
        lng: 20,
        recorded_at: "2026-09-11T02:00:00Z",
      },
      {
        booking_id: id,
        staff_id: "old_driver",
        branch_id: branch,
        lat: 30,
        lng: 30,
        recorded_at: "2026-09-11T03:00:00Z",
      },
    ],
  });
  mocks.auth.mockResolvedValue({
    ok: true,
    client: db.client,
    user: { id: "user" },
    operator: { staff: { id: "actor", branch_id: branch, system_role: "crm" }, staffRole: "crm" },
  });
  mocks.cookie.mockResolvedValue(db.client);
  mocks.admin.mockReturnValue(db.client);
});
describe("bearer read boundaries", () => {
  it.each(handlers)("requires authentication", async (run) => {
    mocks.auth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Missing/invalid token",
    });
    const response = await run();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(db.client.from).not.toHaveBeenCalled();
  });
  it.each(handlers)("requires active staff", async (run) => {
    mocks.auth.mockResolvedValue({
      ok: false,
      status: 403,
      code: "STAFF_NOT_FOUND",
      message: "No active staff",
    });
    expect((await run()).status).toBe(403);
  });
  it.each(handlers)("requires assigned branch", async (run) => {
    const auth = await mocks.auth();
    auth.operator.staff.branch_id = null;
    expect((await run()).status).toBe(403);
  });
  it.each(handlers)("maps auth exceptions safely", async (run) => {
    mocks.auth.mockRejectedValue(new Error("SECRET_AUTH"));
    const response = await run();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("SECRET_AUTH");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
describe("authoritative dispatch read", () => {
  it("returns complete context, strips ephemeral numbers and uses assigned driver snapshots", async () => {
    const response = await home(request("&branchId=other&role=owner&staffId=outsider"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.context).toEqual({ branchId: branch, branchName: "Test Branch", date });
    expect(body.data.summary.totalToday).toBe(1);
    expect(body.data.items[0]).toMatchObject({
      id,
      latestDriverLocation: { staffId: driver, lat: 10.2, recorded_at: "2026-09-11T01:00:00Z" },
      eta: { source: "stored_dispatch_estimate", minutes: 25 },
    });
    expect(body.data.items[0]).not.toHaveProperty("number");
    expect(body.data.items[0]).not.toHaveProperty("rating");
    for (const alert of body.data.alerts) expect(alert).not.toHaveProperty("dispatchNumber");
    expect(mocks.cookie).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("returns true empty success", async () => {
    db.rows.bookings = [];
    const response = await home(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { items: [], summary: { totalToday: 0 }, alerts: [] },
    });
  });
  it.each(["bookings", "staff", "staff_location_snapshots", "branches"])(
    "never converts %s failure to empty success",
    async (table) => {
      db.errors[table] = { message: "SECRET_DATABASE", code: "XX000" };
      const response = await home(request());
      expect(response.status).toBe(500);
      const body = await response.text();
      expect(body).not.toContain("SECRET_DATABASE");
      expect(body).not.toContain('"items":[]');
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );
  it("keeps hosted tolerant behavior", async () => {
    db.errors.bookings = { message: "database failed" };
    const result = await getDispatchData({ branchId: branch, date });
    expect(result.items).toEqual([]);
  });
  it("does not create an ETA or location when absent", async () => {
    db.rows.bookings![0]!.metadata = {};
    db.rows.staff_location_snapshots = [];
    const body = await (await home(request())).json();
    expect(body.data.items[0].eta).toBeNull();
    expect(body.data.items[0].latestDriverLocation).toBeNull();
  });
  it("exposes recorded Routes API provenance and timestamp", async () => {
    db.rows.bookings![0]!.metadata = {
      dispatch: {
        live_eta: {
          eta_minutes: 12,
          source: "routes_api",
          origin: "driver_location",
          calculated_at: "2026-09-11T01:05:00Z",
        },
      },
    };
    const body = await (await home(request())).json();
    expect(body.data.items[0].eta).toEqual({
      minutes: 12,
      source: "stored_routes_api",
      origin: "driver_location",
      calculatedAt: "2026-09-11T01:05:00Z",
    });
  });
  it("paginates beyond the hosted 50-row window for truthful totals", async () => {
    const row = db.rows.bookings![0]!;
    db.rows.bookings = Array.from({ length: 501 }, (_, index) => ({
      ...row,
      id: String(index),
      driver_id: null,
    }));
    const body = await (await home(request())).json();
    expect(body.data.items).toHaveLength(501);
    expect(body.data.summary.totalToday).toBe(501);
  });
  it("rejects impossible calendar dates", async () =>
    expect((await home(new NextRequest("https://example.test/?date=2026-02-30"))).status).toBe(
      400
    ));
});
describe("booking detail", () => {
  it("allowlists customer contact and Home Service detail", async () => {
    const response = await detail(request("&branchId=other"), route);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.customer).toEqual({
      id: "customer",
      name: "Test Customer",
      phone: "555-0100",
      email: "test@example.test",
    });
    expect(body.data.homeServiceAddress).toMatchObject({
      fullAddress: "Test address",
      accessNote: "Side gate",
      lat: 10.1,
      lng: 122.1,
    });
    expect(JSON.stringify(body)).not.toContain("SECRET_");
    expect(body.data.events[0]).toMatchObject({ notes: "Confirmed" });
    expect(mocks.cookie).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("returns safe missing 404", async () => {
    db.rows.bookings = [];
    expect((await detail(request(), route)).status).toBe(404);
  });
  it("rejects wrong branch including owner", async () => {
    db.rows.bookings![0]!.branch_id = "other";
    const auth = await mocks.auth();
    auth.operator.staffRole = "owner";
    expect((await detail(request(), route)).status).toBe(403);
  });
  it("returns safe database errors", async () => {
    db.errors.bookings = { message: "SECRET_DATABASE" };
    const response = await detail(request(), route);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("SECRET_DATABASE");
  });
});
describe("recommendation authority and driver roster", () => {
  it("uses the existing scoring engines with fully injected contexts", async () => {
    const response = await recommendations(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    const options = { supabase: db.client as never, throwOnError: true, branchId: branch };
    const t = await buildRecommendationContext(id, {}, options),
      d = await buildDriverRecommendationContext(id, {}, options);
    expect(t).not.toBeNull();
    expect(d).not.toBeNull();
    expect(body.data.therapists).toEqual(scoreTherapistCandidates(t!));
    expect(body.data.drivers).toEqual(scoreDriverCandidates(d!));
    expect(JSON.stringify(body)).not.toContain("outsider");
    expect(mocks.cookie).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("scopes the active driver roster without private metadata", async () => {
    const response = await drivers(request("&branchId=other"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.drivers).toEqual([
      {
        id: driver,
        name: "Test Driver",
        systemRole: "driver",
        staffType: "driver",
        isActive: true,
      },
    ]);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("excludes inactive drivers", async () => {
    db.rows.staff![0]!.is_active = false;
    expect((await (await drivers(request())).json()).data.drivers).toEqual([]);
  });
  it("rejects wrong branch before candidate reads", async () => {
    db.rows.bookings![0]!.branch_id = "other";
    expect((await recommendations(request())).status).toBe(403);
    expect(db.reads.some((read) => read.table === "staff")).toBe(false);
  });
  it("requires Home Service for driver recommendations", async () => {
    db.rows.bookings![0]!.type = "walkin";
    db.rows.bookings![0]!.delivery_type = "in_spa";
    expect((await recommendations(request())).status).toBe(400);
  });
  it("returns missing booking 404", async () => {
    db.rows.bookings = [];
    expect((await recommendations(request())).status).toBe(404);
  });
  it.each(["bookings", "staff", "staff_scheduling_preferences", "staff_schedules", "services"])(
    "fails safely on %s query failure",
    async (table) => {
      db.errors[table] = { message: "SECRET_DATABASE does not exist" };
      const response = await recommendations(request());
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("SECRET_DATABASE");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );
});
