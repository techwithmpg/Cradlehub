import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { getDailySchedule } from "@/lib/queries/schedule";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function queryResult(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockResolvedValue(result);

  return query;
}

function makeSupabase(overridesResult: QueryResult, staffResult: QueryResult) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          staff_id: "staff-1",
          staff_name: "Alex Santos",
          staff_tier: null,
          bookings: [],
          blocks: [],
        },
      ],
      error: null,
    }),
    from: vi.fn((table: string) => {
      if (table === "staff") return queryResult(staffResult);
      if (table === "blocked_times") return queryResult({ data: [], error: null });
      if (table === "schedule_overrides") return queryResult(overridesResult);
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDailySchedule", () => {
  it("surfaces missing schedule_overrides.shift_type instead of returning empty rows", async () => {
    mocks.createClient.mockResolvedValue(
      makeSupabase(
        {
          data: null,
          error: {
            message: 'column schedule_overrides.shift_type does not exist',
          },
        },
        {
          data: [
            {
              id: "staff-1",
              full_name: "Alex Santos",
              nickname: null,
              staff_type: "therapist",
            },
          ],
          error: null,
        }
      )
    );

    await expect(
      getDailySchedule({ branchId: "branch-1", date: "2026-07-03" })
    ).rejects.toThrow(
      "Schedule-overrides query failed: column schedule_overrides.shift_type does not exist"
    );
  });

  it("surfaces staff metadata query failures instead of converting them to empty names", async () => {
    mocks.createClient.mockResolvedValue(
      makeSupabase(
        { data: [], error: null },
        {
          data: null,
          error: { message: "permission denied for table staff" },
        }
      )
    );

    await expect(
      getDailySchedule({ branchId: "branch-1", date: "2026-07-03" })
    ).rejects.toThrow("Staff metadata query failed: permission denied for table staff");
  });
});
