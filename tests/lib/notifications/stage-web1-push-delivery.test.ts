import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceNotification } from "@/lib/notifications/types";

vi.mock("server-only", () => ({}));

const pushState = vi.hoisted(() => ({
  subscriptions: [] as Array<Record<string, unknown>>,
  staff: [] as Array<Record<string, unknown>>,
  booking: null as Record<string, unknown> | null,
  bookingError: null as unknown | null,
  assistanceRows: [] as Array<Record<string, unknown>>,
  assistanceError: null as unknown | null,
  notifications: [] as Array<Record<string, unknown>>,
  outboxJobs: [] as Array<Record<string, unknown>>,
  bypassBookingQueryEq: false,
  bypassAssistanceQueryEq: false,
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
    rpc: vi.fn(async (fn: string) => {
      if (fn === "claim_service_transition_push_jobs") {
        return { data: pushState.outboxJobs, error: null };
      }
      if (fn === "finish_service_transition_push_job") {
        return { data: true, error: null };
      }
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      const eqs: Record<string, unknown> = {};
      const ins: Record<string, unknown[]> = {};
      let insertedRow: Record<string, unknown> | null = null;
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "update", "limit", "order", "gte", "lte", "not", "is"]) {
        chain[method] = vi.fn(() => chain);
      }
      chain.insert = vi.fn((payload: Record<string, unknown>) => {
        insertedRow = { id: `notif-inserted-${pushState.notifications.length + 1}`, ...payload };
        pushState.notifications.push(insertedRow);
        return chain;
      });
      chain.eq = vi.fn((col: string, val: unknown) => {
        eqs[col] = val;
        return chain;
      });
      chain.in = vi.fn((col: string, vals: unknown[]) => {
        ins[col] = vals;
        return chain;
      });
      chain.single = vi.fn(async () => {
        if (table === "workspace_notifications" && insertedRow) {
          return { data: insertedRow, error: null };
        }
        return { data: null, error: null };
      });
      chain.maybeSingle = vi.fn(async () => {
        if (table === "bookings") {
          if (pushState.bookingError) return { data: null, error: pushState.bookingError };
          if (!pushState.booking) return { data: null, error: null };
          if (!pushState.bypassBookingQueryEq) {
            if (eqs.id && pushState.booking.id !== eqs.id) return { data: null, error: null };
            if (eqs.branch_id && pushState.booking.branch_id !== eqs.branch_id) {
              return { data: null, error: null };
            }
          }
          return { data: pushState.booking, error: null };
        }
        if (table === "workspace_notifications") {
          const found = pushState.notifications.find((row) => !eqs.id || row.id === eqs.id) ?? null;
          return { data: found, error: null };
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
          if (pushState.assistanceError) {
            return Promise.resolve({ data: null, error: pushState.assistanceError }).then(resolve);
          }
          const rows = pushState.bypassAssistanceQueryEq
            ? pushState.assistanceRows
            : pushState.assistanceRows.filter((row) => {
                if (eqs.staff_id && row.staff_id !== eqs.staff_id) return false;
                if (eqs.receiving_branch_id && row.receiving_branch_id !== eqs.receiving_branch_id) {
                  return false;
                }
                if (eqs.status && row.status !== eqs.status) return false;
                return true;
              });
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
        if (table === "workspace_notifications") {
          const rows = pushState.notifications.filter((row) => {
            if (eqs.dedupe_key && row.dedupe_key !== eqs.dedupe_key) return false;
            return true;
          });
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
        if (table === "bookings") {
          if (!pushState.booking) return Promise.resolve({ data: [], error: null }).then(resolve);
          if (eqs.booking_date && pushState.booking.booking_date !== eqs.booking_date) {
            return Promise.resolve({ data: [], error: null }).then(resolve);
          }
          return Promise.resolve({ data: [pushState.booking], error: null }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      };
      return chain;
    }),
  }),
}));

import { deliverWorkspaceNotificationPush } from "@/lib/notifications/push/delivery";
import { drainServiceTransitionPushOutbox } from "@/lib/notifications/push/service-transition-outbox";
import { publishServiceTransition } from "@/lib/bookings/service-transition-notifications";
import { runTherapistServiceStartPush } from "@/lib/bookings/therapist-service-start-push";
import {
  createNotificationOnce,
  createOrUpdateNotification,
} from "@/lib/notifications/workflow-notifications-store";

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

function makeAssistanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "assign-1",
    staff_id: "therapist-home",
    home_branch_id: "branch-home",
    receiving_branch_id: "branch-receiving",
    assistance_date: "2026-11-27",
    start_at: "2026-11-27T01:00:00Z", // 09:00 Asia/Manila
    end_at: "2026-11-27T11:00:00Z", // 19:00 Asia/Manila
    status: "arrived_clocked_in",
    ...overrides,
  };
}

function makeBookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-sm-1",
    branch_id: "branch-receiving",
    staff_id: "therapist-home",
    resource_id: "room-1",
    booking_date: "2026-11-27",
    start_time: "12:01:00",
    delivery_type: "in_spa",
    status: "confirmed",
    booking_progress_status: "not_started",
    session_started_at: null,
    session_completed_at: null,
    session_completion_source: null,
    customers: { full_name: "Guest One" },
    booking_attendees: { display_name: "Guest One" },
    services: { name: "Signature Massage" },
    ...overrides,
  };
}

describe("Stage WEB-1 deliverWorkspaceNotificationPush Stage C authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-27T04:00:00.000Z")); // 12:00 Asia/Manila
    pushState.sentPayloads = [];
    pushState.bookingError = null;
    pushState.assistanceError = null;
    pushState.bypassBookingQueryEq = false;
    pushState.bypassAssistanceQueryEq = false;
    pushState.notifications = [];
    pushState.outboxJobs = [];
    pushState.booking = makeBookingRow();
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
        archived_at: null,
        merged_into_staff_id: null,
      },
    ];
    pushState.assistanceRows = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves normal same-branch, driver, utility, and CRM notifications unchanged", async () => {
    pushState.subscriptions = [
      {
        id: "sub-staff-same",
        auth_user_id: "auth-staff",
        staff_id: "staff-main",
        branch_id: "branch-main",
        workspace: "staff",
        endpoint: "https://push.example/staff-main",
        p256dh: "p256dh",
        auth_secret: "secret",
        device_label: "Phone",
        user_agent: "Chrome",
        is_active: true,
        failure_count: 0,
        last_failure_at: null,
        last_success_at: null,
        created_at: "2026-11-27T00:00:00.000Z",
        updated_at: "2026-11-27T00:00:00.000Z",
      },
      {
        id: "sub-driver",
        auth_user_id: "auth-driver",
        staff_id: "driver-main",
        branch_id: "branch-main",
        workspace: "driver",
        endpoint: "https://push.example/driver-main",
        p256dh: "p256dh",
        auth_secret: "secret",
        device_label: "Phone",
        user_agent: "Chrome",
        is_active: true,
        failure_count: 0,
        last_failure_at: null,
        last_success_at: null,
        created_at: "2026-11-27T00:00:00.000Z",
        updated_at: "2026-11-27T00:00:00.000Z",
      },
      {
        id: "sub-utility",
        auth_user_id: "auth-utility",
        staff_id: "utility-main",
        branch_id: "branch-main",
        workspace: "utility",
        endpoint: "https://push.example/utility-main",
        p256dh: "p256dh",
        auth_secret: "secret",
        device_label: "Phone",
        user_agent: "Chrome",
        is_active: true,
        failure_count: 0,
        last_failure_at: null,
        last_success_at: null,
        created_at: "2026-11-27T00:00:00.000Z",
        updated_at: "2026-11-27T00:00:00.000Z",
      },
      {
        id: "sub-crm",
        auth_user_id: "auth-crm",
        staff_id: "crm-main",
        branch_id: "branch-main",
        workspace: "crm",
        endpoint: "https://push.example/crm-main",
        p256dh: "p256dh",
        auth_secret: "secret",
        device_label: "Desktop",
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
        id: "staff-main",
        auth_user_id: "auth-staff",
        branch_id: "branch-main",
        system_role: "service_staff",
        staff_type: "therapist",
        is_active: true,
      },
      {
        id: "driver-main",
        auth_user_id: "auth-driver",
        branch_id: "branch-main",
        system_role: "driver",
        staff_type: "driver",
        is_active: true,
      },
      {
        id: "utility-main",
        auth_user_id: "auth-utility",
        branch_id: "branch-main",
        system_role: "utility",
        staff_type: "utility",
        is_active: true,
      },
      {
        id: "crm-main",
        auth_user_id: "auth-crm",
        branch_id: "branch-main",
        system_role: "crm",
        staff_type: "csr",
        is_active: true,
      },
    ];

    expect(
      await deliverWorkspaceNotificationPush(
        makeBookingNotice({
          branch_id: "branch-main",
          target_workspace: "staff",
          recipient_staff_id: "staff-main",
          entity_id: "same-branch-booking",
        })
      )
    ).toMatchObject({ attempted: 1, delivered: 1 });
    expect(
      await deliverWorkspaceNotificationPush(
        makeBookingNotice({
          branch_id: "branch-main",
          target_workspace: "driver",
          recipient_staff_id: "driver-main",
          type: "home_service_assigned",
        })
      )
    ).toMatchObject({ attempted: 1, delivered: 1 });
    expect(
      await deliverWorkspaceNotificationPush(
        makeBookingNotice({
          branch_id: "branch-main",
          target_workspace: "utility",
          recipient_staff_id: "utility-main",
          entity_type: "branch_resource",
          entity_id: "room-1",
          type: "booking_status_changed",
        })
      )
    ).toMatchObject({ attempted: 1, delivered: 1 });
    expect(
      await deliverWorkspaceNotificationPush(
        makeBookingNotice({
          branch_id: "branch-main",
          target_workspace: "crm",
          recipient_staff_id: null,
          type: "payment_pending",
        })
      )
    ).toMatchObject({ attempted: 1, delivered: 1 });
    expect(pushState.sentPayloads).toHaveLength(4);
  });

  it("delivers cross-branch push for valid active assistance and midnight-crossing overnight shifts", async () => {
    // 1. Valid same-day Stage C borrowed therapist
    pushState.assistanceRows = [makeAssistanceRow()];
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 1,
      delivered: 1,
    });
    expect(pushState.sentPayloads).toHaveLength(1);

    // 2. Genuine overnight assignment crossing Manila midnight (22:00 Manila Nov 26 -> 04:00 Manila Nov 27)
    // Note: in UTC this is 2026-11-26T14:00:00Z -> 2026-11-26T20:00:00Z, verifying Asia/Manila interpretation!
    vi.setSystemTime(new Date("2026-11-26T18:00:00.000Z")); // 02:00 Manila Nov 27
    pushState.sentPayloads = [];
    pushState.booking = makeBookingRow({ booking_date: "2026-11-27" });
    pushState.assistanceRows = [
      makeAssistanceRow({
        id: "assign-overnight-manila",
        assistance_date: "2026-11-26",
        start_at: "2026-11-26T14:00:00+00:00",
        end_at: "2026-11-26T20:00:00+00:00",
      }),
    ];
    expect(
      await deliverWorkspaceNotificationPush(
        makeBookingNotice({ created_at: "2026-11-26T18:00:00.000Z" })
      )
    ).toMatchObject({ attempted: 1, delivered: 1 });
    expect(pushState.sentPayloads).toHaveLength(1);
  });

  it("allows legitimate delayed service completion outbox push using authoritative event-time evidence", async () => {
    // Shift 09:00..19:00 Manila (01:00Z..11:00Z). Session started 17:00, completed 18:30 (10:30Z).
    // Push delivered via outbox at 20:00 Manila (12:00Z), 1h after shift end.
    vi.setSystemTime(new Date("2026-11-27T12:00:00.000Z"));
    pushState.assistanceRows = [makeAssistanceRow()];
    pushState.booking = makeBookingRow({
      status: "completed",
      booking_progress_status: "completed",
      session_started_at: "2026-11-27T09:00:00.000Z",
      session_completed_at: "2026-11-27T10:30:00.000Z",
    });
    const completionNotice = makeBookingNotice({
      id: "notif-comp-1",
      type: "booking_status_changed",
      title: "Service Completed",
      metadata: {
        service_transition: "completed",
        service_transition_event_id: "service_completed:booking-sm-1:2026-11-27T10:30:00.000Z",
        service_transition_at: "2026-11-27T10:30:00.000Z",
      },
      created_at: "2026-11-27T10:30:01.000Z",
    });
    pushState.notifications = [completionNotice];
    pushState.outboxJobs = [
      {
        notification_id: "notif-comp-1",
        delivered_subscription_ids: [],
        lease_token: "lease-1",
      },
    ];

    const outboxResult = await drainServiceTransitionPushOutbox({ limit: 3 });
    expect(outboxResult).toEqual({ claimed: 1, completed: 1, pending: 0 });
    expect(pushState.sentPayloads).toHaveLength(1);
  });

  it("fails closed for daytime shift next-day requests, pre/post-assignment dates, and bad booking states", async () => {
    pushState.assistanceRows = [makeAssistanceRow()]; // 2026-11-27 09:00..19:00 Manila

    // Ordinary daytime shift requesting next-day (2026-11-28) notification while shift active
    pushState.booking = makeBookingRow({ booking_date: "2026-11-28" });
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // Booking dated BEFORE assistance assignment (2026-11-26 vs 2026-11-27)
    pushState.booking = makeBookingRow({ booking_date: "2026-11-26" });
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // Booking dated AFTER assistance assignment (2026-11-30 vs 2026-11-27)
    pushState.booking = makeBookingRow({ booking_date: "2026-11-30" });
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // Shift ending cleanly at midnight 00:00 Manila (16:00Z Nov 27) must NOT open Nov 28 bookings
    pushState.booking = makeBookingRow({ booking_date: "2026-11-28" });
    pushState.assistanceRows = [
      makeAssistanceRow({
        start_at: "2026-11-27T06:00:00Z",
        end_at: "2026-11-27T16:00:00Z", // 00:00:00 Manila Nov 28
      }),
    ];
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // Missing booking ID (entity_id = null or empty)
    pushState.assistanceRows = [makeAssistanceRow()];
    pushState.booking = makeBookingRow();
    expect(
      await deliverWorkspaceNotificationPush(makeBookingNotice({ entity_id: null }))
    ).toMatchObject({ attempted: 0, delivered: 0 });
    expect(
      await deliverWorkspaceNotificationPush(makeBookingNotice({ entity_id: "" }))
    ).toMatchObject({ attempted: 0, delivered: 0 });

    // Missing or invalid calendar booking date
    pushState.booking = makeBookingRow({ booking_date: null });
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });
    pushState.booking = makeBookingRow({ booking_date: "2026-02-30" });
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // Booking lookup failure or missing booking row
    pushState.booking = null;
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });
    pushState.booking = makeBookingRow();
    pushState.bookingError = new Error("DB connection failed");
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });
    expect(pushState.sentPayloads).toHaveLength(0);
  });

  it("fails closed on missing/malformed assistance metadata, unarrived status, expired window, wrong branch, and wrong therapist", async () => {
    // Missing start_at / end_at / naive timestamp without offset / inverted window / assistance_date mismatch
    const badAssistanceRows = [
      makeAssistanceRow({ start_at: null }),
      makeAssistanceRow({ end_at: null }),
      makeAssistanceRow({ start_at: "2026-11-27T09:00:00" }), // missing TZ offset
      makeAssistanceRow({ end_at: "2026-11-27T09:00:00" }), // missing TZ offset
      makeAssistanceRow({ start_at: "not-a-date" }),
      makeAssistanceRow({ end_at: "2026-11-27T00:30:00Z" }), // end_at < start_at
      makeAssistanceRow({ assistance_date: "2026-11-26" }), // start_at is Nov 27 Manila, mismatches date
    ];
    for (const row of badAssistanceRows) {
      pushState.assistanceRows = [row];
      expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
        attempted: 0,
        delivered: 0,
      });
    }

    // Expired assistance window (1 minute past end_at — zero grace period!)
    vi.setSystemTime(new Date("2026-11-27T11:01:00.000Z"));
    pushState.assistanceRows = [makeAssistanceRow()];
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // Early/future assistance before 120m pre-shift arrival window
    vi.setSystemTime(new Date("2026-11-26T22:59:00.000Z")); // 121m before 01:00Z start
    expect(
      await deliverWorkspaceNotificationPush(
        makeBookingNotice({ created_at: "2026-11-26T22:59:00.000Z" })
      )
    ).toMatchObject({ attempted: 0, delivered: 0 });

    // Unapproved / unarrived / completed / cancelled assistance statuses
    vi.setSystemTime(new Date("2026-11-27T04:00:00.000Z"));
    for (const status of ["approved", "home_clocked_out", "completed", "cancelled", "expired"]) {
      pushState.assistanceRows = [makeAssistanceRow({ status })];
      expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
        attempted: 0,
        delivered: 0,
      });
    }

    // Wrong receiving branch & wrong assistance staff_id even when mock bypasses query eq
    pushState.bypassAssistanceQueryEq = true;
    pushState.assistanceRows = [makeAssistanceRow({ receiving_branch_id: "branch-other" })];
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });
    pushState.assistanceRows = [makeAssistanceRow({ staff_id: "therapist-other" })];
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });

    // Wrong booking therapist (e.g. booking reassigned away to someone else)
    pushState.bypassAssistanceQueryEq = false;
    pushState.assistanceRows = [makeAssistanceRow()];
    pushState.booking = makeBookingRow({ staff_id: "therapist-other" });
    expect(
      await deliverWorkspaceNotificationPush(makeBookingNotice({ type: "booking_reassigned" }))
    ).toMatchObject({ attempted: 0, delivered: 0 });

    // Other staff member's subscription cannot intercept notification even if same home branch
    pushState.booking = makeBookingRow();
    pushState.subscriptions = [
      {
        ...pushState.subscriptions[0]!,
        id: "sub-other",
        auth_user_id: "auth-other",
        staff_id: "therapist-other",
        endpoint: "https://push.example/other",
      },
    ];
    pushState.staff.push({
      id: "therapist-other",
      auth_user_id: "auth-other",
      branch_id: "branch-home",
      system_role: "service_staff",
      staff_type: "therapist",
      is_active: true,
    });
    expect(await deliverWorkspaceNotificationPush(makeBookingNotice())).toMatchObject({
      attempted: 0,
      delivered: 0,
    });
    expect(pushState.sentPayloads).toHaveLength(0);
  });

  it("blocks delayed non-completion and post-expiration completion notifications across alternative server callers", async () => {
    // 1. Assignment / reschedule created BEFORE end_at (10:00Z), processed AFTER end_at (11:30Z) -> blocked!
    vi.setSystemTime(new Date("2026-11-27T11:30:00.000Z"));
    pushState.assistanceRows = [makeAssistanceRow()]; // end_at = 11:00Z
    pushState.booking = makeBookingRow();

    expect(
      await deliverWorkspaceNotificationPush(
        makeBookingNotice({
          type: "booking_rescheduled",
          created_at: "2026-11-27T10:00:00.000Z",
        })
      )
    ).toMatchObject({ attempted: 0, delivered: 0 });

    // 2. Completion notification whose authoritative session_completed_at occurred AFTER end_at (11:15Z) -> blocked!
    pushState.booking = makeBookingRow({
      status: "completed",
      booking_progress_status: "completed",
      session_started_at: "2026-11-27T09:00:00.000Z",
      session_completed_at: "2026-11-27T11:15:00.000Z",
    });
    pushState.notifications = [
      makeBookingNotice({
        id: "notif-late-comp",
        type: "booking_status_changed",
        metadata: {
          service_transition: "completed",
          service_transition_at: "2026-11-27T11:15:00.000Z",
        },
        created_at: "2026-11-27T11:15:00.000Z",
      }),
    ];
    pushState.outboxJobs = [
      {
        notification_id: "notif-late-comp",
        delivered_subscription_ids: [],
        lease_token: "lease-late",
      },
    ];
    expect(await drainServiceTransitionPushOutbox({ limit: 3 })).toEqual({
      claimed: 1,
      completed: 1,
      pending: 0,
    });
    expect(pushState.sentPayloads).toHaveLength(0);

    // 3. Alternative server callers (manager/CRM/session-extension via createOrUpdateNotification / createNotificationOnce)
    // cannot bypass cross-branch authorization for next-day daytime shifts or reassigned bookings
    vi.setSystemTime(new Date("2026-11-27T04:00:00.000Z"));
    pushState.assistanceRows = [makeAssistanceRow()];
    pushState.booking = makeBookingRow({ booking_date: "2026-11-28" }); // daytime next-day -> unauthorized

    await createOrUpdateNotification({
      branchId: "branch-receiving",
      targetWorkspace: "staff",
      recipientStaffId: "therapist-home",
      type: "booking_rescheduled",
      title: "Booking rescheduled",
      entityType: "booking",
      entityId: "booking-sm-1",
      actionHref: "/staff-portal/schedule",
    });
    await createNotificationOnce({
      branchId: "branch-receiving",
      targetWorkspace: "staff",
      recipientStaffId: "therapist-home",
      type: "booking_status_changed",
      title: "Service starting soon",
      entityType: "booking",
      entityId: "booking-sm-1",
      actionHref: "/staff-portal/service-progress",
      metadata: { service_start_reminder: true },
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(pushState.sentPayloads).toHaveLength(0);

    // 4. Direct alternative server entry points: runTherapistServiceStartPush and publishServiceTransition
    // against real deliverWorkspaceNotificationPush cannot bypass expired or unarrived cross-branch checks
    pushState.outboxJobs = [];
    pushState.notifications = [];
    pushState.assistanceRows = [makeAssistanceRow({ status: "approved" })]; // unarrived
    pushState.booking = makeBookingRow({
      booking_date: "2026-11-27",
      start_time: "12:01:00",
      session_started_at: null,
    });
    const reminderStats = await runTherapistServiceStartPush({
      now: new Date("2026-11-27T04:00:00.000Z"),
    });
    expect(reminderStats.processed).toBe(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(pushState.sentPayloads).toHaveLength(0);

    pushState.notifications = [];
    pushState.assistanceRows = [makeAssistanceRow({ end_at: "2026-11-27T03:00:00.000Z" })]; // expired
    pushState.booking = makeBookingRow({
      booking_date: "2026-11-27",
      session_started_at: "2026-11-27T04:00:00.000Z",
    });
    await publishServiceTransition({
      bookingId: "booking-sm-1",
      branchId: "branch-receiving",
      actorStaffId: "therapist-home",
      transition: "started",
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(pushState.sentPayloads).toHaveLength(0);
  });
});
