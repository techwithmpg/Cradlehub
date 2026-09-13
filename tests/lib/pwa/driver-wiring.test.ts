import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn() })) }));
const state = vi.hoisted(() => ({
  staff: null as any, booking: null as any, dispatch: vi.fn(), rpc: vi.fn(),
  date: vi.fn(), from: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "auth" } }, error: null }) },
  from: state.from, rpc: state.rpc,
}) }));
vi.mock("@/lib/queries/dispatch-queries", () => ({ getDispatchData: state.dispatch }));
vi.mock("@/lib/staff-pwa/provider-date", () => ({ getProviderBusinessDate: state.date }));
import { getMyDriverJobsAction, getMyDriverAllJobsAction, getMyDriverJobByIdAction, updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";

beforeEach(() => {
  vi.clearAllMocks();
  state.staff = { id: "driver", branch_id: "branch", system_role: "staff", staff_type: "driver", is_active: true };
  state.booking = { id: "job", branch_id: "branch", staff_id: "provider", driver_id: "driver", type: "online", delivery_type: "home_service", status: "confirmed", booking_progress_status: "not_started" };
  state.from.mockImplementation((table: string) => {
    const q: any = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), single: vi.fn() };
    q.select.mockReturnValue(q); q.eq.mockReturnValue(q);
    const result = () => Promise.resolve({ data: table === "staff" ? state.staff : state.booking, error: null });
    q.maybeSingle.mockImplementation(result); q.single.mockImplementation(result);
    return q;
  });
  state.date.mockResolvedValue("2026-09-12");
  state.dispatch.mockResolvedValue({ items: [], stats: { totalToday: 0 } });
  state.rpc.mockResolvedValue({ data: null, error: null });
});

describe("Driver server boundary", () => {
  it("derives branch, driver and business date from authenticated staff", async () => {
    await getMyDriverJobsAction();
    expect(state.dispatch).toHaveBeenCalledWith(expect.objectContaining({ branchId: "branch", staffId: "driver", role: "driver", date: "2026-09-12", throwOnError: true }));
  });
  it.each(["owner", "manager", "crm", "utility"])("denies %s before querying trips", async role => {
    state.staff = { ...state.staff, system_role: role, staff_type: null };
    expect(await getMyDriverJobsAction()).toEqual({ error: "Unauthorized" });
    expect(state.dispatch).not.toHaveBeenCalled();
  });
  it("denies missing branch instead of returning empty trips", async () => {
    state.staff.branch_id = null;
    expect(await getMyDriverJobsAction()).toHaveProperty("error");
    expect(state.dispatch).not.toHaveBeenCalled();
  });
  it("keeps date resolution failure truthful", async () => {
    state.date.mockRejectedValue(new Error("Date unavailable"));
    expect(await getMyDriverJobsAction()).toEqual({ error: "Date unavailable" });
  });
  it("keeps query failure truthful for all trip surfaces", async () => {
    state.dispatch.mockRejectedValue(new Error("Database unavailable"));
    for (const result of await Promise.all([getMyDriverJobsAction(), getMyDriverAllJobsAction(), getMyDriverJobByIdAction("job")])) {
      expect(result).toEqual({ error: "Database unavailable" });
    }
  });
  it("uses the same scoped query for details", async () => {
    expect(await getMyDriverJobByIdAction("not-mine")).toEqual({ error: "Job not found" });
    expect(state.dispatch).toHaveBeenCalledWith(expect.objectContaining({ bookingId: "not-mine", staffId: "driver", branchId: "branch" }));
  });
  it.each(["session_started", "completed", "checked_in", "no_show"])("Driver cannot advance %s even if also booking.staff_id", async nextStatus => {
    state.booking.staff_id = "driver";
    const result = await updateBookingProgressAction({ bookingId: "job", nextStatus: nextStatus as any });
    expect(result.ok).toBe(false); expect(state.rpc).not.toHaveBeenCalled();
  });
  it.each([{ branch_id: "other" }, { driver_id: "other" }, { delivery_type: "in_spa", type: "home_service" }])("denies mismatched authority %j", async change => {
    Object.assign(state.booking, change);
    expect((await updateBookingProgressAction({ bookingId: "job", nextStatus: "travel_started" })).ok).toBe(false);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("permits online Home Service travel through existing RPC", async () => {
    expect((await updateBookingProgressAction({ bookingId: "job", nextStatus: "travel_started" })).ok).toBe(true);
    expect(state.rpc).toHaveBeenCalledWith("update_booking_progress", { p_booking_id: "job", p_next_status: "travel_started" });
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });
  it("preserves rejected server transition without success", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "Assignment changed" } });
    expect(await updateBookingProgressAction({ bookingId: "job", nextStatus: "travel_started" })).toMatchObject({ ok: false, message: "Assignment changed" });
  });
});
