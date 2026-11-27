import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn() })) }));

const state = vi.hoisted(() => ({
  user: { id: "auth-1" } as { id: string } | null,
  staff: {
    id: "therapist-home",
    full_name: "Ana Therapist",
    nickname: "Ana",
    phone: null,
    tier: "senior",
    system_role: "service_staff",
    staff_type: "therapist",
    branch_id: "branch-home",
    is_active: true,
    avatar_url: null,
    avatar_path: null,
    branches: { name: "Main Branch" },
  } as Record<string, unknown> | null,
  booking: null as Record<string, unknown> | null,
  assistanceRows: [] as Array<Record<string, unknown>>,
  notices: [] as Array<Record<string, unknown>>,
  bookingsList: [] as Array<Record<string, unknown>>,
  checkinsList: [] as Array<Record<string, unknown>>,
  exceptionsList: [] as Array<Record<string, unknown>>,
  createdNotifications: [] as Array<Record<string, unknown>>,
  noticeUpdates: [] as Array<{ payload: Record<string, unknown>; eqs: Record<string, unknown> }>,
  rpcCalls: [] as Array<{ fn: string; params: Record<string, unknown> }>,
  devBypass: false,
}));

function buildMockDb(mode: "user" | "admin") {
  return {
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    rpc: vi.fn(async (fn: string, params: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, params });
      if (fn === "start_booking_service_session") {
        return {
          data: { started_at: "2026-11-27T02:00:00.000Z", already_started: false },
          error: null,
        };
      }
      if (fn === "complete_booking_service_session") {
        return {
          data: { completed_at: "2026-11-27T03:00:00.000Z", already_completed: false },
          error: null,
        };
      }
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      const eqs: Record<string, unknown> = {};
      const ins: Record<string, unknown[]> = {};
      let updatePayload: Record<string, unknown> | null = null;
      const chain: Record<string, unknown> = {};

      for (const method of ["select", "is", "or", "gte", "lte", "order", "limit", "neq", "not"]) {
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
      chain.update = vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return chain;
      });

      const resolveSingle = async () => {
        if (table === "staff") {
          if (!state.staff) return { data: null, error: null };
          if (eqs.id && state.staff.id !== eqs.id) return { data: null, error: null };
          if (eqs.branch_id && state.staff.branch_id !== eqs.branch_id)
            return { data: null, error: null };
          return { data: state.staff, error: null };
        }
        if (table === "bookings") {
          if (!state.booking) return { data: null, error: null };
          if (eqs.id && state.booking.id !== eqs.id) return { data: null, error: null };
          if (eqs.branch_id && state.booking.branch_id !== eqs.branch_id)
            return { data: null, error: null };
          return { data: state.booking, error: null };
        }
        if (table === "workspace_notifications" && updatePayload) {
          state.noticeUpdates.push({ payload: updatePayload, eqs: { ...eqs } });
          return { data: { id: eqs.id ?? "notice-1" }, error: null };
        }
        return { data: null, error: null };
      };

      chain.maybeSingle = resolveSingle;
      chain.single = resolveSingle;
      chain.then = (resolve: (val: unknown) => void) => {
        if (table === "staff_assistance_assignments") {
          const filtered = state.assistanceRows.filter((row) => {
            if (eqs.staff_id && row.staff_id !== eqs.staff_id) return false;
            if (eqs.receiving_branch_id && row.receiving_branch_id !== eqs.receiving_branch_id)
              return false;
            if (eqs.assistance_date && row.assistance_date !== eqs.assistance_date) return false;
            if (eqs.status && row.status !== eqs.status) return false;
            if (ins.status && !ins.status.includes(row.status)) return false;
            return true;
          });
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        }
        if (table === "staff") {
          const ok =
            state.staff &&
            (!ins.id || ins.id.includes(state.staff.id)) &&
            (!eqs.is_active || state.staff.is_active === eqs.is_active);
          return Promise.resolve({ data: ok ? [state.staff] : [], error: null }).then(resolve);
        }
        if (table === "branches") {
          return Promise.resolve({
            data: [
              { id: "branch-home", name: "Main Branch" },
              { id: "branch-receiving", name: "SM Branch" },
            ],
            error: null,
          }).then(resolve);
        }
        if (table === "workspace_notifications") {
          const filtered = state.notices.filter((row) => {
            if (eqs.branch_id && row.branch_id !== eqs.branch_id) return false;
            if (ins.branch_id && !ins.branch_id.includes(row.branch_id)) return false;
            if (eqs.recipient_staff_id && row.recipient_staff_id !== eqs.recipient_staff_id)
              return false;
            return true;
          });
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        }
        if (table === "bookings") {
          const source =
            state.bookingsList.length > 0
              ? state.bookingsList
              : state.booking
                ? [state.booking]
                : [];
          const filtered = source.filter((row) => {
            if (eqs.branch_id && row.branch_id !== eqs.branch_id) return false;
            if (ins.branch_id && !ins.branch_id.includes(row.branch_id)) return false;
            if (ins.id && !ins.id.includes(row.id)) return false;
            return true;
          });
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        }
        if (table === "staff_shift_checkins") {
          return Promise.resolve({ data: state.checkinsList, error: null }).then(resolve);
        }
        if (table === "attendance_exceptions") {
          return Promise.resolve({ data: state.exceptionsList, error: null }).then(resolve);
        }
        void mode;
        return Promise.resolve({ data: [], error: null }).then(resolve);
      };
      return chain;
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => buildMockDb("user")),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => buildMockDb("admin")),
}));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => state.devBypass,
  getDevBypassStaffRecord: () => state.staff,
}));
vi.mock("@/lib/notifications/create", () => ({
  createNotificationOnce: vi.fn(async (input: Record<string, unknown>) => {
    state.createdNotifications.push(input);
    return input;
  }),
  createNotification: vi.fn(async (input: Record<string, unknown>) => {
    state.createdNotifications.push(input);
    return input;
  }),
}));
vi.mock("@/lib/bookings/service-transition-notifications", () => ({
  publishServiceTransition: vi.fn(async () => undefined),
}));
vi.mock("@/lib/staff-pwa/utility-turnover", () => ({
  triggerUtilityRoomTurnoverOnServiceCompletion: vi.fn(async () => ({ ok: true, skipped: false })),
}));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: vi.fn(),
}));
vi.mock("@/lib/staff-pwa/provider-date", () => ({
  getProviderBusinessDate: vi.fn(async () => "2026-11-27"),
}));
vi.mock("@/lib/staff-pwa/staff-context", () => ({
  getStaffPwaContext: vi.fn(async () => ({
    db: buildMockDb("user"),
    staff: {
      id: String(state.staff?.id ?? "therapist-home"),
      branch_id: String(state.staff?.branch_id ?? "branch-home"),
      system_role: String(state.staff?.system_role ?? "service_staff"),
      staff_type: (state.staff?.staff_type as string | null) ?? "therapist",
    },
    group: "provider",
  })),
}));

import { notifyConfirmedAssignedStaff } from "@/lib/bookings/confirmed-staff-notification";
import { getStaffNotices } from "@/lib/staff-pwa/notices-runtime";
import { markStaffNoticeRead } from "@/lib/staff-pwa/notice-actions";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";
import { getNotificationTargetPath } from "@/lib/notifications/notification-targets";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-27T04:00:00.000Z"));
  state.staff = {
    id: "therapist-home",
    auth_user_id: "auth-1",
    full_name: "Ana Therapist",
    nickname: "Ana",
    phone: null,
    tier: "senior",
    system_role: "service_staff",
    staff_type: "therapist",
    branch_id: "branch-home",
    is_active: true,
    archived_at: null,
    merged_into_staff_id: null,
    avatar_url: null,
    avatar_path: null,
    branches: { name: "Main Branch" },
  };
  state.booking = {
    id: "booking-sm-1",
    branch_id: "branch-receiving",
    staff_id: "therapist-home",
    driver_id: null,
    booking_date: "2026-11-27",
    start_time: "14:00:00",
    type: "walk_in",
    delivery_type: "in_spa",
    status: "confirmed",
    booking_progress_status: "checked_in",
    customers: { full_name: "Guest One" },
    booking_attendees: { display_name: "Guest One" },
    services: { name: "Signature Massage" },
  };
  state.assistanceRows = [];
  state.notices = [];
  state.bookingsList = [];
  state.checkinsList = [];
  state.exceptionsList = [];
  state.createdNotifications = [];
  state.noticeUpdates = [];
  state.rpcCalls = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Stage WEB-1 Borrowed Stage C Therapist & Notification Stabilization", () => {
  it("notifies confirmed receiving-branch booking only when Stage C assistance is arrived_clocked_in on matching date", async () => {
    await notifyConfirmedAssignedStaff("booking-sm-1", "branch-receiving");
    expect(state.createdNotifications).toHaveLength(0);

    // Pre-arrival approved assignment must NOT receive receiving-branch booking alerts yet
    state.assistanceRows = [
      {
        id: "assign-approved",
        request_id: "req-1",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        requested_role: "therapist",
        visit_type: "full_day",
        start_at: "2026-11-27T01:00:00Z",
        end_at: "2026-11-27T11:00:00Z",
        assistance_date: "2026-11-27",
        status: "approved",
        home_clocked_out_at: null,
        receiving_checkin_id: null,
        arrived_clocked_in_at: null,
        completed_at: null,
      },
    ];
    await notifyConfirmedAssignedStaff("booking-sm-1", "branch-receiving");
    expect(state.createdNotifications).toHaveLength(0);

    // Different assistance date must also be rejected
    state.assistanceRows = [
      {
        ...state.assistanceRows[0],
        id: "assign-wrong-date",
        assistance_date: "2026-11-26",
        status: "arrived_clocked_in",
      },
    ];
    await notifyConfirmedAssignedStaff("booking-sm-1", "branch-receiving");
    expect(state.createdNotifications).toHaveLength(0);

    // Expired end_at must NOT trigger receiving-branch customer notifications
    state.assistanceRows = [
      {
        ...state.assistanceRows[0],
        id: "assign-expired-today",
        assistance_date: "2026-11-27",
        start_at: "2026-11-27T00:00:00Z",
        end_at: "2026-11-27T03:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    await notifyConfirmedAssignedStaff("booking-sm-1", "branch-receiving");
    expect(state.createdNotifications).toHaveLength(0);

    state.assistanceRows = [
      {
        id: "assign-1",
        request_id: "req-1",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        requested_role: "therapist",
        visit_type: "full_day",
        start_at: "2026-11-27T01:00:00Z",
        end_at: "2026-11-27T11:00:00Z",
        assistance_date: "2026-11-27",
        status: "arrived_clocked_in",
        home_clocked_out_at: null,
        receiving_checkin_id: "chk-1",
        arrived_clocked_in_at: "2026-11-27T01:05:00Z",
        completed_at: null,
      },
    ];

    await notifyConfirmedAssignedStaff("booking-sm-1", "branch-receiving");
    expect(state.createdNotifications).toHaveLength(1);
    expect(state.createdNotifications[0]).toMatchObject({
      branchId: "branch-receiving",
      targetWorkspace: "staff",
      recipientStaffId: "therapist-home",
      entityId: "booking-sm-1",
    });
  });

  it("loads and marks read receiving-branch notices for arrived Stage C therapist while rejecting unarrived, expired, and off-date rows", async () => {
    const noticeRow = {
      id: "notice-sm-1",
      branch_id: "branch-receiving",
      target_workspace: "staff",
      target_role: null,
      recipient_staff_id: "therapist-home",
      status: "unread",
      resolved_at: null,
      type: "booking_assigned",
      title: "New booking — Guest One",
      body: "Signature Massage",
      entity_type: "booking",
      entity_id: "booking-sm-1",
      created_at: new Date().toISOString(),
      requires_action: false,
      metadata: {},
    };
    state.notices = [noticeRow];
    state.bookingsList = [state.booking!];

    // Without Stage C assistance row -> receiving-branch notice must NOT load
    expect((await getStaffNotices()).items).toEqual([]);

    // Pre-arrival approved assignment -> must NOT load
    state.assistanceRows = [
      {
        id: "assign-approved",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-27",
        end_at: "2026-11-27T11:00:00Z",
        status: "approved",
      },
    ];
    expect((await getStaffNotices()).items).toEqual([]);

    // Expired arrived assignment (past end_at -> zero grace bypass) -> must NOT load
    state.assistanceRows = [
      {
        id: "assign-expired",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-25",
        start_at: "2026-11-25T01:00:00Z",
        end_at: "2026-11-25T11:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    expect((await getStaffNotices()).items).toEqual([]);

    // Same-day assignment just past end_at (e.g. 09:00..11:50 Manila, now 12:00 Manila) -> must NOT load
    state.assistanceRows = [
      {
        id: "assign-ended-10m-ago",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-27",
        start_at: "2026-11-27T01:00:00Z",
        end_at: "2026-11-27T03:50:00Z",
        status: "arrived_clocked_in",
      },
    ];
    expect((await getStaffNotices()).items).toEqual([]);

    // Missing start_at or end_at -> fail closed, must NOT load
    state.assistanceRows = [
      {
        id: "assign-missing-start",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-27",
        end_at: "2026-11-27T11:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    expect((await getStaffNotices()).items).toEqual([]);

    // Active arrived daytime assignment on 2026-11-27 must NOT expose off-date (2026-11-25) OR next-day (2026-11-28) bookings
    state.assistanceRows = [
      {
        id: "assign-1",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-27",
        start_at: "2026-11-27T01:00:00Z",
        end_at: "2026-11-27T11:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    state.bookingsList = [{ ...state.booking!, booking_date: "2026-11-25" }];
    expect((await getStaffNotices()).items).toEqual([]);
    state.bookingsList = [{ ...state.booking!, booking_date: "2026-11-28" }];
    expect((await getStaffNotices()).items).toEqual([]);

    // Active arrived assignment + matching booking date -> loads and marks read on notice.branch_id
    state.bookingsList = [state.booking!];
    const loaded = await getStaffNotices();
    expect(loaded.items).toHaveLength(1);
    expect(loaded.items[0]).toMatchObject({ id: "notice-sm-1", href: "/staff/progress" });

    // Genuine overnight shift crossing Manila midnight (Nov 26 22:00 -> Nov 27 14:00) exposes Nov 27 booking
    state.assistanceRows = [
      {
        id: "assign-overnight-active",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        assistance_date: "2026-11-26",
        start_at: "2026-11-26T14:00:00Z",
        end_at: "2026-11-27T06:00:00Z",
        status: "arrived_clocked_in",
      },
    ];
    expect((await getStaffNotices()).items).toHaveLength(1);

    const marked = await markStaffNoticeRead("notice-sm-1");
    expect(marked).toEqual({ ok: true });
    expect(state.noticeUpdates[0]?.eqs.branch_id).toBe("branch-receiving");
  });

  it("permits arrived Stage C borrowed therapist to start and complete service across branch boundary while enforcing guards", async () => {
    // Unborrowed / unarrived cross-branch booking must still be rejected
    const deniedUnarrived = await updateBookingProgressAction({
      bookingId: "booking-sm-1",
      nextStatus: "session_started",
    });
    expect(deniedUnarrived).toMatchObject({
      ok: false,
      code: "PERMISSION_DENIED",
      message: "This booking is outside your branch.",
    });

    // Arrived Stage C borrowed therapist -> allowed for session_started and completed
    state.assistanceRows = [
      {
        id: "assign-1",
        request_id: "req-1",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        requested_role: "therapist",
        visit_type: "full_day",
        start_at: "2026-11-27T01:00:00Z",
        end_at: "2026-11-27T11:00:00Z",
        assistance_date: "2026-11-27",
        status: "arrived_clocked_in",
        home_clocked_out_at: null,
        receiving_checkin_id: "chk-1",
        arrived_clocked_in_at: "2026-11-27T01:05:00Z",
        completed_at: null,
      },
    ];

    // Cross-branch non-session transitions (e.g. checked_in) stay forbidden for non-owners
    const deniedCheckin = await updateBookingProgressAction({
      bookingId: "booking-sm-1",
      nextStatus: "checked_in",
    });
    expect(deniedCheckin).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });

    const started = await updateBookingProgressAction({
      bookingId: "booking-sm-1",
      nextStatus: "session_started",
    });
    expect(started).toMatchObject({ ok: true, status: "session_started" });
    expect(state.rpcCalls[0]).toEqual({
      fn: "start_booking_service_session",
      params: {
        p_booking_id: "booking-sm-1",
        p_source: "staff_portal",
        p_actor_staff_id: "therapist-home",
      },
    });

    state.booking = {
      ...state.booking!,
      status: "in_progress",
      booking_progress_status: "session_started",
    };
    const completed = await updateBookingProgressAction({
      bookingId: "booking-sm-1",
      nextStatus: "completed",
    });
    expect(completed).toMatchObject({ ok: true, status: "completed" });
    expect(state.rpcCalls[1]).toEqual({
      fn: "complete_booking_service_session",
      params: {
        p_booking_id: "booking-sm-1",
        p_completion_source: "staff_manual",
        p_actor_staff_id: "therapist-home",
      },
    });

    // Overnight Stage C session started before midnight can be completed post-midnight within bounds
    state.booking = {
      ...state.booking!,
      booking_date: "2026-11-27",
      status: "in_progress",
      booking_progress_status: "session_started",
    };
    state.assistanceRows = [
      {
        id: "assign-overnight",
        request_id: "req-2",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        requested_role: "therapist",
        visit_type: "full_day",
        start_at: "2026-11-26T14:00:00Z",
        end_at: "2026-11-27T02:00:00Z",
        assistance_date: "2026-11-26",
        status: "arrived_clocked_in",
        home_clocked_out_at: null,
        receiving_checkin_id: "chk-2",
        arrived_clocked_in_at: "2026-11-26T14:05:00Z",
        completed_at: null,
      },
    ];
    const overnightCompleted = await updateBookingProgressAction({
      bookingId: "booking-sm-1",
      nextStatus: "completed",
    });
    expect(overnightCompleted).toMatchObject({ ok: true, status: "completed" });
    expect(state.rpcCalls).toHaveLength(3);

    // Expired same-day assistance (end_at in the past) cannot start a new cross-branch service session
    state.booking = {
      ...state.booking!,
      booking_date: "2026-11-27",
      status: "confirmed",
      booking_progress_status: "checked_in",
    };
    state.assistanceRows = [
      {
        id: "assign-expired-start",
        request_id: "req-3",
        staff_id: "therapist-home",
        home_branch_id: "branch-home",
        receiving_branch_id: "branch-receiving",
        requested_role: "therapist",
        visit_type: "full_day",
        start_at: "2026-11-27T00:00:00Z",
        end_at: "2026-11-27T03:00:00Z",
        assistance_date: "2026-11-27",
        status: "arrived_clocked_in",
        home_clocked_out_at: null,
        receiving_checkin_id: "chk-3",
        arrived_clocked_in_at: "2026-11-27T00:05:00Z",
        completed_at: null,
      },
    ];
    const deniedExpired = await updateBookingProgressAction({
      bookingId: "booking-sm-1",
      nextStatus: "session_started",
    });
    expect(deniedExpired).toMatchObject({
      ok: false,
      code: "PERMISSION_DENIED",
      message: "This booking is outside your branch.",
    });
  });

  it("verifies WEB-1 notification routing, CRM live bell wiring, and bounded push-enable timeout", () => {
    expect(
      getNotificationTargetPath({
        workspace: "driver",
        entityType: "booking",
        entityId: "b-1",
        type: "booking_reassigned",
      })
    ).toBe("/staff/driver/trips/b-1");

    const crmHome = readFileSync(
      "src/components/features/staff-pwa/crm/crm-mobile-home.tsx",
      "utf8"
    );
    expect(crmHome).toContain("<StaffNoticesBellLink");
    expect(crmHome).toContain("staffNotificationWorkspace(staff)");
    expect(crmHome).toContain("workspace={noticeWorkspace}");

    const enablePage = readFileSync(
      "src/app/(dashboard)/staff/enable-notifications/page.tsx",
      "utf8"
    );
    expect(enablePage).toContain("AbortController");
    expect(enablePage).toContain("Retry check");
  });
});
