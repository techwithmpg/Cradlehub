import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ run: vi.fn(), logError: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/notifications/push/service-transition-outbox", () => ({
  runServiceTransitionPushConsumer: mocks.run,
}));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));

import { GET } from "@/app/api/service-transition-push/route";

function request(token?: string) {
  return new NextRequest("http://localhost/api/service-transition-push", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "local-test-secret");
  mocks.run.mockResolvedValue({ claimed: 0, completed: 0, pending: 0, batches: 1,
    health: { pending: 0, ready: 0, overdue: 0, repeated_failures: 0, oldest_created_at: null } });
});
afterEach(() => vi.unstubAllEnvs());

describe("protected service transition push consumer", () => {
  it("rejects missing and incorrect credentials without claiming work", async () => {
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("wrong"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("local-test-secret"))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs bounded server-only batches when the secret matches", async () => {
    const response = await GET(request("local-test-secret"));
    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith({ batchSize: 6, maxBatches: 4 });
  });

  it("surfaces an unhealthy consumer invocation", async () => {
    mocks.run.mockRejectedValueOnce(new Error("LOCAL outbox failure"));
    expect((await GET(request("local-test-secret"))).status).toBe(500);
    expect(mocks.logError).toHaveBeenCalled();
  });
});
