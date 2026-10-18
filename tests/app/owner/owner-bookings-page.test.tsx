import { beforeEach, describe, expect, it, vi } from "vitest";

// Vitest loads a Server Component through Node, outside Next.js's RSC bundler.
// Keep the production server-only boundary intact; mock only its test sentinel.
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getStaff: vi.fn(),
  getBranches: vi.fn(),
  getBookings: vi.fn(),
  redirect: vi.fn((destination: string) => { throw new Error(`redirect:${destination}`); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/dev-bypass", () => ({ isDevAuthBypassEnabled: () => false }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: mocks.getStaff,
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/queries/branches", () => ({ getAllBranches: mocks.getBranches }));
vi.mock("@/app/(dashboard)/owner/bookings/actions", () => ({
  getOwnerWorkspaceBookingsAction: mocks.getBookings,
}));

import OwnerBookingsPage from "@/app/(dashboard)/owner/bookings/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-user" } } });
  mocks.getStaff.mockResolvedValue({ data: { system_role: "owner" } });
  mocks.getBranches.mockResolvedValue([{ id: "main", name: "Main Spa", is_active: true }]);
  mocks.getBookings.mockResolvedValue({ bookings: [] });
});

describe("PERF-9B Owner Bookings server page contract", () => {
  it("preserves a legitimate empty Owner booking day as ready", async () => {
    const result = await OwnerBookingsPage({ searchParams: Promise.resolve({ date: "2026-10-18" }) });
    expect(result.props.children.props.initialRead).toEqual({ status: "ready", bookings: [] });
    expect(mocks.getBookings).toHaveBeenCalledWith({
      date: "2026-10-18",
      branchId: undefined,
      status: undefined,
      type: undefined,
    });
  });

  it("does not turn a denied Owner bookings read into an empty list", async () => {
    mocks.getBookings.mockResolvedValue({ error: "The selected branch is unavailable." });
    const result = await OwnerBookingsPage({ searchParams: Promise.resolve({ branch: "hidden" }) });
    expect(result.props.children.props.initialRead).toEqual({
      status: "error",
      message: "The selected branch is unavailable.",
    });
  });

  it("rejects duplicate branch selections before requesting booking records", async () => {
    const result = await OwnerBookingsPage({
      searchParams: Promise.resolve({ branch: ["main", "sm"] }),
    });
    expect(result.props.children.props.initialRead).toMatchObject({ status: "error" });
    expect(mocks.getBookings).not.toHaveBeenCalled();
  });

  it("preserves Owner filters and exact selected branch on server requests", async () => {
    await OwnerBookingsPage({
      searchParams: Promise.resolve({
        date: "2026-10-19",
        branch: "main",
        status: "confirmed",
        type: "online",
        search: "Alice",
      }),
    });
    expect(mocks.getBookings).toHaveBeenCalledWith({
      date: "2026-10-19",
      branchId: "main",
      status: "confirmed",
      type: "online",
    });
  });

  it("turns a server read failure into an explicit unavailable payload", async () => {
    mocks.getBookings.mockRejectedValue(new Error("network"));
    const result = await OwnerBookingsPage({ searchParams: Promise.resolve({}) });
    expect(result.props.children.props.initialRead).toMatchObject({ status: "error" });
  });

  it("redirects non-Owner staff before querying branches or bookings", async () => {
    mocks.getStaff.mockResolvedValue({ data: { system_role: "crm" } });
    await expect(OwnerBookingsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/login");
    expect(mocks.getBranches).not.toHaveBeenCalled();
    expect(mocks.getBookings).not.toHaveBeenCalled();
  });
  it("normalizes array URL parameters without broadening queries", async () => {
    await OwnerBookingsPage({
      searchParams: Promise.resolve({
        date: ["2026-10-20", "2026-10-21"],
        status: ["confirmed", "completed"],
        type: ["online", "inhouse"],
        search: ["Client A", "Client B"],
      }),
    });
    expect(mocks.getBookings).toHaveBeenCalledWith({
      date: "2026-10-20",
      branchId: undefined,
      status: "confirmed",
      type: "online",
    });
  });
});
