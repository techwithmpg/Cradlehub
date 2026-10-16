import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  isGoogleMapsEnabled: vi.fn(),
  estimateTravelTime: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/maps/google-maps", () => ({
  isGoogleMapsEnabled: mocks.isGoogleMapsEnabled,
  estimateTravelTime: mocks.estimateTravelTime,
}));

import { checkHomeServiceDispatchConflict } from "@/lib/bookings/dispatch-conflict";

const BRANCH_ID = "20a30d2a-2899-48c8-b643-c12ce26715f1";

type QueryResult = { data: unknown; error: unknown };

function queryBuilder(options: { result?: QueryResult } = {}) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "neq", "not", "order", "limit", "select"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(options.result ?? { data: [], error: null }).then(onFulfilled, onRejected);
  return builder;
}

describe("Fix B: Dispatch conflict fail-closed read validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isGoogleMapsEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed and throws an error when database read returns an error", async () => {
    const errorBuilder = queryBuilder({
      result: {
        data: null,
        error: { code: "PGRST500", message: "Database connection timeout" },
      },
    });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => errorBuilder),
    });

    await expect(
      checkHomeServiceDispatchConflict({
        branchId: BRANCH_ID,
        bookingDate: "2026-09-26",
        startTime: "13:00:00",
        endTime: "14:00:00",
        selectedZone: "central_bacolod",
        driverCapacity: 2,
      })
    ).rejects.toThrow(
      "Failed to query existing home service bookings for dispatch conflict check: Database connection timeout"
    );
  });

  it("returns no conflict on successful empty read", async () => {
    const emptyBuilder = queryBuilder({
      result: { data: [], error: null },
    });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => emptyBuilder),
    });

    const result = await checkHomeServiceDispatchConflict({
      branchId: BRANCH_ID,
      bookingDate: "2026-09-26",
      startTime: "13:00:00",
      endTime: "14:00:00",
      selectedZone: "central_bacolod",
      driverCapacity: 2,
    });

    expect(result).toEqual({ conflict: "none" });
  });

  it("returns hard conflict when overlapping bookings meet or exceed driver capacity", async () => {
    const conflictBuilder = queryBuilder({
      result: {
        data: [
          {
            id: "b-existing-1",
            start_time: "13:00:00",
            end_time: "14:00:00",
            metadata: null,
            status: "confirmed",
            hold_expires_at: null,
          },
        ],
        error: null,
      },
    });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => conflictBuilder),
    });

    const result = await checkHomeServiceDispatchConflict({
      branchId: BRANCH_ID,
      bookingDate: "2026-09-26",
      startTime: "13:30:00",
      endTime: "14:30:00",
      selectedZone: "central_bacolod",
      driverCapacity: 1,
    });

    expect(result.conflict).toBe("hard");
    if (result.conflict === "hard") {
      expect(result.message).toContain("Home Service is already fully scheduled");
    }
  });

  it("returns warning when location zone is unknown", async () => {
    const emptyBuilder = queryBuilder({
      result: { data: [], error: null },
    });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => emptyBuilder),
    });

    const result = await checkHomeServiceDispatchConflict({
      branchId: BRANCH_ID,
      bookingDate: "2026-09-26",
      startTime: "13:00:00",
      endTime: "14:00:00",
      selectedZone: "unknown",
      driverCapacity: 2,
    });

    expect(result.conflict).toBe("warning");
    expect((result as { needs_location_review?: boolean }).needs_location_review).toBe(true);
  });

  it("returns hard conflict when driverCapacity is 0 without querying database", async () => {
    const adminClient = { from: vi.fn() };
    mocks.createAdminClient.mockReturnValue(adminClient);

    const result = await checkHomeServiceDispatchConflict({
      branchId: BRANCH_ID,
      bookingDate: "2026-09-26",
      startTime: "13:00:00",
      endTime: "14:00:00",
      selectedZone: "central_bacolod",
      driverCapacity: 0,
    });

    expect(result.conflict).toBe("hard");
    expect(adminClient.from).not.toHaveBeenCalled();
  });
});
