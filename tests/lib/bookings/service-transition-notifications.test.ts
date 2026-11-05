import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn(), createNotificationOnce: vi.fn(), drainOutbox: vi.fn(), logError: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/notifications/create", () => ({ createNotificationOnce: mocks.createNotificationOnce }));
vi.mock("@/lib/notifications/push/service-transition-outbox", () => ({ drainServiceTransitionPushOutbox: mocks.drainOutbox }));
vi.mock("@/lib/logger", () => ({ logError: mocks.logError }));

import { publishServiceTransition } from "@/lib/bookings/service-transition-notifications";

const bookingId = "book-1";
const branchId = "branch-1";
const staffId = "staff-1";
const startedAt = "2026-11-03T06:01:00Z";
const completedAt = "2026-11-03T07:03:00Z";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: bookingId, branch_id: branchId, staff_id: staffId,
    session_started_at: startedAt, session_completed_at: completedAt,
    session_completion_source: "auto_due",
    customers: { full_name: "Payer" },
    booking_attendees: { display_name: "Actual Guest" },
    services: { name: "Head & Foot Massage" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNotificationOnce.mockResolvedValue(undefined);
  mocks.drainOutbox.mockResolvedValue({ claimed: 0, completed: 0, pending: 0 });
});

function setup(data: Record<string, unknown> | null) {
  const query = {
    select: vi.fn(), eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  return query;
}

describe("service transition notifications", () => {
  it("publishes a branch-scoped start event for CRM and only the assigned therapist", async () => {
    const query = setup(row());
    await publishServiceTransition({ bookingId, branchId, actorStaffId: "csr-1", transition: "started" });
    expect(query.eq).toHaveBeenCalledWith("branch_id", branchId);
    expect(mocks.createNotificationOnce).toHaveBeenCalledTimes(3);
    expect(mocks.createNotificationOnce).toHaveBeenCalledWith(expect.objectContaining({
      targetWorkspace: "crm", title: "Service Started",
      body: expect.stringContaining("Actual Guest — Head & Foot Massage"),
      dedupeKey: `service_started:${bookingId}:2026-11-03T06:01:00.000Z:crm:${branchId}`,
    }));
    expect(mocks.createNotificationOnce).toHaveBeenCalledWith(expect.objectContaining({
      targetWorkspace: "staff", recipientStaffId: staffId,
      dedupeKey: `service_started:${bookingId}:2026-11-03T06:01:00.000Z:staff:${staffId}`,
    }));
    expect(mocks.drainOutbox).toHaveBeenCalledWith({
      eventId: `service_started:${bookingId}:2026-11-03T06:01:00.000Z`, limit: 3,
    });
  });

  it("labels authoritative automatic completion and uses its persisted timestamp", async () => {
    setup(row());
    await publishServiceTransition({ bookingId, branchId, actorStaffId: null, transition: "completed" });
    expect(mocks.createNotificationOnce).toHaveBeenCalledWith(expect.objectContaining({
      title: "Service Completed Automatically",
      dedupeKey: `service_completed:${bookingId}:2026-11-03T07:03:00.000Z:crm:${branchId}`,
    }));
  });

  it("does not publish without a committed transition timestamp", async () => {
    setup(row({ session_started_at: null }));
    await publishServiceTransition({ bookingId, branchId, actorStaffId: "csr-1", transition: "started" });
    expect(mocks.createNotificationOnce).not.toHaveBeenCalled();
  });
});
