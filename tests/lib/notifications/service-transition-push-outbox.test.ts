import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), deliver: vi.fn(), logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/notifications/push/delivery", () => ({ deliverWorkspaceNotificationPush: mocks.deliver }));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError, logInfo: mocks.logInfo, logWarn: mocks.logWarn }));

import { drainServiceTransitionPushOutbox, runServiceTransitionPushConsumer } from "@/lib/notifications/push/service-transition-outbox";

const notification = { id: "notice-1", status: "unread", target_workspace: "staff" };
const job = { notification_id: "notice-1", delivered_subscription_ids: [], lease_token: "lease-1" };

function lookup(row: Record<string, unknown> | null = notification) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  mocks.from.mockReturnValue(query);
}

beforeEach(() => {
  vi.clearAllMocks();
  lookup();
  mocks.rpc.mockImplementation((name: string) => name === "claim_service_transition_push_jobs"
    ? Promise.resolve({ data: [job], error: null })
    : Promise.resolve({ data: true, error: null }));
});

describe("service transition phone-push outbox", () => {
  it("records successful device delivery and completes a claimed job", async () => {
    mocks.deliver.mockResolvedValue({
      configured: true, dispatchFailed: false, failed: 0,
      deliveredSubscriptionIds: ["device-1"],
    });
    await expect(drainServiceTransitionPushOutbox({ eventId: "event-1", limit: 3 }))
      .resolves.toEqual({ claimed: 1, completed: 1, pending: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_service_transition_push_jobs", {
      p_limit: 3, p_event_id: "event-1",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("finish_service_transition_push_job", {
      p_notification_id: "notice-1", p_lease_token: "lease-1",
      p_delivered_subscription_ids: ["device-1"], p_completed: true, p_error: null,
    });
  });

  it("retains a failed device for retry and skips a device already delivered", async () => {
    mocks.rpc.mockImplementation((name: string) => name === "claim_service_transition_push_jobs"
      ? Promise.resolve({ data: [{ ...job, delivered_subscription_ids: ["device-1"] }], error: null })
      : Promise.resolve({ data: true, error: null }));
    mocks.deliver.mockResolvedValue({
      configured: true, dispatchFailed: false, failed: 1,
      deliveredSubscriptionIds: [],
    });
    await expect(drainServiceTransitionPushOutbox()).resolves.toEqual({ claimed: 1, completed: 0, pending: 1 });
    expect(mocks.deliver.mock.calls[0]?.[1].skipSubscriptionIds.has("device-1")).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("finish_service_transition_push_job", expect.objectContaining({
      p_completed: false, p_error: "push_delivery_failed",
    }));
  });

  it("does not resurrect a dismissed notice during a retry", async () => {
    lookup({ ...notification, status: "dismissed" });
    await expect(drainServiceTransitionPushOutbox()).resolves.toEqual({ claimed: 1, completed: 1, pending: 0 });
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("finish_service_transition_push_job", expect.objectContaining({
      p_completed: true,
    }));
  });

  it("keeps work pending when push configuration is unavailable", async () => {
    mocks.deliver.mockResolvedValue({
      configured: false, dispatchFailed: false, failed: 0,
      deliveredSubscriptionIds: [],
    });
    await expect(drainServiceTransitionPushOutbox()).resolves.toEqual({ claimed: 1, completed: 0, pending: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith("finish_service_transition_push_job", expect.objectContaining({
      p_completed: false, p_error: "push_unconfigured",
    }));
  });

  it("continues past one batch when seven automatic completions create 21 jobs", async () => {
    const jobs = Array.from({ length: 21 }, (_, index) => ({
      ...job, notification_id: `auto-notice-${index}`,
    }));
    let next = 0;
    mocks.rpc.mockImplementation((name: string, args?: { p_limit?: number }) => {
      if (name === "claim_service_transition_push_jobs") {
        const batch = jobs.slice(next, next + (args?.p_limit ?? 6));
        next += batch.length;
        return Promise.resolve({ data: batch, error: null });
      }
      if (name === "service_transition_push_outbox_health") {
        return Promise.resolve({ data: { pending: 0, ready: 0, overdue: 0,
          repeated_failures: 0, oldest_created_at: null }, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    mocks.deliver.mockResolvedValue({ configured: true, dispatchFailed: false,
      failed: 0, deliveredSubscriptionIds: [] });
    await expect(runServiceTransitionPushConsumer({ batchSize: 6, maxBatches: 4 }))
      .resolves.toMatchObject({ claimed: 21, completed: 21, pending: 0, batches: 4 });
    expect(mocks.rpc.mock.calls.filter((call: unknown[]) => call[0] === "claim_service_transition_push_jobs"))
      .toHaveLength(4);
  });

  it("surfaces claim failure instead of reporting an empty queue", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("LOCAL claim failure") });
    await expect(runServiceTransitionPushConsumer()).rejects.toThrow("LOCAL claim failure");
    expect(mocks.logError).toHaveBeenCalled();
  });
});
