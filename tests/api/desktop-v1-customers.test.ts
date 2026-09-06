import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as listHandler } from "@/app/api/desktop/v1/customers/route";
import { GET as detailHandler } from "@/app/api/desktop/v1/customers/[customerId]/route";
import * as bearerAuth from "@/lib/auth/desktop-bearer-auth";
import * as customerEngine from "@/lib/customers/desktop-customer-engine";
import type { InhouseBookingOperator } from "@/lib/bookings/inhouse-booking-engine";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/customers/desktop-customer-engine", () => ({
  executeDesktopCustomerList: vi.fn(),
  executeDesktopCustomerDetail: vi.fn(),
}));

const BRANCH_AAA = "11111111-1111-1111-1111-111111111111";
const CUSTOMER_1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STAFF_1 = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("Desktop v1 Customers API Boundary", () => {
  const validOperator: InhouseBookingOperator = {
    authUserId: "user-manager",
    staff: {
      id: STAFF_1,
      branch_id: BRANCH_AAA,
      system_role: "manager",
    },
    staffRole: "manager",
    isDevBypass: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/desktop/v1/customers (List)", () => {
    it("returns 401 when Bearer authentication fails", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Authorization header is required.",
      });

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/customers");
      const res = await listHandler(req);

      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Authorization header is required.",
      });
    });

    it("maps CRM_BRANCH_FORBIDDEN to 403", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-manager" },
      });

      vi.mocked(customerEngine.executeDesktopCustomerList).mockResolvedValueOnce({
        ok: false,
        code: "CRM_BRANCH_FORBIDDEN",
        message: "You can only access customers for your assigned branch.",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/desktop/v1/customers?branchId=22222222-2222-2222-2222-222222222222"
      );
      const res = await listHandler(req);

      expect(res.status).toBe(403);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "CRM_BRANCH_FORBIDDEN",
        message: "You can only access customers for your assigned branch.",
      });
    });

    it("maps BRANCH_NOT_FOUND to 400", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-manager" },
      });

      vi.mocked(customerEngine.executeDesktopCustomerList).mockResolvedValueOnce({
        ok: false,
        code: "BRANCH_NOT_FOUND",
        message: "Selected branch was not found.",
      });

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/customers");
      const res = await listHandler(req);

      expect(res.status).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "BRANCH_NOT_FOUND",
        message: "Selected branch was not found.",
      });
    });

    it("returns 500 UNKNOWN_ERROR when unhandled exception occurs", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-manager" },
      });

      vi.mocked(customerEngine.executeDesktopCustomerList).mockRejectedValueOnce(
        new Error("Unexpected crash")
      );

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/customers");
      const res = await listHandler(req);

      expect(res.status).toBe(500);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Could not load customers. Please try again.",
      });
    });

    it("returns 200 with customer list data and kpis on success", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-manager" },
      });

      const expectedResponse: customerEngine.DesktopCustomerListResult = {
        ok: true,
        tab: "all",
        data: [
          {
            id: CUSTOMER_1,
            fullName: "Juan Dela Cruz",
            phone: "09171112233",
            email: "juan@example.com",
            totalBookings: 3,
            firstBookingDate: "2026-01-01",
            lastBookingDate: "2026-09-01",
            preferredStaffId: STAFF_1,
            preferredStaffName: "May",
          },
        ],
        waitlist: [],
        pagination: {
          page: 1,
          pageSize: 25,
          totalCount: 1,
          totalPages: 1,
        },
        kpis: {
          totalCustomers: 1,
          repeatClients: 1,
          lapsedClients: 0,
          newThisMonth: 0,
          totalVisits: 3,
        },
      };

      vi.mocked(customerEngine.executeDesktopCustomerList).mockResolvedValueOnce(expectedResponse);

      const req = new NextRequest("http://localhost:3000/api/desktop/v1/customers?tab=all&page=1");
      const res = await listHandler(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const json = await res.json();
      expect(json).toEqual(expectedResponse);
    });
  });

  describe("GET /api/desktop/v1/customers/[customerId] (Detail)", () => {
    it("returns 401 when Bearer authentication fails", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: false,
        status: 401,
        code: "UNAUTHORIZED",
        message: "Authorization header is required.",
      });

      const req = new NextRequest(`http://localhost:3000/api/desktop/v1/customers/${CUSTOMER_1}`);
      const res = await detailHandler(req, {
        params: Promise.resolve({ customerId: CUSTOMER_1 }),
      });

      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Authorization header is required.",
      });
    });

    it("maps CUSTOMER_NOT_FOUND to 404", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-manager" },
      });

      vi.mocked(customerEngine.executeDesktopCustomerDetail).mockResolvedValueOnce({
        ok: false,
        code: "CUSTOMER_NOT_FOUND",
        message: "Customer not found or has no bookings at this branch.",
      });

      const req = new NextRequest(`http://localhost:3000/api/desktop/v1/customers/${CUSTOMER_1}`);
      const res = await detailHandler(req, {
        params: Promise.resolve({ customerId: CUSTOMER_1 }),
      });

      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const json = await res.json();
      expect(json).toEqual({
        ok: false,
        code: "CUSTOMER_NOT_FOUND",
        message: "Customer not found or has no bookings at this branch.",
      });
    });

    it("returns 200 with customer profile and booking history on success", async () => {
      vi.mocked(bearerAuth.verifyDesktopBearerAuth).mockResolvedValueOnce({
        ok: true,
        operator: validOperator,
        user: { id: "user-manager" },
      });

      const expectedResponse: customerEngine.DesktopCustomerDetailResult = {
        ok: true,
        customer: {
          id: CUSTOMER_1,
          fullName: "Juan Dela Cruz",
          phone: "09171112233",
          email: "juan@example.com",
          firstBookingDate: "2026-01-01",
          lastBookingDate: "2026-09-01",
          totalBookings: 5,
          notes: "VIP Client",
          preferredStaffId: STAFF_1,
          preferredStaffName: "May",
          preferredVisitType: "in_spa",
          pressurePreference: null,
          healthNotes: "Lower back tension",
          birthday: "1990-05-15",
          loyaltyTier: "gold",
        },
        bookingHistory: [
          {
            id: "booking-1",
            bookingDate: "2026-09-01",
            startTime: "10:00:00",
            status: "completed",
            type: "in_spa",
            serviceName: "Swedish Massage",
            staffName: "May",
            branchName: "CradleHub BGC",
          },
        ],
      };

      vi.mocked(customerEngine.executeDesktopCustomerDetail).mockResolvedValueOnce(
        expectedResponse
      );

      const req = new NextRequest(`http://localhost:3000/api/desktop/v1/customers/${CUSTOMER_1}`);
      const res = await detailHandler(req, {
        params: Promise.resolve({ customerId: CUSTOMER_1 }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const json = await res.json();
      expect(json).toEqual(expectedResponse);
    });
  });
});
