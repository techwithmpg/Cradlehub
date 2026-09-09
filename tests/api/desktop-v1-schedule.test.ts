import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as scheduleHandler } from "@/app/api/desktop/v1/schedule/route";
import { GET as staffAvailabilityHandler } from "@/app/api/desktop/v1/schedule/staff-availability/route";
import { POST as mutationsHandler } from "@/app/api/desktop/v1/schedule/mutations/route";
import * as bearerAuth from "@/lib/auth/desktop-bearer-auth";
import * as scheduleQueries from "@/lib/queries/schedule";
import * as bookingQueries from "@/lib/queries/bookings";
import * as staffQueries from "@/lib/queries/staff";
import * as schedulingRules from "@/lib/scheduling/rules/get-scheduling-rules";
import * as scheduleMutations from "@/lib/schedule/schedule-mutations";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/queries/schedule", () => ({
  getDailySchedule: vi.fn(),
}));

vi.mock("@/lib/queries/bookings", () => ({
  getManagerDashboardStats: vi.fn(),
}));

vi.mock("@/lib/queries/staff", () => ({
  getStaffWithAvailability: vi.fn(),
}));

vi.mock("@/lib/scheduling/rules/get-scheduling-rules", () => ({
  getSchedulingRules: vi.fn(),
}));

vi.mock("@/lib/schedule/schedule-mutations", () => ({
  replaceStaffWeeklySchedule: vi.fn(),
  replaceStaffWeeklyWindowSchedule: vi.fn(),
  upsertScheduleOverride: vi.fn(),
  deleteScheduleOverride: vi.fn(),
  createBlockedTime: vi.fn(),
  deleteBlockedTime: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BRANCH_AAA = "11111111-1111-1111-1111-111111111111";
const STAFF_1 = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const STAFF_2 = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const mockClient = { tag: "authenticated-supabase-client" } as unknown as SupabaseClient<Database>;

const validManagerOperator: InhouseBookingOperator = {
  authUserId: "user-manager",
  staff: { id: STAFF_1, branch_id: BRANCH_AAA, system_role: "manager" },
  staffRole: "manager",
  isDevBypass: false,
};

const validCrmOperator: InhouseBookingOperator = {
  authUserId: "user-crm",
  staff: { id: STAFF_2, branch_id: BRANCH_AAA, system_role: "crm" },
  staffRole: "crm",
  isDevBypass: false,
};

function mockAuthOk(operator = validManagerOperator) {
  vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
    ok: true,
    operator,
    user: { id: operator.authUserId },
    client: mockClient,
  });
}

function mockAuthFail(code = "UNAUTHORIZED", status = 401, message = "Authorization header is required.") {
  vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
    ok: false,
    status,
    code,
    message,
  });
}

// ---------------------------------------------------------------------------
// GET /api/desktop/v1/schedule
// ---------------------------------------------------------------------------

describe("Desktop v1 Schedule API — Daily Schedule (GET)", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("Authentication & Authorization", () => {
    it("returns 401 when Authorization header is missing", async () => {
      mockAuthFail("UNAUTHORIZED", 401, "Authorization header is required.");
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15");
      const res = await scheduleHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
      expect(scheduleQueries.getDailySchedule).not.toHaveBeenCalled();
    });

    it("returns 401 when token is invalid", async () => {
      mockAuthFail("UNAUTHORIZED", 401, "Invalid or expired access token.");
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15", {
        headers: { Authorization: "Bearer bad-token" },
      });
      const res = await scheduleHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    });

    it("returns 403 when no active staff profile exists", async () => {
      mockAuthFail("STAFF_NOT_FOUND", 403, "No active staff profile found for this authenticated user.");
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15", {
        headers: { Authorization: "Bearer token" },
      });
      const res = await scheduleHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "STAFF_NOT_FOUND" });
      expect(scheduleQueries.getDailySchedule).not.toHaveBeenCalled();
    });
  });

  describe("Date validation", () => {
    it("returns 400 when date param is missing", async () => {
      mockAuthOk();
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule");
      const res = await scheduleHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
      expect(json.message).toMatch(/date/i);
    });

    it("returns 400 when date param is not YYYY-MM-DD", async () => {
      mockAuthOk();
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=bad-date");
      const res = await scheduleHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    });
  });

  describe("Successful daily schedule fetch", () => {
    it("passes authenticated supabase client to getDailySchedule", async () => {
      mockAuthOk();
      vi.mocked(scheduleQueries.getDailySchedule).mockResolvedValueOnce([]);
      vi.mocked(bookingQueries.getManagerDashboardStats).mockResolvedValueOnce({} as never);
      vi.mocked(schedulingRules.getSchedulingRules).mockResolvedValueOnce({} as never);

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15");
      const res = await scheduleHandler(req);

      expect(res.status).toBe(200);
      expect(scheduleQueries.getDailySchedule).toHaveBeenCalledWith({
        branchId: BRANCH_AAA,
        date: "2025-01-15",
        supabase: mockClient,
      });
    });

    it("returns ok: true with branchId, date, staffRows, stats, schedulingRules", async () => {
      mockAuthOk();
      vi.mocked(scheduleQueries.getDailySchedule).mockResolvedValueOnce([{ staff_id: STAFF_1 }] as never);
      vi.mocked(bookingQueries.getManagerDashboardStats).mockResolvedValueOnce({ totalBookings: 5 } as never);
      vi.mocked(schedulingRules.getSchedulingRules).mockResolvedValueOnce({ min_daily_staff: 2 } as never);

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15");
      const res = await scheduleHandler(req);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.branchId).toBe(BRANCH_AAA);
      expect(json.date).toBe("2025-01-15");
      expect(json.staffRows).toHaveLength(1);
      expect(json.stats).toEqual({ totalBookings: 5 });
      expect(json.schedulingRules).toMatchObject({ min_daily_staff: 2 });
    });

    it("returns schedulingRules as null if getSchedulingRules throws", async () => {
      mockAuthOk();
      vi.mocked(scheduleQueries.getDailySchedule).mockResolvedValueOnce([]);
      vi.mocked(bookingQueries.getManagerDashboardStats).mockResolvedValueOnce({} as never);
      vi.mocked(schedulingRules.getSchedulingRules).mockRejectedValueOnce(new Error("db error"));

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15");
      const res = await scheduleHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.schedulingRules).toBeNull();
    });

    it("returns 500 if getDailySchedule throws", async () => {
      mockAuthOk();
      vi.mocked(scheduleQueries.getDailySchedule).mockRejectedValueOnce(new Error("Bookings query failed"));
      vi.mocked(bookingQueries.getManagerDashboardStats).mockResolvedValueOnce({} as never);
      vi.mocked(schedulingRules.getSchedulingRules).mockResolvedValueOnce({} as never);

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15");
      const res = await scheduleHandler(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "UNKNOWN_ERROR" });
    });

    it("never exposes raw db error messages to the caller", async () => {
      mockAuthOk();
      vi.mocked(scheduleQueries.getDailySchedule).mockRejectedValueOnce(
        new Error("secret connection string leaked")
      );
      vi.mocked(bookingQueries.getManagerDashboardStats).mockResolvedValueOnce({} as never);
      vi.mocked(schedulingRules.getSchedulingRules).mockResolvedValueOnce({} as never);

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15");
      const res = await scheduleHandler(req);
      const json = await res.json();
      expect(JSON.stringify(json)).not.toContain("secret connection string");
    });

    it("returns Cache-Control: no-store on success", async () => {
      mockAuthOk();
      vi.mocked(scheduleQueries.getDailySchedule).mockResolvedValueOnce([]);
      vi.mocked(bookingQueries.getManagerDashboardStats).mockResolvedValueOnce({} as never);
      vi.mocked(schedulingRules.getSchedulingRules).mockResolvedValueOnce({} as never);

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15");
      const res = await scheduleHandler(req);
      expect(res.headers.get("cache-control")).toBe("no-store");
    });
  });

  describe("Branch isolation", () => {
    it("uses branch from server-side operator, not from query params", async () => {
      mockAuthOk(validManagerOperator);
      vi.mocked(scheduleQueries.getDailySchedule).mockResolvedValueOnce([]);
      vi.mocked(bookingQueries.getManagerDashboardStats).mockResolvedValueOnce({} as never);
      vi.mocked(schedulingRules.getSchedulingRules).mockResolvedValueOnce({} as never);

      // Even if a different branchId is in the query string, it should not be used
      const req = new NextRequest(
        "http://localhost:3000/api/desktop/v1/schedule?date=2025-01-15&branchId=99999999-9999-9999-9999-999999999999"
      );
      await scheduleHandler(req);

      expect(scheduleQueries.getDailySchedule).toHaveBeenCalledWith(
        expect.objectContaining({ branchId: BRANCH_AAA })
      );
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/desktop/v1/schedule/staff-availability
// ---------------------------------------------------------------------------

describe("Desktop v1 Schedule API — Staff Availability (GET)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when auth fails", async () => {
    mockAuthFail();
    const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/staff-availability");
    const res = await staffAvailabilityHandler(req);
    expect(res.status).toBe(401);
    expect(staffQueries.getStaffWithAvailability).not.toHaveBeenCalled();
  });

  it("passes authenticated client to getStaffWithAvailability", async () => {
    mockAuthOk();
    vi.mocked(staffQueries.getStaffWithAvailability).mockResolvedValueOnce([]);

    const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/staff-availability");
    const res = await staffAvailabilityHandler(req);

    expect(res.status).toBe(200);
    expect(staffQueries.getStaffWithAvailability).toHaveBeenCalledWith(BRANCH_AAA, mockClient);
  });

  it("returns ok: true with branchId and items", async () => {
    mockAuthOk();
    vi.mocked(staffQueries.getStaffWithAvailability).mockResolvedValueOnce([
      { id: STAFF_1, name: "Test Staff" },
    ] as never);

    const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/staff-availability");
    const res = await staffAvailabilityHandler(req);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.branchId).toBe(BRANCH_AAA);
    expect(json.items).toHaveLength(1);
  });

  it("returns 500 if getStaffWithAvailability throws", async () => {
    mockAuthOk();
    vi.mocked(staffQueries.getStaffWithAvailability).mockRejectedValueOnce(new Error("db error"));

    const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/staff-availability");
    const res = await staffAvailabilityHandler(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, code: "UNKNOWN_ERROR" });
  });
});

// ---------------------------------------------------------------------------
// POST /api/desktop/v1/schedule/mutations
// ---------------------------------------------------------------------------

describe("Desktop v1 Schedule API — Mutations (POST)", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Auth ────────────────────────────────────────────────────────────────

  describe("Authentication & Authorization", () => {
    it("returns 401 when Authorization header is missing", async () => {
      mockAuthFail("UNAUTHORIZED", 401, "Authorization header is required.");
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_override", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(401);
      expect(scheduleMutations.upsertScheduleOverride).not.toHaveBeenCalled();
    });

    it("returns 403 when staff profile is missing", async () => {
      mockAuthFail("STAFF_NOT_FOUND", 403, "No active staff profile found.");
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_override", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(403);
    });
  });

  // ── Input validation ────────────────────────────────────────────────────

  describe("Request validation", () => {
    it("returns 400 on invalid JSON", async () => {
      mockAuthOk();
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json" },
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "VALIDATION_ERROR", message: "Invalid JSON payload." });
    });

    it("returns 400 when action is missing", async () => {
      mockAuthOk();
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    });

    it("returns 400 when action is unknown", async () => {
      mockAuthOk();
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "hack_the_db", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    });
  });

  // ── Actor construction ──────────────────────────────────────────────────

  describe("Actor construction (branch isolation)", () => {
    it("builds actor from server-resolved operator, not from payload fields", async () => {
      mockAuthOk(validManagerOperator);
      vi.mocked(scheduleMutations.upsertScheduleOverride).mockResolvedValueOnce({
        ok: true,
        message: "Day override saved.",
        override: { id: "ov-1" } as never,
      });

      const maliciousPayload = {
        branchId: "99999999-9999-9999-9999-999999999999", // different branch
        staffId: STAFF_2,
        overrideDate: "2025-01-15",
        isDayOff: true,
      };

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_override", payload: maliciousPayload }),
      });
      await mutationsHandler(req);

      // Actor should have the real branch from the server operator
      expect(scheduleMutations.upsertScheduleOverride).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          staffId: STAFF_1,
          branchId: BRANCH_AAA,
          role: "manager",
        }),
        maliciousPayload
      );
    });
  });

  // ── Action dispatch ─────────────────────────────────────────────────────

  describe("Action dispatch", () => {
    it("dispatches replace_weekly_schedule to replaceStaffWeeklySchedule", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.replaceStaffWeeklySchedule).mockResolvedValueOnce({
        ok: true,
        rowsWritten: 7,
        savedRows: [],
      });
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "replace_weekly_schedule", payload: { branchId: BRANCH_AAA } }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(200);
      expect(scheduleMutations.replaceStaffWeeklySchedule).toHaveBeenCalled();
    });

    it("dispatches replace_weekly_window_schedule to replaceStaffWeeklyWindowSchedule", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.replaceStaffWeeklyWindowSchedule).mockResolvedValueOnce({
        ok: true,
        rowsWritten: 14,
        savedRows: [],
      });
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({
          action: "replace_weekly_window_schedule",
          payload: { branchId: BRANCH_AAA },
        }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(200);
      expect(scheduleMutations.replaceStaffWeeklyWindowSchedule).toHaveBeenCalled();
    });

    it("dispatches upsert_override to upsertScheduleOverride", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.upsertScheduleOverride).mockResolvedValueOnce({
        ok: true,
        message: "Day override saved.",
        override: { id: "ov-1" } as never,
      });
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_override", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(200);
      expect(scheduleMutations.upsertScheduleOverride).toHaveBeenCalled();
    });

    it("dispatches delete_override to deleteScheduleOverride", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.deleteScheduleOverride).mockResolvedValueOnce({
        ok: true,
        message: "Day override removed.",
        deletedId: "ov-1",
      });
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "delete_override", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(200);
      expect(scheduleMutations.deleteScheduleOverride).toHaveBeenCalled();
    });

    it("dispatches create_blocked_time to createBlockedTime", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.createBlockedTime).mockResolvedValueOnce({
        ok: true,
        message: "Block time saved.",
        block: { id: "bl-1" } as never,
      });
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "create_blocked_time", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(200);
      expect(scheduleMutations.createBlockedTime).toHaveBeenCalled();
    });

    it("dispatches delete_blocked_time to deleteBlockedTime", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.deleteBlockedTime).mockResolvedValueOnce({
        ok: true,
        message: "Block time removed.",
        deletedId: "bl-1",
      });
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "delete_blocked_time", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(200);
      expect(scheduleMutations.deleteBlockedTime).toHaveBeenCalled();
    });
  });

  // ── Error mapping ───────────────────────────────────────────────────────

  describe("Domain error → HTTP status mapping", () => {
    const errorCases: Array<[string, number]> = [
      ["UNAUTHORIZED", 403],
      ["BRANCH_MISMATCH", 403],
      ["INVALID_INPUT", 400],
      ["INVALID_SHIFT_TYPE", 400],
      ["OVERLAPPING_WINDOWS", 400],
      ["NOT_FOUND", 404],
      ["SAVE_FAILED", 422],
      ["DATABASE_CONSTRAINT", 422],
      ["RLS_DENIED", 403],
      ["MIGRATION_REQUIRED", 503],
    ];

    for (const [code, expectedStatus] of errorCases) {
      it(`maps domain code ${code} to HTTP ${expectedStatus}`, async () => {
        mockAuthOk();
        vi.mocked(scheduleMutations.upsertScheduleOverride).mockResolvedValueOnce({
          ok: false,
          code: code as never,
          message: `Domain error: ${code}`,
        });

        const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
          method: "POST",
          body: JSON.stringify({ action: "upsert_override", payload: {} }),
        });
        const res = await mutationsHandler(req);
        expect(res.status).toBe(expectedStatus);
        const json = await res.json();
        expect(json).toMatchObject({ ok: false, code });
      });
    }

    it("returns 500 on unexpected throw", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.upsertScheduleOverride).mockRejectedValueOnce(
        new Error("unexpected crash")
      );
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_override", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toMatchObject({ ok: false, code: "UNKNOWN_ERROR" });
    });

    it("never leaks raw db error messages on unexpected throws", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.upsertScheduleOverride).mockRejectedValueOnce(
        new Error("secret internal state: rls_policy_xyz")
      );
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_override", payload: {} }),
      });
      const res = await mutationsHandler(req);
      const json = await res.json();
      expect(JSON.stringify(json)).not.toContain("secret internal state");
    });
  });

  // ── Response headers ────────────────────────────────────────────────────

  describe("Response headers", () => {
    it("always returns Cache-Control: no-store on success", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.upsertScheduleOverride).mockResolvedValueOnce({
        ok: true,
        message: "Day override saved.",
        override: { id: "ov-1" } as never,
      });
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_override", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.headers.get("cache-control")).toBe("no-store");
    });

    it("always returns Cache-Control: no-store on domain error", async () => {
      mockAuthOk();
      vi.mocked(scheduleMutations.upsertScheduleOverride).mockResolvedValueOnce({
        ok: false,
        code: "INVALID_INPUT",
        message: "Invalid schedule.",
      });
      const req = new NextRequest("http://localhost:3000/api/desktop/v1/schedule/mutations", {
        method: "POST",
        body: JSON.stringify({ action: "upsert_override", payload: {} }),
      });
      const res = await mutationsHandler(req);
      expect(res.headers.get("cache-control")).toBe("no-store");
    });
  });
});
