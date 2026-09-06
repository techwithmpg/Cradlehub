import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/desktop/v1/bookings/route";
import * as bearerAuth from "@/lib/auth/desktop-bearer-auth";
import * as bookingEngine from "@/lib/bookings/inhouse-booking-engine";
import { createInhouseBookingMultiAction } from "@/lib/actions/inhouse-booking";
import * as supabaseServer from "@/lib/supabase/server";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/bookings/inhouse-booking-engine", () => ({
  executeInhouseBookingCreation: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Desktop v1 Bookings API Boundary & Domain Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication & Authorization Enforcement", () => {
    it("returns 401 when Authorization header is missing", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Authorization header is required.",
      });

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Authorization header is required.",
      });
      expect(bookingEngine.executeInhouseBookingCreation).not.toHaveBeenCalled();
    });

    it("returns 401 when Bearer token is invalid or expired", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Invalid or expired access token.",
      });

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer bad-token" },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Invalid or expired access token.",
      });
      expect(bookingEngine.executeInhouseBookingCreation).not.toHaveBeenCalled();
    });

    it("returns 403 when authenticated user has no active staff profile", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: false,
        status: 403,
        code: "STAFF_NOT_FOUND",
        message: "No active staff profile found for this authenticated user.",
      });

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "No active staff profile found for this authenticated user.",
      });
      expect(bookingEngine.executeInhouseBookingCreation).not.toHaveBeenCalled();
    });

    it("returns 403 when authenticated staff lacks CRM workspace permissions", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: false,
        status: 403,
        code: "CRM_PERMISSION_DENIED",
        message: "You do not have permission to access the CRM booking workspace.",
      });

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "CRM_PERMISSION_DENIED",
        message: "You do not have permission to access the CRM booking workspace.",
      });
      expect(bookingEngine.executeInhouseBookingCreation).not.toHaveBeenCalled();
    });
  });

  describe("Request Validation & Domain Execution", () => {
    const validOperator: bookingEngine.InhouseBookingOperator = {
      authUserId: "user-123",
      staff: {
        id: "staff-123",
        branch_id: "branch-abc",
        system_role: "front_desk",
      },
      staffRole: "front_desk",
    };

    it("returns 400 for invalid JSON syntax in request body", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-123" },
      });

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: "invalid-json{",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Invalid JSON payload.",
      });
    });

    it("maps domain validation failure to 400", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-123" },
      });

      vi.mocked(bookingEngine.executeInhouseBookingCreation).mockResolvedValueOnce({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Please enter a valid Philippine mobile number (09xx or +639xx).",
      });

      const payload = {
        fullName: "Test Guest",
        phone: "123",
        serviceIds: ["service-1"],
        date: "2026-09-10",
        startTime: "10:00",
        type: "in_spa",
      };

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Please enter a valid Philippine mobile number (09xx or +639xx).",
      });
      expect(bookingEngine.executeInhouseBookingCreation).toHaveBeenCalledWith(
        payload,
        validOperator
      );
    });

    it("maps branch rules error to 400", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-123" },
      });

      vi.mocked(bookingEngine.executeInhouseBookingCreation).mockResolvedValueOnce({
        ok: false,
        code: "BOOKING_RULES_ERROR",
        message: "The selected time is outside branch booking hours.",
      });

      const payload = {
        fullName: "Test Guest",
        phone: "09171234567",
        serviceIds: ["service-1"],
        date: "2026-09-10",
        startTime: "06:00",
        type: "in_spa",
      };

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "BOOKING_RULES_ERROR",
        message: "The selected time is outside branch booking hours.",
      });
    });

    it("maps cross-branch forbidden error to 403", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-123" },
      });

      vi.mocked(bookingEngine.executeInhouseBookingCreation).mockResolvedValueOnce({
        ok: false,
        code: "CRM_BRANCH_FORBIDDEN",
        message: "You can only create bookings for your assigned branch.",
      });

      const payload = {
        branchId: "different-branch-xyz",
        fullName: "Test Guest",
        phone: "09171234567",
        serviceIds: ["service-1"],
        date: "2026-09-10",
        startTime: "10:00",
        type: "in_spa",
      };

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "CRM_BRANCH_FORBIDDEN",
        message: "You can only create bookings for your assigned branch.",
      });
    });

    it("maps slot / resource conflict to 409", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-123" },
      });

      vi.mocked(bookingEngine.executeInhouseBookingCreation).mockResolvedValueOnce({
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "That therapist or room was just booked. Please choose another available option.",
      });

      const payload = {
        fullName: "Test Guest",
        phone: "09171234567",
        serviceIds: ["service-1"],
        date: "2026-09-10",
        startTime: "10:00",
        type: "in_spa",
      };

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "That therapist or room was just booked. Please choose another available option.",
      });
    });

    it("maps unknown domain error to 500", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-123" },
      });

      vi.mocked(bookingEngine.executeInhouseBookingCreation).mockResolvedValueOnce({
        ok: false,
        code: "BOOKING_INSERT_FAILED",
        message: "Could not create booking. Please select a different time.",
      });

      const payload = {
        fullName: "Test Guest",
        phone: "09171234567",
        serviceIds: ["service-1"],
        date: "2026-09-10",
        startTime: "10:00",
        type: "in_spa",
      };

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "BOOKING_INSERT_FAILED",
        message: "Could not create booking. Please select a different time.",
      });
    });

    it("returns 500 UNKNOWN_ERROR on unexpected execution exception", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-123" },
      });

      vi.mocked(bookingEngine.executeInhouseBookingCreation).mockRejectedValueOnce(
        new Error("Fatal crash in engine")
      );

      const payload = {
        fullName: "Test Guest",
        phone: "09171234567",
        serviceIds: ["service-1"],
        date: "2026-09-10",
        startTime: "10:00",
        type: "in_spa",
      };

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Could not create booking. Please try again.",
      });
    });

    it("returns 200 with bookingId and optional warning on success", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-123" },
      });

      vi.mocked(bookingEngine.executeInhouseBookingCreation).mockResolvedValueOnce({
        ok: true,
        bookingId: "booking-uuid-999",
        warning: "Provider shift warning",
      });

      const payload = {
        fullName: "Test Guest",
        phone: "09171234567",
        serviceIds: ["service-1"],
        date: "2026-09-10",
        startTime: "10:00",
        type: "in_spa",
      };

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/bookings", {
        method: "POST",
        headers: { Authorization: "Bearer valid-token" },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        ok: true,
        bookingId: "booking-uuid-999",
        warning: "Provider shift warning",
      });
      // Verify no sensitive token or credentials returned
      expect(json).not.toHaveProperty("token");
      expect(json).not.toHaveProperty("service_role");
    });
  });

  describe("Server Action and API Shared Domain Architecture", () => {
    it("proves createInhouseBookingMultiAction delegates to executeInhouseBookingCreation", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "cookie-user-456" } },
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "cookie-staff-456",
                    branch_id: "branch-cookie-1",
                    system_role: "manager",
                  },
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(supabaseServer.createClient).mockResolvedValueOnce(
        mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
      );

      vi.mocked(bookingEngine.executeInhouseBookingCreation).mockResolvedValueOnce({
        ok: true,
        bookingId: "action-booking-123",
      });

      const input = {
        fullName: "Action Guest",
        phone: "09170000000",
        serviceIds: ["srv-1"],
        date: "2026-09-15",
        startTime: "14:00",
        type: "in_spa",
      };

      const result = await createInhouseBookingMultiAction(input);

      expect(result).toEqual({
        ok: true,
        bookingId: "action-booking-123",
      });

      expect(bookingEngine.executeInhouseBookingCreation).toHaveBeenCalledWith(input, {
        authUserId: "cookie-user-456",
        staff: {
          id: "cookie-staff-456",
          branch_id: "branch-cookie-1",
          system_role: "manager",
        },
        staffRole: "manager",
      });
    });
  });
});
