import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getFrontDeskContext: vi.fn(),
  getBranchBusinessDate: vi.fn(() => "2026-10-13"),
  getCrmBookingsCommandCenterRows: vi.fn(),
  getCrmUpcomingBookings: vi.fn(),
  getCrmOrderServiceLines: vi.fn(),
  getDailyPaymentSummary: vi.fn(),
  getWaitlistAction: vi.fn(async () => ({ ok: true, data: [] as Array<Record<string, unknown>> })),
  createAdminClient: vi.fn(),
  upcomingBookingEndDate: vi.fn(() => "2026-10-27"),
}));

vi.mock("@/lib/queries/crm-context", () => ({
  getFrontDeskContext: mocks.getFrontDeskContext,
}));
vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: mocks.getBranchBusinessDate,
  addDaysToYmd: (ymd: string, days: number) =>
    new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10),
}));
vi.mock("@/lib/queries/bookings", () => ({
  getCrmBookingsCommandCenterRows: mocks.getCrmBookingsCommandCenterRows,
  getCrmUpcomingBookings: mocks.getCrmUpcomingBookings,
  getCrmOrderServiceLines: mocks.getCrmOrderServiceLines,
  getDailyPaymentSummary: mocks.getDailyPaymentSummary,
}));
vi.mock("@/app/(dashboard)/crm/waitlist/actions", () => ({
  getWaitlistAction: mocks.getWaitlistAction,
}));
vi.mock("@/lib/bookings/upcoming-bookings", () => ({
  upcomingBookingEndDate: mocks.upcomingBookingEndDate,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { getCrmBookingsOperationalData } from "@/lib/queries/crm-bookings-operational";
import { refreshCrmBookingsOperationalDataAction } from "@/app/(dashboard)/crm/bookings/actions";
import type { WaitlistRow } from "@/components/features/crm/customers/waitlist-followup-table";

function setupAdminMock(options?: {
  bookingRef?: { booking_date: string; branch_id: string; order_id?: string } | null;
  summaries?: Array<{
    order_id: string;
    total_payable: number;
    net_allocated: number;
    payment_state: string;
  }>;
  orders?: Array<{ id: string; metadata: { total_amount?: number } }>;
}) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: options?.bookingRef !== undefined ? options.bookingRef : null,
      error: null,
    })),
  };

  mocks.createAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "bookings") {
        return query;
      }
      if (table === "v_booking_order_financial_summaries") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn(async () => ({
              data: options?.summaries ?? [],
              error: null,
            })),
          }),
        };
      }
      if (table === "booking_orders") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn(async () => ({
              data: options?.orders ?? [],
              error: null,
            })),
          }),
        };
      }
      return query;
    }),
  });

  return query;
}

describe("CRM Bookings canonical operational builder & server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFrontDeskContext.mockResolvedValue({
      userId: "user-1",
      role: "crm",
      branchId: "branch-a",
      branchName: "Main Branch",
    });
    mocks.getCrmBookingsCommandCenterRows.mockResolvedValue([]);
    mocks.getCrmUpcomingBookings.mockResolvedValue([]);
    mocks.getCrmOrderServiceLines.mockResolvedValue([]);
    mocks.getDailyPaymentSummary.mockResolvedValue(null);
    setupAdminMock();
  });

  it("server action derives branch strictly from Front Desk context and ignores client override", async () => {
    mocks.getCrmBookingsCommandCenterRows.mockResolvedValue([
      { id: "b-1", branch_id: "branch-a", booking_date: "2026-10-13", status: "confirmed" },
    ]);

    const result = await refreshCrmBookingsOperationalDataAction({ date: "2026-10-13" });

    expect(mocks.getFrontDeskContext).toHaveBeenCalled();
    expect(mocks.getCrmBookingsCommandCenterRows).toHaveBeenCalledWith("branch-a", "2026-10-13");
    expect(result.branchId).toBe("branch-a");
    expect(result.branchName).toBe("Main Branch");
    expect(result.role).toBe("crm");
  });

  it("returns canonical shape with all required operational fields", async () => {
    mocks.getDailyPaymentSummary.mockResolvedValue({
      totalPaid: 500,
      cashOnHand: 200,
    });
    mocks.getWaitlistAction.mockResolvedValue({
      ok: true,
      data: [{ id: "w-1", customer_name: "Jane" } as unknown as WaitlistRow],
    });

    const result = await getCrmBookingsOperationalData({
      branchId: "branch-a",
      branchName: "Main Branch",
      role: "crm",
      date: "2026-10-13",
    });

    expect(result).toHaveProperty("branchId", "branch-a");
    expect(result).toHaveProperty("branchName", "Main Branch");
    expect(result).toHaveProperty("role", "crm");
    expect(result).toHaveProperty("date", "2026-10-13");
    expect(result).toHaveProperty("businessDate", "2026-10-13");
    expect(result).toHaveProperty("selectedOutsideWindow", false);
    expect(result).toHaveProperty("bookings");
    expect(result).toHaveProperty("waitlistRows");
    expect(result).toHaveProperty("cashSummary");
    expect(result.waitlistRows).toHaveLength(1);
    expect(result.cashSummary).toEqual({ totalPaid: 500, cashOnHand: 200 });
  });

  it("upcoming mode loads 14-day upcoming bookings and enriches sibling service lines", async () => {
    mocks.getCrmUpcomingBookings.mockResolvedValue([
      { id: "line-1", order_id: "ord-1", booking_date: "2026-10-15", status: "confirmed" },
    ]);
    mocks.getCrmOrderServiceLines.mockResolvedValue([
      { id: "line-1", order_id: "ord-1", booking_date: "2026-10-15", status: "confirmed" },
      { id: "line-2", order_id: "ord-1", booking_date: "2026-10-15", status: "confirmed" },
    ]);
    setupAdminMock({
      summaries: [
        { order_id: "ord-1", total_payable: 3000, net_allocated: 1500, payment_state: "partial" },
      ],
      orders: [{ id: "ord-1", metadata: { total_amount: 3000 } }],
    });

    const result = await getCrmBookingsOperationalData({
      branchId: "branch-a",
      branchName: "Main Branch",
      role: "crm",
      upcoming: true,
    });

    expect(mocks.getCrmUpcomingBookings).toHaveBeenCalledWith("branch-a", "2026-10-13");
    expect(mocks.getCrmOrderServiceLines).toHaveBeenCalledWith("branch-a", ["ord-1"]);
    expect(result.bookings).toHaveLength(2);
    expect(result.bookings).toContainEqual(
      expect.objectContaining({
        id: "line-1",
        order_total_amount: 3000,
        order_amount_paid: 1500,
        order_payment_status: "partial",
      })
    );
    expect(result.bookings).toContainEqual(
      expect.objectContaining({
        id: "line-2",
        order_total_amount: 3000,
        order_amount_paid: 1500,
        order_payment_status: "partial",
      })
    );
  });

  it("enriches order financial summary with booking_orders metadata total fallback when total_payable is 0", async () => {
    mocks.getCrmBookingsCommandCenterRows.mockResolvedValue([
      { id: "b-1", order_id: "ord-fallback", booking_date: "2026-10-13", status: "confirmed" },
    ]);
    setupAdminMock({
      summaries: [
        { order_id: "ord-fallback", total_payable: 0, net_allocated: 0, payment_state: "unpaid" },
      ],
      orders: [{ id: "ord-fallback", metadata: { total_amount: 1800 } }],
    });

    const result = await getCrmBookingsOperationalData({
      branchId: "branch-a",
      branchName: "Main Branch",
      role: "crm",
      date: "2026-10-13",
    });

    expect(result.bookings[0]).toMatchObject({
      id: "b-1",
      order_total_amount: 1800,
      order_amount_paid: 0,
      order_payment_status: "unpaid",
    });
  });

  it("resolves bookingId date within branch context and rejects cross-branch booking lookup", async () => {
    // Cross-branch booking
    setupAdminMock({
      bookingRef: { booking_date: "2026-10-20", branch_id: "branch-b" },
    });

    await expect(
      getCrmBookingsOperationalData({
        branchId: "branch-a",
        branchName: "Main Branch",
        role: "crm",
        bookingId: "foreign-booking",
      })
    ).rejects.toThrow("Booking is unavailable for this branch.");
  });

  it("preserves outside-Upcoming-window selected booking when deep linked", async () => {
    setupAdminMock({
      bookingRef: { booking_date: "2026-10-30", branch_id: "branch-a" },
    });
    mocks.getCrmBookingsCommandCenterRows.mockResolvedValue([
      {
        id: "far-future",
        booking_date: "2026-10-30",
        status: "confirmed",
        booking_progress_status: "not_started",
      },
    ]);

    const result = await getCrmBookingsOperationalData({
      branchId: "branch-a",
      branchName: "Main Branch",
      role: "crm",
      upcoming: true,
      bookingId: "far-future",
    });

    expect(result.selectedOutsideWindow).toBe(true);
    expect(result.date).toBe("2026-10-30");
    expect(result.bookings).toContainEqual(expect.objectContaining({ id: "far-future" }));
  });
});
