import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getCrmBookingsOperationalData } from "@/lib/queries/crm-bookings-operational";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  today: "2026-11-09",
  daily: vi.fn(),
  upcoming: vi.fn(),
  overdue: vi.fn(),
  orderLines: vi.fn(),
  cash: vi.fn(),
  waitlist: vi.fn(),
}));

vi.mock("@/lib/engine/slot-time", () => ({
  getBranchBusinessDate: () => mocks.today,
}));
vi.mock("@/lib/queries/bookings", () => ({
  getCrmBookingsCommandCenterRows: mocks.daily,
  getCrmUpcomingBookings: mocks.upcoming,
  getCrmOverduePendingBookings: mocks.overdue,
  getCrmOrderServiceLines: mocks.orderLines,
  getDailyPaymentSummary: mocks.cash,
}));
vi.mock("@/app/(dashboard)/crm/waitlist/actions", () => ({
  getWaitlistAction: mocks.waitlist,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("Admin access not permitted in this test");
  },
}));

const oldRequest = {
  id: "past-booking",
  booking_date: "2026-10-13",
  order_id: null,
  branch_id: "branch-a",
  status: "pending_crm_confirmation",
  start_time: "14:00:00",
  end_time: "15:00:00",
};

function scopedClient(): SupabaseClient<Database> {
  return {} as SupabaseClient<Database>;
}

describe("CRM overdue pending review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.overdue.mockResolvedValue([oldRequest]);
    mocks.daily.mockResolvedValue([]);
    mocks.upcoming.mockResolvedValue([]);
    mocks.orderLines.mockResolvedValue([]);
    mocks.cash.mockResolvedValue(null);
    mocks.waitlist.mockResolvedValue({ ok: true, data: [] });
  });

  it("retrieves historic unresolved requests only by explicit overdue review mode", async () => {
    const client = scopedClient();
    const data = await getCrmBookingsOperationalData({
      branchId: "branch-a",
      branchName: "Main",
      role: "crm",
      overdue: true,
      client,
    });

    expect(mocks.overdue).toHaveBeenCalledTimes(1);
    expect(mocks.overdue).toHaveBeenCalledWith("branch-a", "2026-11-09", client);
    expect(mocks.daily).not.toHaveBeenCalled();
    expect(mocks.upcoming).not.toHaveBeenCalled();
    expect(data.reviewingOverdue).toBe(true);
    expect(data.bookings.map((row) => row.id)).toEqual(["past-booking"]);
  });

  it("leaves default daily operational scope unchanged", async () => {
    const data = await getCrmBookingsOperationalData({
      branchId: "branch-a",
      branchName: "Main",
      role: "crm",
      client: scopedClient(),
    });

    expect(mocks.overdue).not.toHaveBeenCalled();
    expect(mocks.daily).toHaveBeenCalledWith("branch-a", "2026-11-09");
    expect(data.bookings).toHaveLength(0);
    expect(data.reviewingOverdue).toBe(false);
  });
});
