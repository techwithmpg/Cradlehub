import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/lib/notifications/push/delivery", () => ({
  deliverWorkspaceNotificationPush: mocks.push,
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
import { processAttendanceV2 } from "@/lib/attendance/v2-processor";

const notice = {
  id: "TEST-notice",
  recipient_staff_id: "TEST-staff",
  entity_id: "TEST-checkin",
  status: "unread",
};
beforeEach(() => {
  vi.stubEnv("CRADLEHUB_ATTENDANCE_V2_ENABLED", "true");
  mocks.rpc.mockReset();
  mocks.from.mockReset();
  mocks.push.mockReset();
  mocks.rpc.mockImplementation(async (name: string) => ({
    error: null,
    data:
      name === "attendance_v2_enabled"
        ? true
        : name === "process_due_attendance_v2"
          ? { examined: 1 }
          : name === "claim_attendance_v2_push"
            ? [
                {
                  notification_id: notice.id,
                  lease_token: "TEST-lease",
                  delivered_subscription_ids: ["TEST-accepted-endpoint"],
                },
              ]
            : true,
  }));
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(async () => ({
        error: null,
        data:
          table === "workspace_notifications"
            ? notice
            : { status: "checked_in", checked_out_at: null },
      })),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    return chain;
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Attendance notification transport evidence", () => {
  it("does no due processing or delivery while the application switch is off", async () => {
    vi.stubEnv("CRADLEHUB_ATTENDANCE_V2_ENABLED", "false");
    expect(await processAttendanceV2()).toEqual({ inactive: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("keeps a failed delivery distinct from a stored notification", async () => {
    mocks.push.mockResolvedValue({
      configured: true,
      attempted: 1,
      failed: 1,
      dispatchFailed: false,
      deliveredSubscriptionIds: [],
    });
    expect((await processAttendanceV2()).push).toEqual({
      claimed: 1,
      providerAccepted: 0,
      failed: 1,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finish_attendance_v2_push",
      expect.objectContaining({ p_complete: false, p_error: "push_failed" })
    );
  });
  it("records accepted endpoints and skips already accepted subscriptions on retry", async () => {
    mocks.push.mockResolvedValue({
      configured: true,
      attempted: 1,
      failed: 0,
      dispatchFailed: false,
      deliveredSubscriptionIds: ["TEST-new-endpoint"],
    });
    expect((await processAttendanceV2()).push?.providerAccepted).toBe(1);
    expect(mocks.push).toHaveBeenCalledWith(notice, {
      skipSubscriptionIds: new Set(["TEST-accepted-endpoint"]),
      eligibleStaffIds: new Set([notice.recipient_staff_id]),
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finish_attendance_v2_push",
      expect.objectContaining({ p_delivered: ["TEST-new-endpoint"], p_complete: true })
    );
  });
  it("rechecks actual attendance before a leased notice is dispatched", async () => {
    mocks.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn(async () => ({
          error: null,
          data:
            table === "workspace_notifications"
              ? notice
              : { status: "checked_out", checked_out_at: "2026-11-16T12:00Z" },
        })),
      };
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      return chain;
    });
    await processAttendanceV2();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finish_attendance_v2_push",
      expect.objectContaining({ p_error: "attendance_closed" })
    );
  });
  it("does not label zero subscribed endpoints as delivered", async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({
      error: null,
      data:
        name === "attendance_v2_enabled"
          ? true
          : name === "claim_attendance_v2_push"
            ? [
                {
                  notification_id: notice.id,
                  lease_token: "TEST-lease",
                  delivered_subscription_ids: [],
                },
              ]
            : true,
    }));
    mocks.push.mockResolvedValue({
      configured: true,
      attempted: 0,
      failed: 0,
      dispatchFailed: false,
      deliveredSubscriptionIds: [],
    });
    await processAttendanceV2();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finish_attendance_v2_push",
      expect.objectContaining({ p_complete: false, p_error: "no_push_endpoint" })
    );
  });
});
