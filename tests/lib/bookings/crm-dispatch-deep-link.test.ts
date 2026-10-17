import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  createClient: vi.fn(),
  getDispatchData: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries/crm-context", () => ({ getFrontDeskContext: mocks.context }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/queries/dispatch-queries", () => ({ getDispatchData: mocks.getDispatchData }));
vi.mock("@/lib/engine/slot-time", () => ({ getBranchBusinessDate: () => "2026-10-13" }));
vi.mock("@/lib/logger", () => ({ logInfo: vi.fn() }));
vi.mock("@/components/features/crm/operational/crm-operational-page-shell", () => ({
  CrmOperationalPageShell: () => null,
}));
vi.mock("@/components/features/dispatch/dispatch-workspace", () => ({
  HomeServiceDispatchWorkspace: () => null,
}));

import CrmDispatchPage from "@/app/(dashboard)/crm/dispatch/page";

function bookingLookup(row: { id: string; booking_date: string; delivery_type: string } | null) {
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

describe("CRM Home Service deep link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.mockResolvedValue({ branchId: "branch-a", branchName: "Main", role: "crm" });
    mocks.getDispatchData.mockResolvedValue({
      items: [{ id: "future-1" }],
      today: "2026-10-13",
      alerts: [],
      stats: {},
    });
  });

  it("defaults to Today with no booking reference", async () => {
    await CrmDispatchPage({ searchParams: Promise.resolve({}) });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getDispatchData).toHaveBeenCalledWith({
      branchId: "branch-a",
      date: "2026-10-13",
      upcoming: false,
      throwOnError: true,
    });
  });

  it("opens a same-branch future Home Service booking in Upcoming", async () => {
    const query = bookingLookup({
      id: "future-1",
      booking_date: "2026-10-16",
      delivery_type: "home_service",
    });
    const page = await CrmDispatchPage({
      searchParams: Promise.resolve({ bookingId: "future-1" }),
    });
    expect(query.eq).toHaveBeenCalledWith("branch_id", "branch-a");
    expect(query.eq).toHaveBeenCalledWith("delivery_type", "home_service");
    expect(mocks.getDispatchData).toHaveBeenCalledWith({
      branchId: "branch-a",
      date: "2026-10-13",
      upcoming: true,
      throwOnError: true,
    });
    const workspace = page.props.children?.props?.children ?? page.props.children;
    expect(workspace.props.selectedBookingId).toBe("future-1");
  });

  it("rejects a booking outside the authorized Home Service branch set", async () => {
    bookingLookup(null);
    await expect(
      CrmDispatchPage({ searchParams: Promise.resolve({ bookingId: "outside" }) })
    ).rejects.toThrow("unavailable for this branch");
    expect(mocks.getDispatchData).not.toHaveBeenCalled();
  });
});
