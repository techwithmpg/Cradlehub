import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createOrUpdateNotification: vi.fn(),
}));
vi.mock("@/lib/notifications/workflow-signals", () => ({
  createOrUpdateNotification: mocks.createOrUpdateNotification,
  markNotificationResolved: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

import { createNotification } from "@/lib/notifications/create";

beforeEach(() => mocks.createOrUpdateNotification.mockReset());

describe("notification failure boundary", () => {
  it("never propagates persistence or push-pipeline failure into booking callers", async () => {
    mocks.createOrUpdateNotification.mockRejectedValueOnce(
      new Error("push provider unavailable")
    );
    await expect(
      createNotification({
        branchId: "11111111-1111-4111-8111-111111111111",
        targetWorkspace: "crm",
        type: "payment_pending",
        title: "New online booking",
        entityType: "booking",
        entityId: "22222222-2222-4222-8222-222222222222",
      })
    ).resolves.toBeUndefined();
  });
});
