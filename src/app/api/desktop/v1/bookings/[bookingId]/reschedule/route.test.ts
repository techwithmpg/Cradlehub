vi.mock("server-only", () => ({}));
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/bookings/crm-booking-operations", () => ({
  rescheduleBooking: vi.fn(),
  rescheduleBookingSchema: {
    omit: () => ({
      extend: () => ({
        safeParse: (input: unknown) => {
          const body = input as Record<string, unknown> | null;
          if (!body || !body.date || !body.startTime) {
            return { success: false, error: new Error("Missing date/time") };
          }
          if (body.therapistId === "bad-uuid") {
            return { success: false, error: new Error("Bad therapistId") };
          }
          return { success: true, data: body };
        },
      }),
    }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { rescheduleBooking } from "@/lib/bookings/crm-booking-operations";
import { POST } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedReschedule = vi.mocked(rescheduleBooking);

function authSuccess() {
  return {
    ok: true as const,
    operator: {
      authUserId: "user-1",
      staff: {
        id: "staff-actor",
        branch_id: "branch-main",
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    },
    user: {
      id: "user-1",
      email: "crm@example.test",
    },
    client: {} as unknown as SupabaseClient<Database>,
  };
}

describe("POST /api/desktop/v1/bookings/[bookingId]/reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockedAuth.mockResolvedValueOnce({
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Missing token",
    });

    const req = new NextRequest(
      "http://localhost/api/desktop/v1/bookings/550e8400-e29b-41d4-a716-446655440000/reschedule",
      {
        method: "POST",
        body: JSON.stringify({ date: "2026-09-15", startTime: "14:00" }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ bookingId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid bookingId UUID", async () => {
    mockedAuth.mockResolvedValueOnce(authSuccess());

    const req = new NextRequest("http://localhost/api/desktop/v1/bookings/not-a-uuid/reschedule", {
      method: "POST",
      body: JSON.stringify({ date: "2026-09-15", startTime: "14:00" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ bookingId: "not-a-uuid" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when missing date or startTime", async () => {
    mockedAuth.mockResolvedValueOnce(authSuccess());

    const req = new NextRequest(
      "http://localhost/api/desktop/v1/bookings/550e8400-e29b-41d4-a716-446655440000/reschedule",
      {
        method: "POST",
        body: JSON.stringify({ date: "2026-09-15" }), // missing startTime
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ bookingId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("VALIDATION_ERROR");
  });

  it("performs atomic reschedule with optional therapist reassignment", async () => {
    mockedAuth.mockResolvedValueOnce(authSuccess());
    mockedReschedule.mockResolvedValueOnce({
      success: true,
    });

    const req = new NextRequest(
      "http://localhost/api/desktop/v1/bookings/550e8400-e29b-41d4-a716-446655440000/reschedule",
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-09-15",
          startTime: "14:00",
          therapistId: "550e8400-e29b-41d4-a716-446655440099",
          overrideReason: "customer_requested",
        }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ bookingId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // Verify rescheduleBooking was passed both reschedule and reassignment fields atomically
    expect(mockedReschedule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bookingId: "550e8400-e29b-41d4-a716-446655440000",
        date: "2026-09-15",
        startTime: "14:00",
        therapistId: "550e8400-e29b-41d4-a716-446655440099",
        overrideReason: "customer_requested",
      })
    );
  });

  it("returns 409 when rescheduleBooking returns a conflict", async () => {
    mockedAuth.mockResolvedValueOnce(authSuccess());
    mockedReschedule.mockResolvedValueOnce({
      success: false,
      code: "therapist_conflict",
      error: "The requested therapist is already booked for that time window.",
    });

    const req = new NextRequest(
      "http://localhost/api/desktop/v1/bookings/550e8400-e29b-41d4-a716-446655440000/reschedule",
      {
        method: "POST",
        body: JSON.stringify({
          date: "2026-09-15",
          startTime: "14:00",
          therapistId: "550e8400-e29b-41d4-a716-446655440099",
        }),
      }
    );

    const res = await POST(req, {
      params: Promise.resolve({ bookingId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("therapist_conflict");
  });
});
