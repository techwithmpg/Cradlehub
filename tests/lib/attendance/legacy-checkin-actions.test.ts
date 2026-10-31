import { describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(() => {
    throw new Error("Legacy attendance actions must not open a database client");
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  checkInStaffForShiftAction,
  checkOutStaffForShiftAction,
} from "@/lib/actions/staff-checkins";

describe("legacy attendance server actions", () => {
  it.each([
    ["clock in", checkInStaffForShiftAction],
    ["clock out", checkOutStaffForShiftAction],
  ])("rejects %s without opening a direct-write client", async (_label, action) => {
    const result = await action({
      staffId: "00000000-0000-0000-0000-000000000001",
      shiftDate: "2026-10-31",
      shiftType: "single",
    });

    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(createClient).not.toHaveBeenCalled();
  });
});
