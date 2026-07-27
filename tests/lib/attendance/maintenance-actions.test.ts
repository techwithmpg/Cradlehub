import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  checkInStaffForShiftAction,
  checkOutStaffForShiftAction,
} from "@/lib/actions/staff-checkins";

describe("manual Attendance maintenance guards", () => {
  beforeEach(() => {
    vi.stubEnv("ATTENDANCE_MAINTENANCE_MODE", "true");
    createClient.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks a normal clock-in before validation, authentication, or a database write", async () => {
    const result = await checkInStaffForShiftAction({
      staffId: "00000000-0000-4000-8000-000000000101",
      shiftDate: "2026-07-27",
      shiftType: "single",
    });

    expect(result).toMatchObject({ ok: false, code: "ATTENDANCE_MAINTENANCE" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("blocks a normal clock-out before validation, authentication, or a database write", async () => {
    const result = await checkOutStaffForShiftAction({
      staffId: "00000000-0000-4000-8000-000000000101",
      shiftDate: "2026-07-27",
      shiftType: "single",
    });

    expect(result).toMatchObject({ ok: false, code: "ATTENDANCE_MAINTENANCE" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("stops returning the maintenance result as soon as the flag is disabled", async () => {
    vi.stubEnv("ATTENDANCE_MAINTENANCE_MODE", "false");
    const result = await checkInStaffForShiftAction({});

    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(result).not.toMatchObject({ code: "ATTENDANCE_MAINTENANCE" });
  });
});
