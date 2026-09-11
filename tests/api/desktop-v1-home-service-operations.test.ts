import { createOpenStaffScheduleException } from "@/lib/bookings/staff-schedule-exception";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { fakeDatabase } from "../helpers/stage08a-db";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  admin: vi.fn(),
  cookie: vi.fn(),
  notify: vi.fn(),
  resolve: vi.fn(),
  revalidate: vi.fn(),
  invalidate: vi.fn(),
  operational: vi.fn(),
  recommendations: vi.fn(),
  score: vi.fn(),
  endTime: vi.fn(),
  resource: vi.fn(),
  signals: vi.fn(),
}));
vi.mock("@/lib/auth/desktop-bearer-auth", () => ({ verifyDesktopBearerAuth: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.cookie }));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => false,
  getDevBypassLayoutStaff: vi.fn(),
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotification: mocks.notify,
  resolveNotificationsForEntity: mocks.resolve,
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/cache/cache-tags", () => ({ invalidateCrmWorkspace: mocks.invalidate }));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: mocks.operational,
}));
vi.mock("@/lib/queries/assignment-recommendations", () => ({
  buildRecommendationContext: mocks.recommendations,
}));
vi.mock("@/lib/assignments/recommendation-engine", () => ({
  scoreTherapistCandidates: mocks.score,
}));
vi.mock("@/lib/engine/booking-time", () => ({ computeEndTime: mocks.endTime }));
vi.mock("@/lib/engine/resource-availability", () => ({
  isResourceAvailable: mocks.resource,
  autoAssignBookingResource: vi.fn(),
}));
vi.mock("@/lib/bookings/staff-schedule-exception-signals", () => ({
  resolveStaffScheduleExceptionSignals: mocks.signals,
}));
import { POST as homeMutation } from "@/app/api/desktop/v1/home-service/mutations/route";
import { POST as reschedule } from "@/app/api/desktop/v1/bookings/[bookingId]/reschedule/route";
import { POST as cancel } from "@/app/api/desktop/v1/bookings/[bookingId]/cancel/route";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import {
  rescheduleBookingAction,
  recordBookingFollowupAction,
  assignBookingTherapistAction,
  prepareHomeServiceDispatchAction,
} from "@/app/(dashboard)/crm/bookings/actions";
const id = "11111111-1111-4111-8111-111111111111",
  branch = "22222222-2222-4222-8222-222222222222",
  driver = "33333333-3333-4333-8333-333333333333",
  therapist = "44444444-4444-4444-8444-444444444444",
  old = "55555555-5555-4555-8555-555555555555";
let db: ReturnType<typeof fakeDatabase>;
const request = (body: unknown) =>
  new Request("https://example.test/api", { method: "POST", body: JSON.stringify(body) });
const route = { params: Promise.resolve({ bookingId: id }) };
const input = { bookingId: id, driverId: driver };
const schedule = {
  date: "2026-10-11",
  startTime: "11:00",
  note: "Later appointment",
  homeServiceAddress: "New address",
  homeServiceAccessNote: "Side gate",
};
const cancellation = { cancellationReason: "customer_requested", note: "Requested by customer" };
function booking() {
  return db.rows.bookings![0]!;
}
async function call(action: string, body: Record<string, unknown> = {}) {
  return homeMutation(request({ action, bookingId: id, ...body }));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T00:00:00Z"));
  db = fakeDatabase({
    bookings: [
      {
        id,
        branch_id: branch,
        service_id: "service",
        customer_id: null,
        booking_date: "2026-10-10",
        start_time: "10:00:00",
        end_time: "11:00:00",
        type: "home_service",
        delivery_type: "home_service",
        status: "confirmed",
        booking_progress_status: "not_started",
        payment_status: "paid",
        staff_id: therapist,
        driver_id: old,
        metadata: {
          keep: "preserved",
          home_service_address: { full_address: "Old address", lat: 10, lng: 122 },
          crm_reschedule_history: [],
        },
      },
    ],
    staff: [
      {
        id: driver,
        branch_id: branch,
        full_name: "Test Driver",
        is_active: true,
        staff_type: "driver",
        system_role: "driver",
      },
      {
        id: therapist,
        branch_id: branch,
        full_name: "Test Therapist",
        is_active: true,
        staff_type: "therapist",
        system_role: "therapist",
      },
    ],
    booking_events: [
      { id: "event", booking_id: id, to_status: "cancelled", created_at: "2026-09-11" },
    ],
  });
  mocks.admin.mockReturnValue(db.client);
  mocks.cookie.mockResolvedValue(db.client);
  db.client.auth.getUser.mockResolvedValue({ data: { user: { id: "user" } } });
  db.rows.staff!.push({
    id: "actor",
    auth_user_id: "user",
    branch_id: branch,
    system_role: "crm",
    is_active: true,
  });
  mocks.auth.mockResolvedValue({
    ok: true,
    client: db.client,
    user: { id: "user" },
    operator: { staff: { id: "actor", branch_id: branch, system_role: "crm" }, staffRole: "crm" },
  });
  mocks.recommendations.mockResolvedValue({});
  mocks.score.mockReturnValue([{ staffId: therapist, status: "recommended", warnings: [] }]);
  mocks.endTime.mockResolvedValue("12:00:00");
  mocks.resource.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());
describe("driver domain through bearer API", () => {
  it.each([undefined, "invalid"])("rejects missing/invalid bearer (%s)", async (token) => {
    mocks.auth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: token ? "Invalid token" : "Missing token",
    });
    expect((await call("assign_driver", input)).status).toBe(401);
    expect(db.writes).toHaveLength(0);
  });
  it("rejects non-CRM role", async () => {
    const auth = await mocks.auth();
    auth.operator.staffRole = "driver";
    expect((await call("assign_driver", input)).status).toBe(403);
    expect(db.writes).toHaveLength(0);
  });
  it("rejects a cross-branch booking even for an owner", async () => {
    booking().branch_id = "other";
    const auth = await mocks.auth();
    auth.operator.staffRole = "owner";
    expect((await call("assign_driver", input)).status).toBe(403);
    expect(db.writes).toHaveLength(0);
  });
  it("rejects a non Home Service booking", async () => {
    booking().type = "walkin";
    booking().delivery_type = "in_spa";
    expect((await call("assign_driver", input)).status).toBe(400);
  });
  it.each([
    ["is_active", false],
    ["branch_id", "other"],
    ["system_role", "therapist"],
  ])("rejects invalid driver %s", async (key, value) => {
    db.rows.staff![0]![key as string] = value;
    if (key === "system_role") db.rows.staff![0]!.staff_type = "therapist";
    expect((await call("assign_driver", input)).status).toBe(400);
    expect(db.writes).toHaveLength(0);
  });
  it("rejects nonexistent driver", async () => {
    db.rows.staff!.shift();
    expect((await call("assign_driver", input)).status).toBe(400);
  });
  it("rejects malformed driver ID", async () => {
    expect((await call("assign_driver", { driverId: "bad" })).status).toBe(400);
  });
  it("preserves paid reassignment notifications and invalidation", async () => {
    const result = await call("assign_driver", {
      ...input,
      branchId: "other",
      role: "owner",
      staffId: "spoof",
    });
    expect(result.status).toBe(200);
    expect(db.writes[0]!).toMatchObject({
      values: { driver_id: driver },
      filters: [
        ["id", id],
        ["branch_id", branch],
      ],
    });
    expect(mocks.resolve).toHaveBeenCalledWith("booking", id, "driver", "home_service_assigned");
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientStaffId: old, type: "booking_reassigned" })
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientStaffId: driver, type: "home_service_assigned" })
    );
    expect(mocks.invalidate).toHaveBeenCalledWith(branch);
    for (const path of ["/manager/control", "/crm/control", "/crm/today", "/driver"])
      expect(mocks.revalidate).toHaveBeenCalledWith(path);
    expect(mocks.cookie).not.toHaveBeenCalled();
  });
  it("assigns an unassigned booking", async () => {
    booking().driver_id = null;
    expect((await call("assign_driver", input)).status).toBe(200);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });
  it("unassigns and notifies only the prior driver", async () => {
    expect((await call("assign_driver", { driverId: null })).status).toBe(200);
    expect(db.writes[0]!.values.driver_id).toBeNull();
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });
  it.each(["pending", "unpaid"])("preserves %s payment notification gate", async (status) => {
    booking().payment_status = status;
    expect((await call("assign_driver", input)).status).toBe(200);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("does not notify unchanged assignment", async () => {
    booking().driver_id = driver;
    expect((await call("assign_driver", input)).status).toBe(200);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it.each(["bookings:read", "bookings:update", "staff:read"])(
    "returns safe errors for %s failure",
    async (table) => {
      db.errors[table] = { message: "SQL secret internal" };
      const response = await call("assign_driver", input);
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("SQL secret");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );
});
describe("therapist and dispatch shared business rules", () => {
  it.each(["assign_therapist", "prepare_dispatch"])("enforces branch for %s", async (action) => {
    booking().branch_id = "other";
    expect((await call(action, { staffId: therapist })).status).toBe(403);
    expect(db.writes).toHaveLength(0);
  });
  it.each(["completed", "cancelled", "no_show"])("blocks closed %s booking", async (status) => {
    booking().status = status;
    expect((await call("assign_therapist", { staffId: therapist })).status).toBe(409);
    expect((await call("prepare_dispatch", {})).status).toBe(409);
    expect(db.writes).toHaveLength(0);
  });
  it.each([
    ["id", "missing"],
    ["is_active", false],
    ["branch_id", "other"],
  ])("validates selected therapist %s", async (key, value) => {
    db.rows.staff![1]![key as string] = value;
    expect((await call("assign_therapist", { staffId: therapist })).status).toBe(409);
  });
  it("validates override reason", async () => {
    expect(
      (await call("assign_therapist", { staffId: therapist, overrideReason: "invalid" })).status
    ).toBe(400);
  });
  it("rejects unavailable recommendations", async () => {
    mocks.score.mockReturnValue([
      { staffId: therapist, status: "unavailable", warnings: ["Schedule conflict"] },
    ]);
    expect((await call("assign_therapist", { staffId: therapist })).status).toBe(409);
    expect(db.writes).toHaveLength(0);
  });
  it("rejects unqualified therapist", async () => {
    mocks.score.mockReturnValue([]);
    expect((await call("assign_therapist", { staffId: therapist })).status).toBe(409);
  });
  it("keeps assignment audit, notifications and invalidation", async () => {
    booking().staff_id = old;
    expect(
      (await call("assign_therapist", { staffId: therapist, overrideReason: "manager_decision" }))
        .status
    ).toBe(200);
    expect(db.writes[0]!.values).toMatchObject({
      staff_id: therapist,
      metadata: {
        keep: "preserved",
        assignment_audit: [
          { assigned_by: "actor", previous_staff_id: old, reason: "manager_decision" },
        ],
      },
    });
    expect(db.writes.some((w) => w.table === "booking_events" && w.kind === "insert")).toBe(true);
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientStaffId: old, type: "booking_reassigned" })
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientStaffId: therapist, type: "home_service_assigned" })
    );
    expect(mocks.operational).toHaveBeenCalledWith(branch);
    expect(mocks.recommendations).toHaveBeenCalledWith(
      id,
      {},
      expect.objectContaining({ supabase: db.client, branchId: branch, throwOnError: true })
    );
  });
  it.each(["driver_id", "staff_id"])("requires %s before dispatch", async (key) => {
    booking()[key] = null;
    expect((await call("prepare_dispatch", {})).status).toBe(409);
    expect(db.writes).toHaveLength(0);
  });
  it("requires GPS even for scheduling", async () => {
    booking().metadata = {};
    expect((await call("prepare_dispatch", { releaseNow: true })).status).toBe(409);
    expect(db.writes).toHaveLength(0);
  });
  it("rejects nonboolean release input", async () => {
    expect((await call("prepare_dispatch", { releaseNow: "true" })).status).toBe(400);
  });
  it("schedules future dispatch and preserves planning default", async () => {
    const response = await call("prepare_dispatch", { releaseNow: false, note: " Meet outside " });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { releasedNow: false } });
    expect(db.writes[0]!.values).toMatchObject({
      metadata: {
        keep: "preserved",
        dispatch: {
          status: "scheduled",
          eta_minutes: 25,
          buffer_minutes: 10,
          note: "Meet outside",
          released_at: null,
        },
      },
    });
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(db.writes.some((w) => w.table === "booking_events")).toBe(true);
  });
  it("releases immediately with existing notification semantics", async () => {
    expect((await call("prepare_dispatch", { releaseNow: true })).status).toBe(200);
    expect(db.writes[0]!.values).toMatchObject({
      metadata: { dispatch: { status: "released_to_driver" } },
    });
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientStaffId: old,
        type: "home_service_assigned",
        dedupeKey: "dispatch:released:" + id,
      })
    );
    expect(mocks.operational).toHaveBeenCalledWith(branch);
    for (const path of [
      "/crm/dispatch",
      "/manager/dispatch",
      "/driver",
      "/driver/dispatch",
      "/staff-portal/dispatch",
    ])
      expect(mocks.revalidate).toHaveBeenCalledWith(path);
  });
});
describe("general Bookings mutations", () => {
  it.each([reschedule, cancel])("requires auth", async (fn) => {
    mocks.auth.mockResolvedValue({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Missing token",
    });
    expect((await fn(request(schedule), route)).status).toBe(401);
  });
  it.each([reschedule, cancel])("rejects other branch", async (fn) => {
    booking().branch_id = "other";
    expect((await fn(request({ ...schedule, ...cancellation }), route)).status).toBe(403);
  });
  it.each(["2026-02-30", "not-date"])("rejects invalid date %s", async (date) =>
    expect((await reschedule(request({ ...schedule, date }), route)).status).toBe(400)
  );
  it.each(["24:00", "11:61", "noon"])("rejects invalid time %s", async (startTime) =>
    expect((await reschedule(request({ ...schedule, startTime }), route)).status).toBe(400)
  );
  it.each(["completed", "cancelled", "no_show", "in_progress"])(
    "forbids rescheduling %s",
    async (status) => {
      booking().status = status;
      expect((await reschedule(request(schedule), route)).status).toBe(409);
    }
  );
  it.each(["home_service", "walkin"])(
    "reschedules %s preserving metadata, events and notifications",
    async (type) => {
      booking().type = type;
      booking().delivery_type = type === "walkin" ? "in_spa" : "home_service";
      const response = await reschedule(
        request({ ...schedule, branchId: "other", role: "owner" }),
        route
      );
      expect(response.status).toBe(200);
      expect(db.writes[0]!.values).toMatchObject({
        booking_date: schedule.date,
        start_time: "11:00:00",
        end_time: "12:00:00",
        metadata: {
          keep: "preserved",
          crm_reschedule_history: [
            { updated_by: "actor", from_date: "2026-10-10", to_date: schedule.date },
          ],
        },
      });
      if (type === "home_service")
        expect(db.writes[0]!.values).toMatchObject({
          metadata: {
            home_service_address: {
              full_address: "New address",
              access_note: "Side gate",
              lat: 10,
              lng: 122,
            },
          },
        });
      expect(db.writes.some((w) => w.table === "booking_events")).toBe(true);
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "booking_rescheduled", recipientStaffId: therapist })
      );
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "booking_rescheduled", recipientStaffId: old })
      );
      expect(mocks.operational).toHaveBeenCalledWith(branch);
      expect(mocks.endTime).toHaveBeenCalledWith("11:00:00", "service", db.client);
      expect(mocks.cookie).not.toHaveBeenCalled();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );
  it("enforces existing resource availability for in-spa rescheduling", async () => {
    booking().type = "walkin";
    booking().delivery_type = "in_spa";
    booking().resource_id = "room";
    mocks.resource.mockResolvedValue(false);
    expect((await reschedule(request(schedule), route)).status).toBe(409);
    expect(db.writes).toHaveLength(0);
  });
  it("rejects invalid cancellation reason", async () =>
    expect((await cancel(request({ cancellationReason: "bad" }), route)).status).toBe(400));
  it.each(["completed", "cancelled", "no_show"])("rejects cancellation of %s", async (status) => {
    booking().status = status;
    expect((await cancel(request(cancellation), route)).status).toBe(409);
  });
  it("cancels preserving metadata, audit and paid notifications", async () => {
    const response = await cancel(
      request({ ...cancellation, result: "confirm", branchId: "other", staffId: "spoof" }),
      route
    );
    expect(response.status).toBe(200);
    expect(db.writes[0]!.values).toMatchObject({
      status: "cancelled",
      metadata: {
        keep: "preserved",
        cancellation: {
          reason: "Customer requested cancellation",
          note: cancellation.note,
          cancelled_by: "actor",
          source: "crm",
        },
      },
    });
    expect(db.writes.some((w) => w.table === "booking_events" && w.kind === "update")).toBe(true);
    for (const recipient of [therapist, old])
      expect(mocks.notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "booking_cancelled", recipientStaffId: recipient })
      );
    expect(mocks.resolve).toHaveBeenCalledWith("booking", id, "driver", "home_service_assigned");
    expect(mocks.operational).toHaveBeenCalledWith(branch);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("does not invent refund/payment writes", async () => {
    expect((await cancel(request(cancellation), route)).status).toBe(200);
    expect(db.writes.map((w) => w.table)).toEqual(["bookings", "booking_events"]);
    expect(db.writes[0]!.values).not.toHaveProperty("payment_status");
  });
});
describe("hosted wrappers still execute the shared domains", () => {
  it("driver action", async () => {
    expect(await assignBookingDriverAction(input)).toMatchObject({ success: true });
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });
  it("therapist action", async () => {
    booking().staff_id = old;
    expect(await assignBookingTherapistAction({ bookingId: id, staffId: therapist })).toMatchObject(
      { success: true }
    );
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });
  it("dispatch action", async () => {
    expect(
      await prepareHomeServiceDispatchAction({ bookingId: id, releaseNow: true })
    ).toMatchObject({ success: true, releasedNow: true });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });
  it("reschedule action", async () => {
    expect(await rescheduleBookingAction({ bookingId: id, ...schedule })).toMatchObject({
      success: true,
    });
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });
  it("cancellation action", async () => {
    expect(
      await recordBookingFollowupAction({ bookingId: id, result: "cancel", ...cancellation })
    ).toMatchObject({ success: true });
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });
});

describe("schedule exception and failure regressions", () => {
  function openException() {
    booking().metadata = createOpenStaffScheduleException(
      { keep: "preserved", home_service_address: { lat: 10, lng: 122 } },
      {
        reasonCode: "selected_staff_off_day",
        selectedStaffId: old,
        selectedStaffName: "Previous Therapist",
        customerName: "Test Customer",
        branchId: branch,
        bookingDate: "2026-10-10",
        startTime: "10:00",
        endTime: "11:00",
        createdAt: "2026-09-10T00:00:00Z",
      }
    );
  }
  it("resolves open exception metadata and signals on therapist change", async () => {
    booking().staff_id = old;
    openException();
    expect((await call("assign_therapist", { staffId: therapist })).status).toBe(200);
    expect(db.writes[0]!.values).toMatchObject({
      metadata: {
        staff_schedule_exception: {
          status: "resolved",
          resolution: "reassigned_staff",
          new_staff_id: therapist,
        },
        staff_assignment_review_required: false,
      },
    });
    expect(mocks.signals).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: id, staffId: old, completedByStaffId: "actor" })
    );
  });
  it("resolves open exception metadata and signals on schedule change", async () => {
    openException();
    expect((await reschedule(request(schedule), route)).status).toBe(200);
    expect(db.writes[0]!.values).toMatchObject({
      metadata: {
        staff_schedule_exception: { status: "resolved", resolution: "rescheduled_booking" },
      },
    });
    expect(mocks.signals).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: id, staffId: old, completedByStaffId: "actor" })
    );
  });
  it("releases due dispatch even when releaseNow is false", async () => {
    booking().booking_date = "2026-09-10";
    const response = await call("prepare_dispatch", { releaseNow: false });
    expect(await response.json()).toMatchObject({ ok: true, data: { releasedNow: true } });
  });
  it("keeps stored ETA over planning fallback", async () => {
    booking().metadata = {
      home_service_address: { lat: 10, lng: 122 },
      dispatch: { eta_minutes: 17 },
    };
    expect((await call("prepare_dispatch", {})).status).toBe(200);
    expect(db.writes[0]!.values).toMatchObject({ metadata: { dispatch: { eta_minutes: 17 } } });
  });
  it.each(["assign_therapist", "prepare_dispatch"])(
    "requires authentication for %s",
    async (action) => {
      mocks.auth.mockResolvedValue({
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Invalid token",
      });
      const response = await call(action, { staffId: therapist });
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(db.writes).toHaveLength(0);
    }
  );
  it.each(["assign_therapist", "prepare_dispatch"])(
    "rejects non Home Service in %s route",
    async (action) => {
      booking().type = "walkin";
      booking().delivery_type = "in_spa";
      expect((await call(action, { staffId: therapist })).status).toBe(403);
      expect(db.writes).toHaveLength(0);
    }
  );
  it.each([reschedule, cancel])("returns safe no-store errors on failed write", async (fn) => {
    db.errors["bookings:update"] = { message: "SECRET_SQL" };
    const response = await fn(request({ ...schedule, ...cancellation }), route);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("SECRET_SQL");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each(["assign_therapist", "prepare_dispatch"])(
    "returns safe no-store errors on failed %s write",
    async (action) => {
      db.errors["bookings:update"] = { message: "SECRET_SQL" };
      const response = await call(action, { staffId: therapist });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("SECRET_SQL");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  );
  it("preserves unpaid cancellation notification semantics", async () => {
    booking().payment_status = "pending";
    expect((await cancel(request(cancellation), route)).status).toBe(200);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it("preserves unpaid therapist notification semantics", async () => {
    booking().payment_status = "pending";
    booking().staff_id = old;
    expect((await call("assign_therapist", { staffId: therapist })).status).toBe(200);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("preserves hosted owner cross-branch driver authority", async () => {
    booking().branch_id = "other";
    db.rows.staff![0]!.branch_id = "other";
    db.rows.staff![2]!.system_role = "owner";
    expect(await assignBookingDriverAction(input)).toMatchObject({ success: true });
  });
  it("denies zero-row driver writes", async () => {
    mocks.admin.mockReturnValue(fakeDatabase({ bookings: [] }).client);
    expect((await call("assign_driver", input)).status).toBe(500);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
