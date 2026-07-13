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
    order: vi.fn(),
    or: vi.fn(),
    then: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.then.mockImplementation((
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown
  ) =>
    Promise.resolve(result).then(resolve, reject)
  );

  return query;
}

function makeSupabase(overridesResult: QueryResult, staffResult: QueryResult) {
  return {
    from: vi.fn((table: string) => {
      if (table === "staff") return queryResult(staffResult);
      if (table === "bookings") return queryResult({ data: [], error: null });
      if (table === "blocked_times") return queryResult({ data: [], error: null });
      if (table === "schedule_overrides") return queryResult(overridesResult);
      if (table === "staff_shift_checkins") return queryResult({ data: [], error: null });
      if (table === "staff_schedules") return queryResult({ data: [], error: null });
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDailySchedule", () => {
  it("returns operational staff with a distinct missing schedule state", async () => {
    mocks.createClient.mockResolvedValue(
      makeSupabase(
        { data: [], error: null },
        {
          data: [
            {
              id: "staff-1",
              full_name: "Alex Santos",
              nickname: null,
              tier: null,
              staff_type: "therapist",
              system_role: null,
              branch_id: "branch-1",
              is_active: true,
              archived_at: null,
              merged_into_staff_id: null,
              metadata: null,
            },
          ],
          error: null,
        }
      )
    );

    await expect(
      getDailySchedule({ branchId: "branch-1", date: "2026-07-03" })
    ).resolves.toMatchObject([
      {
        staff_id: "staff-1",
        staff_name: "Alex Santos",
        schedule_source: "none",
        schedule_status: "missing",
        schedule_is_day_off: false,
        attendance_presence: { state: "not_expected" },
      },
    ]);
  });

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
              tier: null,
              staff_type: "therapist",
              system_role: null,
              branch_id: "branch-1",
              is_active: true,
              archived_at: null,
              merged_into_staff_id: null,
              metadata: null,
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

  it("surfaces staff roster query failures instead of converting them to empty names", async () => {
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
    ).rejects.toThrow("Staff roster query failed: permission denied for table staff");
  });
});
