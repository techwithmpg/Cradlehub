import { beforeEach, describe, expect, it, vi } from "vitest";

type StaffRow = {
  id: string;
  branch_id: string | null;
  system_role: string;
  staff_type: string | null;
  is_active: boolean;
};
type BookingRow = {
  id: string;
  branch_id: string;
  staff_id: string;
  driver_id: string | null;
  type: string;
  delivery_type: string;
  status: string;
  booking_progress_status: string;
  payment_status?: string;
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn() })) }));
const state = vi.hoisted(() => ({
  user: { id: "auth" } as { id: string } | null,
  staff: null as StaffRow | null,
  booking: null as BookingRow | null,
  devBypass: false,
  dispatch: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  date: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: state.from,
    rpc: state.rpc,
  }),
}));
vi.mock("@/lib/dev-bypass", () => ({
  isDevAuthBypassEnabled: () => state.devBypass,
  getDevBypassStaffRecord: () => ({
    id: "mock-staff",
    branch_id: "branch",
    system_role: "owner",
    staff_type: null,
    is_active: true,
  }),
}));
vi.mock("@/lib/queries/dispatch-queries", () => ({ getDispatchData: state.dispatch }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: state.adminRpc }),
}));
vi.mock("@/lib/staff-pwa/provider-date", () => ({ getProviderBusinessDate: state.date }));
import {
  getMyDriverJobsAction,
  getMyDriverAllJobsAction,
  getMyDriverJobByIdAction,
  updateBookingProgressAction,
} from "@/app/(dashboard)/staff-portal/actions";

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "auth" };
  state.devBypass = false;
  state.staff = {
    id: "driver",
    branch_id: "branch",
    system_role: "staff",
    staff_type: "driver",
    is_active: true,
  };
  state.booking = {
    id: "job",
    branch_id: "branch",
    staff_id: "provider",
    driver_id: "driver",
    type: "online",
    delivery_type: "home_service",
    status: "confirmed",
    booking_progress_status: "not_started",
  };
  state.from.mockImplementation((table: string) => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const result = () =>
      Promise.resolve({ data: table === "staff" ? state.staff : state.booking, error: null });
    query.maybeSingle.mockImplementation(result);
    query.single.mockImplementation(result);
    return query;
  });
  state.date.mockResolvedValue("2026-09-12");
  state.dispatch.mockResolvedValue({ items: [], stats: { totalToday: 0 } });
  state.rpc.mockResolvedValue({ data: null, error: null });
  state.adminRpc.mockResolvedValue({ data: null, error: null });
});

describe("Driver server boundary", () => {
  it("derives branch, driver and business date from authenticated staff", async () => {
    await getMyDriverJobsAction();
    expect(state.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: "branch",
        staffId: "driver",
        role: "driver",
        date: "2026-09-12",
        throwOnError: true,
      })
    );
  });
  it.each(["owner", "manager", "crm", "utility"])(
    "denies %s before querying trips",
    async (role) => {
      state.staff = { ...state.staff!, system_role: role, staff_type: null };
      expect(await getMyDriverJobsAction()).toEqual({ error: "Unauthorized" });
      expect(state.dispatch).not.toHaveBeenCalled();
    }
  );
  it("denies missing branch instead of returning empty trips", async () => {
    state.staff = { ...state.staff!, branch_id: null };
    expect(await getMyDriverJobsAction()).toHaveProperty("error");
    expect(state.dispatch).not.toHaveBeenCalled();
  });
  it("keeps date resolution failure truthful", async () => {
    state.date.mockRejectedValue(new Error("Date unavailable"));
    expect(await getMyDriverJobsAction()).toEqual({ error: "Date unavailable" });
  });
  it("keeps query failure truthful for all trip surfaces", async () => {
    state.dispatch.mockRejectedValue(new Error("Database unavailable"));
    for (const result of await Promise.all([
      getMyDriverJobsAction(),
      getMyDriverAllJobsAction(),
      getMyDriverJobByIdAction("job"),
    ])) {
      expect(result).toEqual({ error: "Database unavailable" });
    }
  });
  it("uses the same scoped query for details", async () => {
    expect(await getMyDriverJobByIdAction("not-mine")).toEqual({ error: "Job not found" });
    expect(state.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "not-mine",
        staffId: "driver",
        branchId: "branch",
      })
    );
  });
});

describe("Booking progress server boundary", () => {
  it("denies an unauthenticated caller before privileged execution", async () => {
    state.user = null;
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "travel_started" })
    ).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(state.adminRpc).not.toHaveBeenCalled();
  });
  it("does not use a development mock staff record for privileged execution", async () => {
    state.staff = null;
    state.devBypass = true;
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "travel_started" })
    ).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(state.adminRpc).not.toHaveBeenCalled();
  });
  it.each(["session_started", "completed", "checked_in", "no_show"] as const)(
    "denies Driver %s even if also booking.staff_id",
    async (nextStatus) => {
      state.booking!.staff_id = "driver";
      const result = await updateBookingProgressAction({ bookingId: "job", nextStatus });
      expect(result.ok).toBe(false);
      expect(state.adminRpc).not.toHaveBeenCalled();
      expect(state.rpc).not.toHaveBeenCalled();
    }
  );
  it.each([
    { branch_id: "other" },
    { driver_id: "other" },
    { delivery_type: "in_spa", type: "home_service" },
  ])("denies mismatched Driver authority %j", async (change) => {
    Object.assign(state.booking!, change);
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "travel_started" })
    ).toMatchObject({ ok: false });
    expect(state.adminRpc).not.toHaveBeenCalled();
  });
  it("denies an ordinary staff member on another assignment", async () => {
    state.staff = { ...state.staff!, staff_type: "therapist" };
    state.booking!.delivery_type = "in_spa";
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "session_started" })
    ).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.adminRpc).not.toHaveBeenCalled();
  });
  it.each(["crm", "manager", "staff"])("denies cross-branch progress to %s", async (role) => {
    state.staff = { ...state.staff!, system_role: role, staff_type: null };
    state.booking = {
      ...state.booking!,
      staff_id: "driver",
      branch_id: "other",
      delivery_type: "in_spa",
    };
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "checked_in" })
    ).toMatchObject({ ok: false, code: "PERMISSION_DENIED" });
    expect(state.adminRpc).not.toHaveBeenCalled();
  });
  it("permits assigned Driver travel for confirmed Home Service", async () => {
    state.booking!.payment_status = "unpaid";
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "travel_started" })
    ).toMatchObject({ ok: true });
    expect(state.adminRpc).toHaveBeenCalledExactlyOnceWith("advance_staff_driver_trip", {
      p_booking_id: "job",
      p_next_status: "travel_started",
      p_actor_staff_id: "driver",
    });
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("permits assigned Driver arrival after travel starts", async () => {
    state.booking!.booking_progress_status = "travel_started";
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "arrived" })
    ).toMatchObject({ ok: true });
    expect(state.adminRpc).toHaveBeenCalledWith("advance_staff_driver_trip", {
      p_booking_id: "job",
      p_next_status: "arrived",
      p_actor_staff_id: "driver",
    });
  });
  it("permits branch CRM check-in for a confirmed in-spa booking", async () => {
    state.staff = { ...state.staff!, system_role: "crm", staff_type: null };
    state.booking!.delivery_type = "in_spa";
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "checked_in" })
    ).toMatchObject({ ok: true });
    expect(state.adminRpc).toHaveBeenCalledWith("update_booking_progress", {
      p_booking_id: "job",
      p_next_status: "checked_in",
    });
  });
  it("rejects an invalid state transition before calling the privileged RPC", async () => {
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "arrived" })
    ).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    expect(state.adminRpc).not.toHaveBeenCalled();
  });
  it("preserves a rejected database transition without success", async () => {
    state.adminRpc.mockResolvedValue({ data: null, error: { message: "Assignment changed" } });
    expect(
      await updateBookingProgressAction({ bookingId: "job", nextStatus: "travel_started" })
    ).toMatchObject({ ok: false, message: "Assignment changed" });
  });
});
