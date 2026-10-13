import { describe, expect, it, vi } from "vitest";
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/home-service/distance-service", () => ({
  getHomeServiceBranchRouteOrigin: vi.fn(async () => null),
}));

describe("Home Service upcoming query", () => {
  it("keeps Today date scoped and Upcoming branch, delivery, status, and horizon scoped", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      gt: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    for (const method of ["select", "eq", "gt", "lte", "in", "order"] as const)
      query[method].mockReturnValue(query);
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>;

    const upcoming = await getDispatchData({
      branchId: "branch-a",
      date: "2026-10-13",
      upcoming: true,
      supabase: client,
    });
    expect(upcoming.items).toEqual([]);
    expect(query.eq).toHaveBeenCalledWith("branch_id", "branch-a");
    expect(query.eq).toHaveBeenCalledWith("delivery_type", "home_service");
    expect(query.gt).toHaveBeenCalledWith("booking_date", "2026-10-13");
    expect(query.lte).toHaveBeenCalledWith("booking_date", "2026-10-27");
    expect(query.in).toHaveBeenCalledWith("status", [
      "pending",
      "pending_payment",
      "pending_crm_confirmation",
      "confirmed",
      "in_progress",
    ]);

    query.eq.mockClear();
    query.gt.mockClear();
    await getDispatchData({ branchId: "branch-a", date: "2026-10-13", supabase: client });
    expect(query.eq).toHaveBeenCalledWith("booking_date", "2026-10-13");
    expect(query.gt).not.toHaveBeenCalled();
  });
});
