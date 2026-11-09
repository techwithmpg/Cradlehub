import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  booking: {
    id: "booking-1",
    branch_id: "branch-1",
    driver_id: "driver-1",
    status: "confirmed",
    delivery_type: "home_service",
    type: "online",
    booking_date: "2026-11-10",
    start_time: "15:00:00",
  },
  driver: {
    id: "driver-1",
    auth_user_id: "auth-1",
    branch_id: "branch-1",
    staff_type: "driver",
    system_role: "driver",
    is_active: true,
    archived_at: null as string | null,
    merged_into_staff_id: null as string | null,
  },
  insert: vi.fn().mockResolvedValue(undefined),
  logError: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logError: state.logError }));
vi.mock("@/lib/notifications/create", () => ({ createNotificationOnce: state.insert }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn(),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.maybeSingle.mockImplementation(async () => ({
        data: table === "bookings" ? state.booking : state.driver,
        error: null,
      }));
      return query;
    },
  }),
}));

import { notifyConfirmedHomeServiceDriver } from "@/lib/home-service/confirmed-driver-notification";

beforeEach(() => {
  vi.clearAllMocks();
  state.booking.status = "confirmed";
  state.booking.driver_id = "driver-1";
  state.booking.delivery_type = "home_service";
  state.driver.is_active = true;
  state.driver.archived_at = null;
  state.driver.staff_type = "driver";
  state.driver.system_role = "driver";
  state.driver.auth_user_id = "auth-1";
  state.driver.branch_id = "branch-1";
});

describe("confirmed Home Service driver notice", () => {
  it("targets only the confirmed assigned driver with a scoped route and stable dedupe key", async () => {
    await notifyConfirmedHomeServiceDriver("booking-1", "branch-1");
    expect(state.insert).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        targetWorkspace: "driver",
        recipientStaffId: "driver-1",
        type: "home_service_assigned",
        actionHref: "/staff/driver/map?bookingId=booking-1",
        dedupeKey: "booking:booking-1:confirmed:driver:driver-1",
      })
    );
  });

  it("does not notify a driver about a pending CRM-confirmation request", async () => {
    state.booking.status = "pending_crm_confirmation";
    await notifyConfirmedHomeServiceDriver("booking-1", "branch-1");
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("does not notify an unassigned booking", async () => {
    state.booking.driver_id = null as unknown as string;
    await notifyConfirmedHomeServiceDriver("booking-1", "branch-1");
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("rejects inactive, archived, unlinked, and non-driver recipients", async () => {
    for (const scenario of ["inactive", "archived", "unlinked", "other-role"]) {
      if (scenario === "inactive") state.driver.is_active = false;
      if (scenario === "archived") state.driver.archived_at = "2026-11-01T00:00:00Z";
      if (scenario === "unlinked") state.driver.auth_user_id = null as unknown as string;
      if (scenario === "other-role") {
        state.driver.staff_type = "therapist";
        state.driver.system_role = "staff";
      }
      await notifyConfirmedHomeServiceDriver("booking-1", "branch-1");
      expect(state.insert).not.toHaveBeenCalled();
      state.driver.is_active = true;
      state.driver.archived_at = null;
      state.driver.auth_user_id = "auth-1";
      state.driver.staff_type = "driver";
      state.driver.system_role = "driver";
    }
  });
});
