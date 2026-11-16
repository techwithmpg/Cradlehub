import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const process = vi.hoisted(() => vi.fn());
vi.mock("@/lib/attendance/v2-processor", () => ({ processAttendanceV2: process }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
import { POST } from "@/app/api/attendance/automation/route";

afterEach(() => {
  vi.unstubAllEnvs();
  process.mockReset();
});
describe("Attendance automation authorization", () => {
  it("rejects an absent or incorrect scheduler credential before processing", async () => {
    for (const token of [undefined, "Bearer wrong"]) {
      vi.stubEnv("CRON_SECRET", "TEST-scheduler-credential");
      const request = new NextRequest("http://localhost/api/attendance/automation", {
        method: "POST",
        headers: token ? { authorization: token } : {},
      });
      expect((await POST(request)).status).toBe(401);
    }
    expect(process).not.toHaveBeenCalled();
  });
  it("returns inactive without claiming production activation", async () => {
    vi.stubEnv("CRON_SECRET", "TEST-scheduler-credential");
    process.mockResolvedValue({ inactive: true });
    const response = await POST(
      new NextRequest("http://localhost/api/attendance/automation", {
        method: "POST",
        headers: { authorization: "Bearer TEST-scheduler-credential" },
      })
    );
    expect(await response.json()).toEqual({ ok: true, result: { inactive: true } });
  });
  it("does not expose internal database errors", async () => {
    vi.stubEnv("CRON_SECRET", "TEST-scheduler-credential");
    process.mockRejectedValue(new Error("TEST internal detail"));
    const response = await POST(
      new NextRequest("http://localhost/api/attendance/automation", {
        method: "POST",
        headers: { authorization: "Bearer TEST-scheduler-credential" },
      })
    );
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("TEST internal detail");
  });
});
