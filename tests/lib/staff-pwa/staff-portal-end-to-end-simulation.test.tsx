/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => {
  const push = vi.fn();
  const refresh = vi.fn();
  const toast = vi.fn();
  const toastLoading = vi.fn(() => "toast-id");
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const createNotificationOnce = vi.fn();
  const logError = vi.fn();
  const updateBookingProgressAction = vi.fn();
  const handlers: Array<(payload: { eventType: string; new: unknown }) => void> = [];
  let unreadCount = 2;

  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockImplementation(
    (
      _kind: string,
      _filter: unknown,
      handler: (payload: { eventType: string; new: unknown }) => void
    ) => {
      handlers.push(handler);
      return channel;
    }
  );
  channel.subscribe.mockImplementation(() => channel);

  const countBuilder = {
    select: vi.fn(() => countBuilder),
    eq: vi.fn(() => countBuilder),
    is: vi.fn(async () => ({ count: unreadCount, error: null })),
  };

  let bookingRow: Record<string, unknown> | null = null;
  let staffRow: Record<string, unknown> | null = null;

  const createAdminTableChain = (table: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: table === "bookings" ? bookingRow : staffRow,
        error: null,
      })),
    };
    return chain;
  };

  return {
    push,
    refresh,
    toast,
    toastLoading,
    toastSuccess,
    toastError,
    createNotificationOnce,
    logError,
    updateBookingProgressAction,
    handlers,
    channel,
    removeChannel: vi.fn(),
    countBuilder,
    createAdminTableChain,
    setUnreadCount: (value: number) => {
      unreadCount = value;
    },
    setBookingRow: (row: Record<string, unknown> | null) => {
      bookingRow = row;
    },
    setStaffRow: (row: Record<string, unknown> | null) => {
      staffRow = row;
    },
  };
});

vi.mock("next/navigation", () => {
  const router = {
    push: mocks.push,
    refresh: mocks.refresh,
  };
  return {
    useRouter: () => router,
    usePathname: () => "/staff",
  };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(mocks.toast, {
    loading: mocks.toastLoading,
    success: mocks.toastSuccess,
    error: mocks.toastError,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn(() => mocks.countBuilder),
    channel: vi.fn(() => mocks.channel),
    removeChannel: mocks.removeChannel,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => mocks.createAdminTableChain(table)),
  }),
}));

vi.mock("@/lib/notifications/create", () => ({
  createNotificationOnce: mocks.createNotificationOnce,
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/app/(dashboard)/staff-portal/actions", () => ({
  updateBookingProgressAction: mocks.updateBookingProgressAction,
}));

import { notifyConfirmedAssignedStaff } from "@/lib/bookings/confirmed-staff-notification";
import { StaffNoticesBellLink } from "@/components/features/staff-portal/staff-notices-bell-link";
import { TherapistMobileHome } from "@/components/features/staff-portal/therapist/therapist-mobile-home";
import type {
  StaffPortalBooking,
  StaffPortalStaff,
} from "@/components/features/staff-portal/types";

function makeStaff(overrides: Partial<StaffPortalStaff> = {}): StaffPortalStaff {
  return {
    id: "35614315-6688-4599-b234-60071945333e",
    full_name: "malcom patem",
    nickname: "mv",
    tier: "Senior",
    system_role: "service_staff",
    staff_type: "therapist",
    branch_id: "11111111-1111-4111-8111-111111111111",
    is_active: true,
    ...overrides,
  };
}

function makeBooking(overrides: Partial<StaffPortalBooking> = {}): StaffPortalBooking {
  return {
    id: "ec32192e-0788-4b49-bd8a-416719cafba0",
    booking_date: "2026-11-22",
    start_time: "10:15:00",
    end_time: "11:45:00",
    type: "online",
    delivery_type: "in_spa",
    status: "confirmed",
    booking_progress_status: "not_started",
    home_service_tracking_status: "none",
    travel_buffer_mins: null,
    metadata: null,
    travel_started_at: null,
    arrived_at: null,
    session_started_at: null,
    session_due_at: null,
    session_duration_minutes_snapshot: 90,
    completed_at: null,
    session_completed_at: null,
    checked_in_at: null,
    no_show_at: null,
    services: { id: "srv-1", name: "Sports Massage", duration_minutes: 90 },
    customers: { id: "cust-1", full_name: "malcom booking test 2" },
    branch_resources: { name: "CALMANTE 1", type: "room" },
    ...overrides,
  };
}

beforeEach(() => {
  mocks.handlers.length = 0;
  mocks.setUnreadCount(2);
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.toast.mockReset();
  mocks.toastLoading.mockClear();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.createNotificationOnce.mockReset();
  mocks.logError.mockReset();
  mocks.updateBookingProgressAction.mockReset();
  mocks.updateBookingProgressAction.mockResolvedValue({ error: null });
  mocks.channel.on.mockClear();
  mocks.channel.subscribe.mockClear();
  mocks.removeChannel.mockClear();
  mocks.setBookingRow(null);
  mocks.setStaffRow(null);
});

afterEach(cleanup);

describe("Staff Portal CRM -> Notification -> Therapist Portal simulation", () => {
  it("notifies the assigned therapist on CRM booking confirmation for in-spa and home service", async () => {
    mocks.setStaffRow({
      id: "35614315-6688-4599-b234-60071945333e",
      auth_user_id: "ecacb2f8-1d6b-40db-b56a-6c9dcfd908a8",
      branch_id: "branch-1",
      is_active: true,
      archived_at: null,
      merged_into_staff_id: null,
    });

    mocks.setBookingRow({
      id: "booking-in-spa",
      branch_id: "branch-1",
      staff_id: "35614315-6688-4599-b234-60071945333e",
      status: "confirmed",
      delivery_type: "in_spa",
      type: "online",
      booking_date: "2026-11-22",
      start_time: "10:15:00",
      customers: { full_name: "malcom booking test 2" },
      booking_attendees: { display_name: null },
      services: { name: "Sports Massage" },
    });

    await notifyConfirmedAssignedStaff("booking-in-spa", "branch-1");

    expect(mocks.createNotificationOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch-1",
        targetWorkspace: "staff",
        recipientStaffId: "35614315-6688-4599-b234-60071945333e",
        type: "booking_assigned",
        entityType: "booking",
        entityId: "booking-in-spa",
        actionHref: "/staff/progress",
        dedupeKey: "booking:booking-in-spa:confirmed:staff:35614315-6688-4599-b234-60071945333e",
      })
    );

    mocks.createNotificationOnce.mockClear();
    mocks.setBookingRow({
      id: "booking-home",
      branch_id: "branch-1",
      staff_id: "35614315-6688-4599-b234-60071945333e",
      status: "confirmed",
      delivery_type: "home_service",
      type: "home_service",
      booking_date: "2026-11-22",
      start_time: "14:00:00",
      customers: { full_name: "Elena Cruz" },
      booking_attendees: null,
      services: { name: "Home Signature Massage" },
    });

    await notifyConfirmedAssignedStaff("booking-home", "branch-1");

    expect(mocks.createNotificationOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "home_service_assigned",
        priority: "high",
        requiresAction: true,
        actionHref: "/staff/progress",
      })
    );

    // Inactive staff must be skipped cleanly
    mocks.createNotificationOnce.mockClear();
    mocks.setStaffRow({
      id: "35614315-6688-4599-b234-60071945333e",
      auth_user_id: "ecacb2f8-1d6b-40db-b56a-6c9dcfd908a8",
      branch_id: "branch-1",
      is_active: false,
      archived_at: null,
      merged_into_staff_id: null,
    });
    await notifyConfirmedAssignedStaff("booking-home", "branch-1");
    expect(mocks.createNotificationOnce).not.toHaveBeenCalled();
  });

  it("shows live unread count on the Staff bell and reacts to Realtime notification inserts", async () => {
    render(
      <StaffNoticesBellLink
        staffId="35614315-6688-4599-b234-60071945333e"
        workspace="staff"
        href="/staff/notices"
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Notifications (2 unread)")).toBeTruthy();
    });
    expect(screen.getByText("2")).toBeTruthy();
    expect(mocks.handlers).toHaveLength(1);

    mocks.setUnreadCount(3);
    await act(async () => {
      mocks.handlers[0]!({
        eventType: "INSERT",
        new: {
          target_workspace: "staff",
          title: "New booking — malcom booking test 2",
          body: "Confirmed for Sports Massage at 10:15 AM.",
        },
      });
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      "New booking — malcom booking test 2",
      expect.objectContaining({
        description: "Confirmed for Sports Massage at 10:15 AM.",
      })
    );
    expect(mocks.refresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText("Notifications (3 unread)")).toBeTruthy();
    });
  });

  it("renders direct Check In control for a confirmed booking on Staff PWA Home and triggers transitions", async () => {
    const booking = makeBooking();
    const { rerender } = render(
      <TherapistMobileHome
        staff={makeStaff()}
        bookings={[booking]}
        todaySchedule={null}
        todayOverride={null}
        attendanceData={null}
      />
    );

    expect(screen.getByText("malcom booking test 2")).toBeTruthy();
    expect(screen.getByText("Sports Massage")).toBeTruthy();

    const detailsLink = screen.getByRole("link", { name: /View Service Details/i });
    expect(detailsLink.getAttribute("href")).toBe("/staff/progress");

    const checkInButton = screen.getByRole("button", { name: /Check In/i });
    await act(async () => {
      fireEvent.click(checkInButton);
    });

    expect(mocks.updateBookingProgressAction).toHaveBeenCalledWith({
      bookingId: "ec32192e-0788-4b49-bd8a-416719cafba0",
      nextStatus: "checked_in",
    });

    // Once checked in, Start Session renders directly on the home card
    rerender(
      <TherapistMobileHome
        staff={makeStaff()}
        bookings={[
          makeBooking({
            booking_progress_status: "checked_in",
            checked_in_at: new Date().toISOString(),
          }),
        ]}
        todaySchedule={null}
        todayOverride={null}
        attendanceData={null}
      />
    );

    const startButton = screen.getByRole("button", { name: /Start Session/i });
    await act(async () => {
      fireEvent.click(startButton);
    });

    expect(mocks.updateBookingProgressAction).toHaveBeenCalledWith({
      bookingId: "ec32192e-0788-4b49-bd8a-416719cafba0",
      nextStatus: "session_started",
    });
  });

  it("renders active session progress and Complete control when CRM or staff starts the service", () => {
    const startedBooking = makeBooking({
      status: "in_progress",
      booking_progress_status: "session_started",
      session_started_at: new Date().toISOString(),
    });

    render(
      <TherapistMobileHome
        staff={makeStaff()}
        bookings={[startedBooking]}
        todaySchedule={null}
        todayOverride={null}
        attendanceData={null}
      />
    );

    expect(screen.getAllByText(/Session active/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Complete/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /View Service Details/i }).getAttribute("href")).toBe(
      "/staff/progress"
    );
  });
});
