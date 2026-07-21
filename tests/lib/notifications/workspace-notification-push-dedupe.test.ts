import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateNotificationInput } from "@/lib/notifications/types";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  deliverWorkspaceNotificationPush: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/notifications/push/delivery", () => ({
  deliverWorkspaceNotificationPush: mocks.deliverWorkspaceNotificationPush,
}));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));

import { createOrUpdateNotification } from "@/lib/notifications/workflow-notifications-store";

const input = {
  branchId: "11111111-1111-4111-8111-111111111111",
  targetWorkspace: "crm" as const,
  type: "payment_pending",
  title: "New online booking",
  entityType: "booking",
  entityId: "22222222-2222-4222-8222-222222222222",
  dedupeKey: "booking:22222222-2222-4222-8222-222222222222:payment_pending",
} satisfies CreateNotificationInput;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deliverWorkspaceNotificationPush.mockResolvedValue(undefined);
});

describe("workspace notification push deduplication", () => {
  it("dispatches push exactly once after winning a durable insert", async () => {
    const lookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    const inserted = { id: "notification-1", ...input };
    const insert = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
    };
    const from = vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(insert);
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(createOrUpdateNotification(input)).resolves.toBe(true);
    expect(mocks.deliverWorkspaceNotificationPush).toHaveBeenCalledOnce();
    expect(mocks.deliverWorkspaceNotificationPush).toHaveBeenCalledWith(inserted);
  });

  it("updates an open dedupe match without resending push", async () => {
    const lookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "notification-1" } }),
    };
    const update = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const from = vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update);
    mocks.createAdminClient.mockReturnValue({ from });

    await expect(createOrUpdateNotification(input)).resolves.toBe(true);
    expect(mocks.deliverWorkspaceNotificationPush).not.toHaveBeenCalled();
  });
});
