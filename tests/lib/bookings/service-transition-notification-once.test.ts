import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), deliverPush: vi.fn(), logError: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/notifications/push/delivery", () => ({
  deliverWorkspaceNotificationPush: mocks.deliverPush,
}));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));

import { createNotificationOnce } from "@/lib/notifications/workflow-notifications-store";

const event = {
  branchId: "branch-1", targetWorkspace: "crm" as const,
  type: "booking_status_changed" as const, title: "Service Completed Automatically",
  entityType: "booking", entityId: "booking-1", dedupeKey: "service_completed:booking-1:at:crm:branch-1",
};

beforeEach(() => vi.resetAllMocks());

function setup(existing: { data: { id: string }[] | null; error: unknown }, inserted = {
  data: { id: "notification-1" }, error: null as { code?: string } | null,
}) {
  const lookup = { select: vi.fn(), eq: vi.fn(), limit: vi.fn().mockResolvedValue(existing) };
  lookup.select.mockReturnValue(lookup);
  lookup.eq.mockReturnValue(lookup);
  const insert = { insert: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue(inserted) };
  insert.insert.mockReturnValue(insert);
  insert.select.mockReturnValue(insert);
  mocks.from.mockReturnValueOnce(lookup).mockReturnValueOnce(insert);
  return { lookup, insert };
}

describe("one-time service transition notifications", () => {
  it("does not resurrect a dismissed event on retry", async () => {
    const { insert } = setup({ data: [{ id: "dismissed-1" }], error: null });
    expect(await createNotificationOnce(event)).toBe(true);
    expect(insert.insert).not.toHaveBeenCalled();
    expect(mocks.deliverPush).not.toHaveBeenCalled();
  });

  it("persists and pushes a new event only after winning the insert", async () => {
    const { insert } = setup({ data: [], error: null });
    expect(await createNotificationOnce(event)).toBe(true);
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      dedupe_key: event.dedupeKey, status: "unread", title: event.title,
    }));
    expect(mocks.deliverPush).toHaveBeenCalledOnce();
  });

  it("treats a concurrent insert as delivered without a second push", async () => {
    setup({ data: [], error: null }, { data: null as never, error: { code: "23505" } });
    expect(await createNotificationOnce(event)).toBe(true);
    expect(mocks.deliverPush).not.toHaveBeenCalled();
  });

  it("fails closed when history cannot be checked", async () => {
    const { insert } = setup({ data: null, error: { code: "PGRST000" } });
    expect(await createNotificationOnce(event)).toBe(false);
    expect(insert.insert).not.toHaveBeenCalled();
  });
});
