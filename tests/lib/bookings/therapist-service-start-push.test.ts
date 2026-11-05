import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  list: vi.fn(),
  fresh: vi.fn(),
  create: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));
vi.mock("@/lib/notifications/workflow-notifications-store", () => ({
  createNotificationOnce: mocks.create,
}));
vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
  logInfo: mocks.logInfo,
}));

import { runTherapistServiceStartPush } from "@/lib/bookings/therapist-service-start-push";

const now = new Date("2026-11-05T13:58:30+08:00");
const booking = {
  id: "booking-1",
  branch_id: "branch-main",
  staff_id: "therapist-1",
  resource_id: "room-2",
  booking_date: "2026-11-05",
  start_time: "14:00:00",
  status: "confirmed",
  booking_progress_status: "checked_in",
  session_started_at: null,
  delivery_type: "in_spa",
};

function query() {
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async () => ({
      data: await mocks.list(),
      error: null,
    })),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: await mocks.fresh(),
      error: null,
    })),
  };
  return q;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation(() => query());
  mocks.list.mockResolvedValue([booking]);
  mocks.fresh.mockResolvedValue(booking);
  mocks.create.mockResolvedValue(true);
});

describe("assigned-therapist service start push", () => {
  it("queues a staff-only reminder for an eligible booking with a stable dedupe key", async () => {
    await expect(runTherapistServiceStartPush({ now }))
      .resolves.toEqual({ eligible: 1, processed: 1, stale: 0 });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      targetWorkspace: "staff",
      recipientStaffId: "therapist-1",
      branchId: "branch-main",
      entityId: "booking-1",
      actionHref: "/staff-portal/service-progress",
      dedupeKey: "therapist-service-start:booking-1:2026-11-05:14:00:00:therapist-1",
      metadata: expect.objectContaining({ service_start_reminder: true }),
    }));
    const notification = mocks.create.mock.calls[0]?.[0];
    expect(notification.body).not.toContain("Guest");
    expect(notification.body).not.toContain("customer");
  });

  it("does not enqueue if the assigned therapist has changed before send", async () => {
    mocks.fresh.mockResolvedValue({ ...booking, staff_id: "therapist-2" });
    await expect(runTherapistServiceStartPush({ now }))
      .resolves.toEqual({ eligible: 1, processed: 0, stale: 1 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("skips a service that is already started", async () => {
    mocks.list.mockResolvedValue([{ ...booking, session_started_at: now.toISOString() }]);
    await expect(runTherapistServiceStartPush({ now }))
      .resolves.toEqual({ eligible: 0, processed: 0, stale: 0 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("fails closed on an over-limit scan instead of silently dropping appointments", async () => {
    mocks.list.mockResolvedValue(Array.from({ length: 201 }, () => booking));
    await expect(runTherapistServiceStartPush({ now }))
      .rejects.toThrow("exceeded safe page limit");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("fails visibly when a durable notice cannot be persisted", async () => {
    mocks.create.mockResolvedValue(false);
    await expect(runTherapistServiceStartPush({ now }))
      .rejects.toThrow("could not be persisted");
  });
});
