import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ run: vi.fn(), logError: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/notifications/pending-booking-push", () => ({
  runPendingBookingPushReminders: mocks.run,
}));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));

import { GET } from "@/app/api/notifications/pending-booking-reminders/route";

function request(token?: string) {
  return new NextRequest("http://localhost/api/notifications/pending-booking-reminders", {
    headers: token ? { authorization: "Bearer " + token } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.stubEnv("CRADLEHUB_PENDING_BOOKING_ALERTS_ENABLED", "true");
  mocks.run.mockResolvedValue({
    branchesChecked: 2, queuedOffDuty: 1, notDue: 0,
    attempted: 1, delivered: 1, failed: 0,
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Web P1 protected pending-booking reminder route", () => {
  it("never scans the queue without the server-side cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("incorrect"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("test-secret"))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("is disabled by default until reviewed release activation", async () => {
    vi.stubEnv("CRADLEHUB_PENDING_BOOKING_ALERTS_ENABLED", "");
    expect((await GET(request("test-secret"))).status).toBe(503);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs only when authorized and enabled, and reports actual delivery totals", async () => {
    const response = await GET(request("test-secret"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.stats.delivered).toBe(1);
    expect(data.stats.queuedOffDuty).toBe(1);
    expect(mocks.run).toHaveBeenCalledOnce();
  });

  it("fails visibly on a partial failure or missing test SQL function", async () => {
    mocks.run.mockResolvedValueOnce({ branchesChecked: 2, failed: 1 });
    expect((await GET(request("test-secret"))).status).toBe(500);
    mocks.run.mockRejectedValueOnce(new Error("Missing RPC"));
    expect((await GET(request("test-secret"))).status).toBe(500);
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});
