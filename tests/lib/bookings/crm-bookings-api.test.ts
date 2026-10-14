import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  createClient: vi.fn(),
  schedule: vi.fn(),
  upcoming: vi.fn(),
  cash: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/get-api-context", () => ({ getCrmApiContext: mocks.context }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/queries/bookings", () => ({
  getCrmBookingsCommandCenterRows: mocks.schedule,
  getCrmUpcomingBookings: mocks.upcoming,
  getDailyPaymentSummary: mocks.cash,
}));
vi.mock("@/app/(dashboard)/crm/waitlist/actions", () => ({
  getWaitlistAction: vi.fn(async () => ({ ok: true, data: [] })),
}));
vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: () => "2026-10-13",
  addDaysToYmd: (ymd: string, days: number) =>
    new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10),
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { GET } from "@/app/api/crm/bookings/route";

function lookup(row: { booking_date: string } | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.createClient.mockResolvedValue({ from: vi.fn(() => query) });
  return query;
}

describe("CRM bookings API future selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue({
      ok: true,
      context: { branchId: "branch-a", branchName: "Main", role: "crm" },
    });
    mocks.schedule.mockResolvedValue([]);
    mocks.upcoming.mockResolvedValue([]);
    mocks.cash.mockResolvedValue(null);
  });

  it("keeps a branch-authorized exact selection beyond 14 days", async () => {
    const query = lookup({ booking_date: "2026-10-30" });
    mocks.schedule.mockResolvedValue([
      {
        id: "far-future",
        booking_date: "2026-10-30",
        status: "confirmed",
        booking_progress_status: "not_started",
      },
    ]);
    const response = await GET(
      new NextRequest("http://localhost/api/crm/bookings?tab=upcoming&bookingId=far-future")
    );
    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("branch_id", "branch-a");
    expect(await response.json()).toMatchObject({
      selectedOutsideWindow: true,
      bookings: [{ id: "far-future" }],
    });
  });

  it("does not substitute Today when the booking is outside the branch", async () => {
    lookup(null);
    const response = await GET(
      new NextRequest("http://localhost/api/crm/bookings?bookingId=outside")
    );
    expect(response.status).toBe(404);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});
