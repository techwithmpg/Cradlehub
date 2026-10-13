import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  admin: vi.fn(),
  schedule: vi.fn(),
  upcoming: vi.fn(),
  cash: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries/crm-context", () => ({ getFrontDeskContext: mocks.context }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/queries/bookings", () => ({
  getCrmBookingsCommandCenterRows: mocks.schedule,
  getCrmUpcomingBookings: mocks.upcoming,
  getDailyPaymentSummary: mocks.cash,
}));
vi.mock("@/lib/engine/slot-time", () => ({ getBranchBusinessDate: () => "2026-10-13" }));
vi.mock("@/app/(dashboard)/crm/waitlist/actions", () => ({
  getWaitlistAction: vi.fn(async () => ({ ok: true, data: [] })),
}));
vi.mock("@/app/(dashboard)/manager/bookings/actions", () => ({
  updateBookingPaymentAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/crm/bookings/actions", () => ({ confirmBookingPaymentAction: vi.fn() }));
vi.mock("@/components/features/bookings/crm-bookings-view", () => ({
  CrmBookingsView: () => null,
}));
vi.mock("@/components/features/dashboard/retained-workspace-provider", () => ({
  RetainedWorkspaceModule: () => null,
}));

import CrmBookingsPage from "@/app/(dashboard)/crm/bookings/page";

function adminLookup(row: { booking_date: string; branch_id: string } | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.admin.mockReturnValue({ from: vi.fn(() => query) });
  return query;
}

describe("CRM Bookings date context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue({ branchId: "branch-a", branchName: "Main", role: "crm" });
    mocks.schedule.mockResolvedValue([]);
    mocks.upcoming.mockResolvedValue([]);
    mocks.cash.mockResolvedValue(null);
  });

  it("resolves a notification booking ID to its actual same-branch date", async () => {
    const query = adminLookup({ booking_date: "2026-10-16", branch_id: "branch-a" });
    const page = await CrmBookingsPage({
      searchParams: Promise.resolve({ bookingId: "future-1" }),
    });
    expect(query.eq).toHaveBeenCalledWith("branch_id", "branch-a");
    expect(mocks.schedule).toHaveBeenCalledWith("branch-a", "2026-10-16");
    expect(page.props.children.props.initialData.date).toBe("2026-10-16");
  });

  it("does not resolve a cross-branch booking date", async () => {
    adminLookup({ booking_date: "2026-10-16", branch_id: "branch-b" });
    const page = await CrmBookingsPage({ searchParams: Promise.resolve({ bookingId: "outside" }) });
    expect(mocks.schedule).toHaveBeenCalledWith("branch-a", "2026-10-13");
    expect(page.props.children.props.initialData.date).toBe("2026-10-13");
  });

  it("loads multi-date Upcoming from the branch business date", async () => {
    await CrmBookingsPage({
      searchParams: Promise.resolve({ tab: "upcoming", date: "2026-10-11" }),
    });
    expect(mocks.upcoming).toHaveBeenCalledWith("branch-a", "2026-10-13");
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});
