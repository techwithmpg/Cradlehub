import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ selectProvider: vi.fn(), logInfo: vi.fn() }));
vi.mock("@/lib/integrations/google-sheets/sheet-token-provider-selector", () => ({
  selectSheetTokenProvider: mocks.selectProvider,
}));
vi.mock("@/lib/logger", () => ({ logInfo: mocks.logInfo }));

import {
  loadSheetNativeReferences,
  isInNativeSheetWindow,
} from "@/lib/integrations/google-sheets/sheet-native-service";

const now = () => new Date("2026-10-04T00:00:00.000Z");
const branches = async () => [{ id: "main-id", name: "Cradle Spa — Main Branch" }];
const reader = {
  readCurrentAndPrevious: vi
    .fn()
    .mockResolvedValue({ status: "unavailable", reason: "SHEETS_UNAVAILABLE" }),
};

describe("native Sheet resource boundary", () => {
  it("allows only current and previous week dates", () => {
    expect(isInNativeSheetWindow("2026-09-25", "2026-10-04")).toBe(true);
    expect(isInNativeSheetWindow("2026-10-08", "2026-10-04")).toBe(true);
    expect(isInNativeSheetWindow("2026-09-24", "2026-10-04")).toBe(false);
    expect(isInNativeSheetWindow("2026-10-09", "2026-10-04")).toBe(false);
    expect(isInNativeSheetWindow("2026-02-30", "2026-10-04")).toBe(false);
  });

  it("denies before token selection or Sheet read", async () => {
    reader.readCurrentAndPrevious.mockClear();
    mocks.selectProvider.mockClear();
    expect(
      (
        await loadSheetNativeReferences("2026-10-04", {
          authorize: async () => null,
          branches,
          reader,
          now,
        })
      ).status
    ).toBe("forbidden");
    expect(
      (
        await loadSheetNativeReferences("2026-10-04", {
          authorize: async () => ({ branchId: "main-id", role: "driver" }),
          branches,
          reader,
          now,
        })
      ).status
    ).toBe("forbidden");
    expect(reader.readCurrentAndPrevious).not.toHaveBeenCalled();
    expect(mocks.selectProvider).not.toHaveBeenCalled();
  });

  it("denies wrong branch and unknown mapping before Google", async () => {
    reader.readCurrentAndPrevious.mockClear();
    expect(
      (
        await loadSheetNativeReferences("2026-10-04", {
          authorize: async () => ({ branchId: "sm-id", role: "crm" }),
          branches,
          reader,
          now,
        })
      ).status
    ).toBe("forbidden");
    expect(
      (
        await loadSheetNativeReferences("2026-10-04", {
          authorize: async () => ({ branchId: "main-id", role: "owner" }),
          branches: async () => [{ id: "other", name: "Other Branch" }],
          reader,
          now,
        })
      ).status
    ).toBe("forbidden");
    expect(reader.readCurrentAndPrevious).not.toHaveBeenCalled();
  });

  it("reports out-of-window and Google failure truthfully without leaking errors", async () => {
    reader.readCurrentAndPrevious.mockClear();
    const authorize = async () => ({ branchId: "main-id", role: "crm" });
    expect(
      (await loadSheetNativeReferences("2026-09-24", { authorize, branches, reader, now })).status
    ).toBe("outside_loaded_window");
    expect(reader.readCurrentAndPrevious).not.toHaveBeenCalled();
    const result = await loadSheetNativeReferences("2026-10-04", {
      authorize,
      branches,
      reader,
      now,
    });
    expect(result).toEqual({ status: "unavailable", observedAt: now().toISOString() });
    expect(reader.readCurrentAndPrevious).toHaveBeenCalledWith("2026-10-04");
  });
});
