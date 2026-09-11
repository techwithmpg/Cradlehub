vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/desktop-bearer-auth", () => ({
  verifyDesktopBearerAuth: vi.fn(),
}));

vi.mock("@/lib/bookings/crm-booking-operations", () => ({
  confirmCrmBooking: vi.fn(),
  markCrmBookingArrived: vi.fn(),
  startCrmBookingService: vi.fn(),
  completeCrmBookingService: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import {
  confirmCrmBooking,
  markCrmBookingArrived,
  startCrmBookingService,
  completeCrmBookingService,
} from "@/lib/bookings/crm-booking-operations";
import { POST } from "./route";

const mockedAuth = vi.mocked(verifyDesktopBearerAuth);
const mockedConfirm = vi.mocked(confirmCrmBooking);
const mockedArrive = vi.mocked(markCrmBookingArrived);
const mockedStart = vi.mocked(startCrmBookingService);
const mockedComplete = vi.mocked(completeCrmBookingService);

function authResult(branchId: string | null = "branch-main") {
  return {
    ok: true as const,
    operator: {
      authUserId: "user-1",
      staff: {
        id: "staff-1",
        branch_id: branchId,
        system_role: "crm",
      },
      staffRole: "crm",
      isDevBypass: false,
    },
    user: {
      id: "user-1",
      email: "crm@example.test",
    },
    client: {
      from: vi.fn(),
    },
  };
}

function request(body: unknown) {
  return new NextRequest("https://example.test/api/desktop/v1/today/mutations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const VALID_BOOKING_ID = "11111111-1111-4111-8111-111111111111";

describe("POST /api/desktop/v1/today/mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 23. Malformed action rejected
  it("rejects malformed action with 400", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);

    const response = await POST(
      request({
        action: "unknown_action",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects invalid booking UUID with 400", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);

    const response = await POST(
      request({
        action: "confirm_booking",
        bookingId: "invalid-uuid",
      })
    );

    expect(response.status).toBe(400);
    expect(mockedConfirm).not.toHaveBeenCalled();
  });

  // 24. Wrong-branch rejected
  it("rejects mutation when booking belongs to another branch (403)", async () => {
    mockedAuth.mockResolvedValue(authResult("branch-main") as never);
    mockedConfirm.mockResolvedValue({
      success: false,
      code: "booking_wrong_branch",
      error: "Booking belongs to another branch.",
    });

    const response = await POST(
      request({
        action: "confirm_booking",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      code: "booking_wrong_branch",
      message: "Booking belongs to another branch.",
    });
  });

  // 25. Confirm valid path
  it("confirms booking successfully on valid path (200)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedConfirm.mockResolvedValue({ success: true });

    const response = await POST(
      request({
        action: "confirm_booking",
        bookingId: VALID_BOOKING_ID,
        note: "Customer confirmed via phone call.",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: {},
    });
    expect(mockedConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        me: expect.objectContaining({ branch_id: "branch-main" }),
      }),
      {
        action: "confirm_booking",
        bookingId: VALID_BOOKING_ID,
        note: "Customer confirmed via phone call.",
      }
    );
  });

  // 26. Confirm invalid status rejected
  it("rejects confirm when booking is in invalid status (409)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedConfirm.mockResolvedValue({
      success: false,
      error: "Completed bookings cannot be confirmed.",
    });

    const response = await POST(
      request({
        action: "confirm_booking",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      message: "Completed bookings cannot be confirmed.",
    });
  });

  // 27. Mark-arrived valid path
  it("marks booking arrived successfully on valid path (200)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedArrive.mockResolvedValue({ success: true });

    const response = await POST(
      request({
        action: "mark_arrived",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: {},
    });
    expect(mockedArrive).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "mark_arrived",
        bookingId: VALID_BOOKING_ID,
      })
    );
  });

  // 28. Mark-arrived Home Service rejected
  it("rejects mark-arrived for Home Service bookings (409)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedArrive.mockResolvedValue({
      success: false,
      error: "Customer arrival is only used for in-spa bookings.",
    });

    const response = await POST(
      request({
        action: "mark_arrived",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      message: "Customer arrival is only used for in-spa bookings.",
    });
  });

  // 29. Start-service valid path
  it("starts service successfully on valid path (200)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedStart.mockResolvedValue({ success: true });

    const response = await POST(
      request({
        action: "start_service",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: {},
    });
    expect(mockedStart).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "start_service",
        bookingId: VALID_BOOKING_ID,
      })
    );
  });

  // 30. Start-service Home Service rejected
  it("rejects start-service for Home Service bookings (409)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedStart.mockResolvedValue({
      success: false,
      error: "Home-service sessions are started by the assigned staff.",
    });

    const response = await POST(
      request({
        action: "start_service",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      message: "Home-service sessions are started by the assigned staff.",
    });
  });

  // 31. Complete-service valid path
  it("completes service successfully on valid path (200)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedComplete.mockResolvedValue({ success: true });

    const response = await POST(
      request({
        action: "complete_service",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: {},
    });
    expect(mockedComplete).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "complete_service",
        bookingId: VALID_BOOKING_ID,
      })
    );
  });

  // 32. Completion idempotency where authoritative
  it("returns 200 when complete-service is invoked idempotently on already-completed booking", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedComplete.mockResolvedValue({ success: true });

    const response = await POST(
      request({
        action: "complete_service",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: {} });
  });

  // 33. Closed booking rejected where appropriate
  it("rejects operations on closed (cancelled/no_show) bookings (409)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedStart.mockResolvedValue({
      success: false,
      error: "This booking is already closed.",
    });

    const response = await POST(
      request({
        action: "start_service",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      message: "This booking is already closed.",
    });
  });

  // 34 & 35. Authoritative operation failure remains failure; no simulated success
  it("fails truthfully when backend operation fails", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);
    mockedStart.mockResolvedValue({
      success: false,
      code: "booking_load_failed",
      error: "Database error occurred.",
    });

    const response = await POST(
      request({
        action: "start_service",
        bookingId: VALID_BOOKING_ID,
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: "booking_load_failed",
    });
  });

  // 36. Payment mutation rejected (and other dormant actions)
  it("strictly rejects payment mutations (collect_payment, confirm_payment, update_payment)", async () => {
    mockedAuth.mockResolvedValue(authResult() as never);

    const paymentActions = ["collect_payment", "confirm_payment", "update_payment"];

    for (const action of paymentActions) {
      const response = await POST(
        request({
          action,
          bookingId: VALID_BOOKING_ID,
        })
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        ok: false,
        code: "VALIDATION_ERROR",
      });
    }

    expect(mockedConfirm).not.toHaveBeenCalled();
    expect(mockedArrive).not.toHaveBeenCalled();
    expect(mockedStart).not.toHaveBeenCalled();
    expect(mockedComplete).not.toHaveBeenCalled();
  });
});
