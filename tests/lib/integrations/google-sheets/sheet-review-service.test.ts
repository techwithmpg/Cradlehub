import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  role: "owner",
  active: true,
  lookupError: null as Error | null,
  superAdmin: false,
  staffLookup: vi.fn(),
  logInfo: vi.fn(),
  selectProvider: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.userId ? { id: mocks.userId } : null } }) },
    from: (table: string) => {
      expect(table).toBe("staff");
      return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.staffLookup }) }) }) };
    },
  }),
}));
vi.mock("@/lib/auth/super-admin", () => ({
  resolveSuperAdminContext: async () => (mocks.superAdmin ? { id: "super-admin" } : null),
}));
vi.mock("@/lib/logger", () => ({ logInfo: mocks.logInfo }));
vi.mock("@/lib/integrations/google-sheets/sheet-token-provider-selector", () => ({
  selectSheetTokenProvider: mocks.selectProvider,
}));

import {
  hasOwnerSheetReviewAccess,
  loadOwnerSheetReview,
} from "@/lib/integrations/google-sheets/sheet-review-service";

beforeEach(() => {
  mocks.userId = "user-1";
  mocks.role = "owner";
  mocks.active = true;
  mocks.lookupError = null;
  mocks.superAdmin = false;
  mocks.staffLookup.mockReset().mockImplementation(async () => ({
    data: mocks.active ? { system_role: mocks.role } : null,
    error: mocks.lookupError,
  }));
  mocks.logInfo.mockReset();
  mocks.selectProvider.mockReset();
});

describe("owner Master Sheet review authorization", () => {
  it("admits an authenticated active Owner or super-admin", async () => {
    expect(await hasOwnerSheetReviewAccess()).toBe(true);
    mocks.superAdmin = true;
    mocks.role = "crm";
    expect(await hasOwnerSheetReviewAccess()).toBe(true);
  });

  it("rejects unauthenticated, non-Owner, inactive, and failed staff lookups", async () => {
    mocks.userId = null;
    expect(await hasOwnerSheetReviewAccess()).toBe(false);
    mocks.userId = "user-1";
    mocks.role = "crm";
    expect(await hasOwnerSheetReviewAccess()).toBe(false);
    mocks.role = "owner";
    mocks.active = false;
    expect(await hasOwnerSheetReviewAccess()).toBe(false);
    mocks.active = true;
    mocks.lookupError = new Error("lookup failed");
    expect(await hasOwnerSheetReviewAccess()).toBe(false);
  });

  it("never calls the Sheet reader when authorization fails or throws", async () => {
    const reader = { readCurrentAndPrevious: vi.fn() };
    expect(await loadOwnerSheetReview({ authorize: async () => false, reader })).toEqual({
      status: "forbidden",
    });
    expect(
      await loadOwnerSheetReview({
        authorize: async () => {
          throw new Error("auth failed");
        },
        reader,
      })
    ).toEqual({ status: "forbidden" });
    expect(reader.readCurrentAndPrevious).not.toHaveBeenCalled();
    expect(mocks.selectProvider).not.toHaveBeenCalled();
    expect(mocks.logInfo).not.toHaveBeenCalled();
  });

  it("returns only unavailable state when a credential provider fails", async () => {
    const getAccessToken = vi.fn().mockRejectedValue(new Error("private credential material"));
    mocks.selectProvider.mockReturnValue({ getAccessToken });
    const state = await loadOwnerSheetReview({
      authorize: async () => true,
      now: () => new Date("2026-10-04T00:00:00.000Z"),
    });
    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(state).toEqual({ status: "unavailable", observedAt: "2026-10-04T00:00:00.000Z" });
    expect(JSON.stringify(state)).not.toContain("private credential material");
    expect(JSON.stringify(mocks.logInfo.mock.calls)).not.toContain("private credential material");
  });

  it("isolates a Sheet read failure and logs only timing/status metadata", async () => {
    const reader = {
      readCurrentAndPrevious: vi.fn().mockRejectedValue(new Error("private Sheet content")),
    };
    const result = await loadOwnerSheetReview({
      authorize: async () => true,
      reader,
      now: () => new Date("2026-10-04T00:00:00.000Z"),
    });
    expect(result).toEqual({ status: "unavailable", observedAt: "2026-10-04T00:00:00.000Z" });
    expect(reader.readCurrentAndPrevious).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.logInfo.mock.calls)).not.toContain("private Sheet content");
  });
});
