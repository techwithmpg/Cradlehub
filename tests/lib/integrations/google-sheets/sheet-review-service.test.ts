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
  hasMasterSheetReviewAccess,
  loadMasterSheetReview,
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

describe("Master Sheet review authorization", () => {
  it("admits authenticated active Owner, management, and Front Desk roles or super-admin", async () => {
    expect(await hasMasterSheetReviewAccess()).toBe(true);
    for (const role of [
      "manager",
      "assistant_manager",
      "store_manager",
      "crm",
      "csr",
      "csr_head",
      "csr_staff",
    ]) {
      mocks.role = role;
      expect(await hasMasterSheetReviewAccess()).toBe(true);
    }
    mocks.superAdmin = true;
    mocks.role = "staff";
    expect(await hasMasterSheetReviewAccess()).toBe(true);
  });

  it("rejects unauthenticated, unauthorized, inactive, and failed staff lookups", async () => {
    mocks.userId = null;
    expect(await hasMasterSheetReviewAccess()).toBe(false);
    mocks.userId = "user-1";
    for (const role of ["staff", "driver", "utility", "digital_marketer", "unknown_role"]) {
      mocks.role = role;
      expect(await hasMasterSheetReviewAccess()).toBe(false);
    }
    mocks.role = "owner";
    mocks.active = false;
    expect(await hasMasterSheetReviewAccess()).toBe(false);
    mocks.active = true;
    mocks.lookupError = new Error("lookup failed");
    expect(await hasMasterSheetReviewAccess()).toBe(false);
  });

  it("never acquires a token or reads Sheets for an unauthorized staff member", async () => {
    mocks.role = "staff";
    const reader = { readCurrentAndPrevious: vi.fn() };
    expect(await loadMasterSheetReview({ reader })).toEqual({ status: "forbidden" });
    expect(reader.readCurrentAndPrevious).not.toHaveBeenCalled();
    expect(mocks.selectProvider).not.toHaveBeenCalled();
  });

  it("never calls the Sheet reader when authorization fails or throws", async () => {
    const reader = { readCurrentAndPrevious: vi.fn() };
    expect(await loadMasterSheetReview({ authorize: async () => false, reader })).toEqual({
      status: "forbidden",
    });
    expect(
      await loadMasterSheetReview({
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
    const state = await loadMasterSheetReview({
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
    const result = await loadMasterSheetReview({
      authorize: async () => true,
      reader,
      now: () => new Date("2026-10-04T00:00:00.000Z"),
    });
    expect(result).toEqual({ status: "unavailable", observedAt: "2026-10-04T00:00:00.000Z" });
    expect(reader.readCurrentAndPrevious).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.logInfo.mock.calls)).not.toContain("private Sheet content");
  });
});
