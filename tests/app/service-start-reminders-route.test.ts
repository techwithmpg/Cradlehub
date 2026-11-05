import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ run: vi.fn(), logError: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/bookings/therapist-service-start-push", () => ({
  runTherapistServiceStartPush: mocks.run,
}));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));

import { GET } from "@/app/api/service-start-reminders/route";

function request(token?: string) {
  return new NextRequest("http://localhost/api/service-start-reminders", {
    headers: token ? { authorization: "Bearer " + token } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "local-test-secret");
  vi.stubEnv("CRADLEHUB_THERAPIST_START_PUSH_ENABLED", "true");
  mocks.run.mockResolvedValue({ eligible: 1, processed: 1, stale: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("protected therapist reminder endpoint", () => {
  it("rejects missing and incorrect bearer tokens without scanning", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("wrong"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("local-test-secret"))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("does not send anything while the release flag is disabled", async () => {
    vi.stubEnv("CRADLEHUB_THERAPIST_START_PUSH_ENABLED", "false");
    expect((await GET(request("local-test-secret"))).status).toBe(503);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs only for an authorized and enabled scheduled invocation", async () => {
    const response = await GET(request("local-test-secret"));
    expect(response.status).toBe(200);
    expect((await response.json()).result.processed).toBe(1);
    expect(mocks.run).toHaveBeenCalledOnce();
  });

  it("reports runtime failures without claiming reminders were delivered", async () => {
    mocks.run.mockRejectedValueOnce(new Error("LOCAL database failure"));
    expect((await GET(request("local-test-secret"))).status).toBe(500);
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});
