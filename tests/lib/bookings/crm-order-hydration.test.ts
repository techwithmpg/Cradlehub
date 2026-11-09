import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getCrmBookingsOperationalData } from "@/lib/queries/crm-bookings-operational";

vi.mock("server-only", () => ({}));

const queries = vi.hoisted(() => ({
  getCrmBookingsCommandCenterRows: vi.fn(),
  getCrmUpcomingBookings: vi.fn(),
  getCrmOrderServiceLines: vi.fn(),
  getDailyPaymentSummary: vi.fn(),
  getWaitlistAction: vi.fn(),
  getRef: vi.fn(),
}));

vi.mock("@/lib/queries/bookings", () => ({
  getCrmBookingsCommandCenterRows: queries.getCrmBookingsCommandCenterRows,
  getCrmUpcomingBookings: queries.getCrmUpcomingBookings,
  getCrmOrderServiceLines: queries.getCrmOrderServiceLines,
  getDailyPaymentSummary: queries.getDailyPaymentSummary,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    throw new Error("Test must use its explicitly supplied scoped client");
  }),
}));
vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: () => "2026-11-09",
}));
vi.mock("@/app/(dashboard)/crm/waitlist/actions", () => ({
  getWaitlistAction: queries.getWaitlistAction,
}));

function scopedClient(): SupabaseClient<Database> {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: queries.getRef,
          }),
        }),
        in: async () => ({
          data: table === "v_booking_order_financial_summaries"
            ? [{ order_id: "order-one", total_payable: 1500, net_allocated: 0, payment_state: "unpaid" }]
            : [{ id: "order-one", metadata: { total_amount: 1500 } }],
          error: null,
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

function booking(id: string, date: string, orderId = "order-one") {
  return {
    id,
    order_id: orderId,
    branch_id: "branch-a",
    booking_date: date,
    start_time: "10:00:00",
    end_time: "11:10:00",
    status: "confirmed",
    type: "online",
    metadata: { price_paid: 750 },
  };
}

describe("CRM booking order representation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.getRef.mockResolvedValue({
      data: { booking_date: "2026-11-09", branch_id: "branch-a", order_id: "order-one" },
      error: null,
    });
    queries.getDailyPaymentSummary.mockResolvedValue(null);
    queries.getWaitlistAction.mockResolvedValue({ ok: true, data: [] });
    queries.getCrmUpcomingBookings.mockResolvedValue([]);
  });

  it("loads all lines of a selected order even when another line was rescheduled to a different day", async () => {
    const primary = booking("booking-one", "2026-11-09");
    const moved = booking("booking-two", "2026-11-10");
    queries.getCrmBookingsCommandCenterRows.mockResolvedValue([primary]);
    queries.getCrmOrderServiceLines.mockResolvedValue([primary, moved]);

    const client = scopedClient();
    const data = await getCrmBookingsOperationalData({
      branchId: "branch-a", branchName: "Main", role: "crm",
      bookingId: "booking-one", client,
    });

    expect(queries.getCrmOrderServiceLines).toHaveBeenCalledWith("branch-a", ["order-one"], client);
    expect(data.bookings.map((row) => row.id)).toEqual(["booking-one", "booking-two"]);
    expect(data.bookings[1]?.booking_date).toBe("2026-11-10");
    expect(data.bookings.every((row) => row.order_payment_status === "unpaid")).toBe(true);
  });

  it("rejects a selected booking from a different branch before reading its order", async () => {
    queries.getRef.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(getCrmBookingsOperationalData({
      branchId: "branch-a", branchName: "Main", role: "crm",
      bookingId: "another-branch-booking", client: scopedClient(),
    })).rejects.toThrow("Booking is unavailable for this branch.");

    expect(queries.getCrmOrderServiceLines).not.toHaveBeenCalled();
    expect(queries.getCrmBookingsCommandCenterRows).not.toHaveBeenCalled();
  });

  it("preserves daily date scope when no booking was explicitly selected", async () => {
    queries.getCrmBookingsCommandCenterRows.mockResolvedValue([booking("booking-one", "2026-11-09")]);

    const data = await getCrmBookingsOperationalData({
      branchId: "branch-a", branchName: "Main", role: "crm",
      client: scopedClient(),
    });

    expect(queries.getCrmOrderServiceLines).not.toHaveBeenCalled();
    expect(data.bookings).toHaveLength(1);
    expect(data.date).toBe("2026-11-09");
  });

  it("preserves eligible Upcoming order hydration and avoids duplicate service lines", async () => {
    queries.getRef.mockResolvedValue({
      data: { booking_date: "2026-11-12", branch_id: "branch-a", order_id: "order-one" },
      error: null,
    });
    const selected = booking("booking-one", "2026-11-12");
    queries.getCrmUpcomingBookings.mockResolvedValue([
      booking("other-booking", "2026-11-12", "order-two"), selected,
    ]);
    queries.getCrmOrderServiceLines.mockResolvedValue([
      selected, booking("sibling-booking", "2026-11-14"),
    ]);

    const client = scopedClient();
    const data = await getCrmBookingsOperationalData({
      branchId: "branch-a", branchName: "Main", role: "crm",
      bookingId: "booking-one", upcoming: true, client,
    });

    expect(queries.getCrmOrderServiceLines).toHaveBeenCalledWith(
      "branch-a", ["order-two", "order-one"], client
    );
    expect(data.bookings.map((row) => row.id)).toEqual([
      "other-booking", "booking-one", "sibling-booking",
    ]);
  });

  it("does not surface a selected excluded booking in Upcoming", async () => {
    queries.getRef.mockResolvedValue({
      data: { booking_date: "2026-11-12", branch_id: "branch-a", order_id: "order-one" },
      error: null,
    });
    queries.getCrmUpcomingBookings.mockResolvedValue([]);

    const data = await getCrmBookingsOperationalData({
      branchId: "branch-a", branchName: "Main", role: "crm",
      bookingId: "booking-one", upcoming: true, client: scopedClient(),
    });

    expect(data.bookings).toHaveLength(0);
    expect(queries.getCrmOrderServiceLines).not.toHaveBeenCalled();
  });

  it("validates a far-future deep link before expanding its complete order", async () => {
    queries.getRef.mockResolvedValue({
      data: { booking_date: "2026-12-05", branch_id: "branch-a", order_id: "order-one" },
      error: null,
    });
    queries.getCrmBookingsCommandCenterRows.mockResolvedValue([
      booking("booking-one", "2026-12-05"),
    ]);
    queries.getCrmOrderServiceLines.mockResolvedValue([
      booking("booking-one", "2026-12-05"),
      booking("sibling-booking", "2026-12-06"),
    ]);

    const data = await getCrmBookingsOperationalData({
      branchId: "branch-a", branchName: "Main", role: "crm",
      bookingId: "booking-one", upcoming: true, client: scopedClient(),
    });

    expect(data.selectedOutsideWindow).toBe(true);
    expect(data.bookings.map((row) => row.id)).toEqual([
      "booking-one", "sibling-booking",
    ]);
  });
});
