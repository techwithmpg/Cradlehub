import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const state = vi.hoisted(() => ({
  context: vi.fn(), calls: [] as any[], data: {} as Record<string, any[]>, errors: {} as Record<string, unknown>,
}));
vi.mock("@/lib/staff-pwa/staff-context", () => ({ getStaffPwaContext: state.context }));
vi.mock("@/lib/staff-pwa/provider-date", () => ({ getProviderBusinessDate: async () => "2026-09-13" }));
import { getStaffWork } from "@/lib/staff-pwa/work-runtime";
import { getStaffNotices } from "@/lib/staff-pwa/notices-runtime";
import { markStaffNoticeRead } from "@/lib/staff-pwa/notice-actions";
const staff = { id: "staff", branch_id: "branch", system_role: "crm", staff_type: null };
const db: any = { from(table: string) {
  const call = { table, filters: [] as any[], update: null as unknown }; state.calls.push(call);
  const q: any = {};
  for (const method of ["select", "eq", "is", "in", "or", "gte", "lte", "order", "limit"]) q[method] = (...args: any[]) => { call.filters.push([method, ...args]); return q; };
  q.update = (payload: unknown) => { call.update = payload; return q; };
  q.maybeSingle = async () => ({ data: null, error: null });
  q.then = (resolve: any) => Promise.resolve({ data: state.data[table] ?? [], error: state.errors[table] ?? null }).then(resolve);
  return q;
} };
beforeEach(() => {
  vi.clearAllMocks(); state.calls = []; state.data = {}; state.errors = {};
  state.context.mockResolvedValue({ db, staff, group: "crm_general" });
});
describe("Work query boundary and truthful failures", () => {
  it("filters each read by current branch and issues no writes", async () => {
    expect(await getStaffWork()).toEqual({ items: [], errors: [] });
    for (const call of state.calls) {
      expect(call.filters).toContainEqual(["eq", "branch_id", "branch"]);
      expect(call.update).toBeNull();
    }
  });
  it("never loads the branch booking/attendance queue for general staff", async () => {
    state.context.mockResolvedValue({ db, staff: { ...staff, system_role: "staff" }, group: "crm_general" });
    await getStaffWork();
    expect(state.calls.map(row => row.table)).toEqual(["workflow_tasks"]);
    expect(state.calls[0].filters).toContainEqual(["eq", "assigned_to_staff_id", "staff"]);
  });
  it("preserves independent results when a source fails", async () => {
    state.errors.bookings = { message: "down" };
    state.data.workflow_tasks = [{ id: "task", branch_id: "branch", assigned_to_staff_id: "staff", workspace_scope: "crm", status: "open", title: "Work", entity_type: "other", entity_id: "entity" }];
    expect(await getStaffWork()).toMatchObject({ errors: ["Booking attention unavailable."], items: [expect.objectContaining({ id: "task" })] });
  });
  it("denies wrong operational group and authentication failures", async () => {
    state.context.mockResolvedValue({ db, staff, group: "driver" });
    expect((await getStaffWork()).errors).toEqual(["Work access denied."]);
    expect(state.calls).toHaveLength(0);
    state.context.mockRejectedValue(new Error("Unauthorized"));
    expect((await getStaffNotices()).error).toBe("Unauthorized");
  });
});
describe("Current notice reconciliation", () => {
  function notice(extra: any = {}) {
    return { id: "notice", branch_id: "branch", target_workspace: "driver", recipient_staff_id: "staff", status: "unread", type: "home_service_assigned", entity_type: "booking", entity_id: "booking", title: "Trip", created_at: new Date().toISOString(), requires_action: true, ...extra };
  }
  it("removes stale Driver assignments and completed booking alerts", async () => {
    state.context.mockResolvedValue({ db, staff: { ...staff, system_role: "driver" }, group: "driver" });
    state.data.workspace_notifications = [notice()];
    for (const change of [{ driver_id: "other", status: "confirmed" }, { driver_id: "staff", status: "completed" }]) {
      state.data.bookings = [{ id: "booking", branch_id: "branch", delivery_type: "home_service", ...change }];
      expect((await getStaffNotices()).items).toEqual([]);
    }
  });
  it("does not mistake a failed booking query for no notices", async () => {
    state.data.workspace_notifications = [notice({ target_workspace: "crm" })];
    state.errors.bookings = new Error("down");
    expect((await getStaffNotices()).error).toBe("Current assignment notices unavailable.");
  });
  it("removes closed attendance reminders without mutating attendance", async () => {
    state.data.workspace_notifications = [notice({ target_workspace: "crm", entity_type: "attendance_record", entity_id: "shift", type: "attendance_clock_out_reminder" })];
    state.data.staff_shift_checkins = [{ id: "shift", staff_id: "staff", checked_out_at: new Date().toISOString() }];
    expect((await getStaffNotices()).items).toEqual([]);
    expect(state.calls.every(row => !row.update)).toBe(true);
  });
  it("rejects forged mark-read IDs without issuing an update", async () => {
    expect(await markStaffNoticeRead("other")).toMatchObject({ ok: false });
    expect(state.calls.every(row => !row.update)).toBe(true);
  });
});
