import { describe, expect, it, vi } from "vitest";
import { getCrmUpcomingBookings } from "@/lib/queries/bookings";
import { isUpcomingBookingDate, upcomingBookingEndDate } from "@/lib/bookings/upcoming-bookings";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

vi.mock("server-only", () => ({}));

describe("CRM upcoming booking contract", () => {
  it("uses the established 14-day branch business-date window", () => {
    expect(upcomingBookingEndDate("2026-10-13")).toBe("2026-10-27");
    expect(isUpcomingBookingDate("2026-10-13", "2026-10-13")).toBe(false);
    expect(isUpcomingBookingDate("2026-10-16", "2026-10-13")).toBe(true);
    expect(isUpcomingBookingDate("2026-10-28", "2026-10-13")).toBe(false);
  });

  it("constrains and orders the canonical query on the server", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      gt: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi.fn(async () => ({ data: [], error: null })),
    };
    for (const method of ["select", "eq", "gt", "lte", "in", "order"] as const) {
      query[method].mockReturnValue(query);
    }
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>;
    expect(await getCrmUpcomingBookings("branch-a", "2026-10-13", client)).toEqual([]);
    expect(client.from).toHaveBeenCalledWith("bookings");
    expect(query.eq).toHaveBeenCalledWith("branch_id", "branch-a");
    expect(query.gt).toHaveBeenCalledWith("booking_date", "2026-10-13");
    expect(query.lte).toHaveBeenCalledWith("booking_date", "2026-10-27");
    expect(query.in).toHaveBeenCalledWith("status", [
      "pending",
      "pending_payment",
      "pending_crm_confirmation",
      "confirmed",
      "in_progress",
    ]);
    expect(query.order.mock.calls.map(([column]) => column)).toEqual([
      "booking_date",
      "start_time",
      "id",
    ]);
    expect(query.range).toHaveBeenCalledWith(0, 499);
  });
});
