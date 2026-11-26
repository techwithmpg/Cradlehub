import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceNotification } from "@/lib/notifications/types";

vi.mock("server-only", () => ({}));

const pushState = vi.hoisted(() => ({
  subscriptions: [] as Array<Record<string, unknown>>,
  staff: [] as Array<Record<string, unknown>>,
  bookingDate: "2026-11-27" as string | null,
  assistanceRows: [] as Array<Record<string, unknown>>,
  sentPayloads: [] as Array<{ endpoint: string; payload: string }>,
}));

vi.mock("@/lib/notifications/push/config", () => ({
  isWebPushConfigured: () => true,
  getWebPushConfiguration: () => ({
    publicKey:
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8",
    privateKey: "test-private-key",
    subject: "mailto:alerts@cradlehub.local",
  }),
}));

vi.mock("web-push", () => {
  const sendNotification = vi.fn(async (sub: { endpoint: string }, payload: string) => {
    pushState.sentPayloads.push({ endpoint: sub.endpoint, payload });
    return { statusCode: 201 };
  });
  return {
    default: { sendNotification, setVapidDetails: vi.fn() },
    sendNotification,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => {
      const eqs: Record<string, unknown> = {};
      const ins: Record<string, unknown[]> = {};
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "update", "limit", "order"]) {
        chain[method] = vi.fn(() => chain);
      }
      chain.eq = vi.fn((col: string, val: unknown) => {
        eqs[col] = val;
        return chain;
      });
      chain.in = vi.fn((col: string, vals: unknown[]) => {
        ins[col] = vals;
        return chain;
      });
      chain.maybeSingle = vi.fn(async () => {
        if (table === "bookings") {
          return {
            data: pushState.bookingDate ? { booking_date: pushState.bookingDate } : null,
            error: null,
          };
        }
        return { data: null, error: null };
      });
      chain.then = (resolve: (value: unknown) => void) => {
        if (table === "web_push_subscriptions") {
          const rows = pushState.subscriptions.filter((row) => {
            if (eqs.is_active !== undefined && row.is_active !== eqs.is_active) return false;
            if (ins.workspace && !ins.workspace.includes(row.workspace)) return false;
            return true;
          });
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
        if (table === "staff") {
          const rows = pushState.staff.filter((row) => !ins.id || ins.id.includes(row.id));
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
        if (table === "staff_assistance_assignments") {
          const rows = pushState.assistanceRows.filter((row) => {
            if (eqs.staff_id && row.staff_id !== eqs.staff_id) return false;
            if (eqs.receiving_branch_id && row.receiving_branch_id !== eqs.receiving_branch_id)
              return false;
            if (eqs.status && row.status !== eqs.status) return false;
            return true;
          });
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      };
      return chain;
    }),
  }),
}));

import { deliverWorkspaceNotificationPush } from "@/lib/notifications/push/delivery";

function makeBookingNotice(overrides: Partial<WorkspaceNotification> = {}): WorkspaceNotification {
  return {
    id: "notif-1",
    branch_id: "branch-receiving",
    target_workspace: "staff",
    target_role: null,
    recipient_staff_id: "therapist-home",
    actor_staff_id: "crm-1",
    type: "booking_assigned",
    title: "New booking — Guest One",
    body: "Signature Massage",
    entity_type: "booking",
    entity_id: "booking-sm-1",
    action_href: "/staff/progress",
    priority: "normal",
    status: "unread",
    requires_action: false,
    dedupe_key: "booking:booking-sm-1:confirmed:staff:therapist-home",
    metadata: {},
    read_at: null,
    resolved_at: null,
    created_at: "2026-11-27T04:00:00.000Z",
    ...overrides,
  };
}

describe("Stage WEB-1 deliverWorkspaceNotificationPush Stage C validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-27T04:00:00.000Z"));
    pushState.sentPayloads = [];
    pushState.bookingDate = "2026-11-27";
    pushState.subscriptions = [
      {
        id: "sub-home-1",
        auth_user_id: "auth-1",
        staff_id: "therapist-home",
        branch_id: "branch-home",
        workspace: "staff",
        endpoint: "https://push.example/therapist-home",
        p256dh: "p256dh",
        auth_secret: "secret",
        device_label: "Pixel",
        user_agent: "Chrome",
        is_active: true,
        failure_count: 0,
        last_failure_at: null,
        last_success_at: null,
        created_at: "2026-11-27T00:00:00.000Z",
        updated_at: "2026-11-27T00:00:00.000Z",
      },
    ];
    pushState.staff = [
      {
        id: "therapist-home",
        auth_user_id: "auth-1",
        branch_id: "branch-home",
        system_role: "service_staff",
        staff_type: "therapist",
        is_active: true,
      },
    ];
    pushState.assistanceRows = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suppresses cross-branch push for unarrived approved, expired, or off-date assistance", async () => {
    // 1. Pre-arrival approved row
    pushState.assistanceRows = [
      {
        id: "assign-approved",
        staff_id: "therapist-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-27",
        end_at: "2026-11-27T11:00:00Z",
        status: "approved",
      },
    ];
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // 2. Expired arrived row (>12h past end_at)
    pushState.assistanceRows = [
      {
        id: "assign-expired",
        staff_id: "therapist-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-25",
        end_at: "2026-11-25T11:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // 3. Mismatched booking_date when assignment has already ended (not active overnight)
    pushState.bookingDate = "2026-11-26";
    pushState.assistanceRows = [
      {
        id: "assign-wrong-date",
        staff_id: "therapist-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-27",
        end_at: "2026-11-27T02:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });
    expect(pushState.sentPayloads).toHaveLength(0);
  });

  it("delivers cross-branch push when Stage C therapist is arrived_clocked_in on matching date or active overnight", async () => {
    // Matching same-day assignment
    pushState.assistanceRows = [
      {
        id: "assign-active",
        staff_id: "therapist-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-27",
        end_at: "2026-11-27T11:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    const sameDayResult = await deliverWorkspaceNotificationPush(makeBookingNotice());
    expect(sameDayResult).toMatchObject({ attempted: 1, delivered: 1 });
    expect(pushState.sentPayloads).toHaveLength(1);

    // Active overnight extension across midnight (assistance Nov 26, end_at > now, booking Nov 27)
    pushState.sentPayloads = [];
    pushState.assistanceRows = [
      {
        id: "assign-overnight",
        staff_id: "therapist-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-26",
        end_at: "2026-11-27T06:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    const overnightResult = await deliverWorkspaceNotificationPush(makeBookingNotice());
    expect(overnightResult).toMatchObject({ attempted: 1, delivered: 1 });
    expect(pushState.sentPayloads).toHaveLength(1);
  });
});
