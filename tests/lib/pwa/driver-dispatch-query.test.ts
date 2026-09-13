import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/home-service/distance-service", () => ({ getHomeServiceBranchRouteOrigin: async () => null }));
const state = vi.hoisted(() => ({ calls: [] as any[], rows: [] as any[], errors: {} as Record<string, unknown> }));
const db: any = {
  from(table: string) {
    const call = { table, filters: [] as any[], limit: 0 }; state.calls.push(call);
    const query: any = {};
    for (const method of ["select", "order", "eq", "in", "gte", "lte", "or", "range"]) {
      query[method] = (...args: any[]) => { call.filters.push([method, ...args]); return query; };
    }
    query.limit = (value: number) => { call.limit = value; return query; };
    query.then = (resolve: any) => Promise.resolve({ data: table === "bookings" ? state.rows : [], error: state.errors[table] ?? null }).then(resolve);
    return query;
  },
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db }));
import { getDispatchData } from "@/lib/queries/dispatch-queries";
import { buildDriverRoutePageViewModel } from "@/components/features/staff-portal/driver/map/driver-route-view-model";
const args = { branchId: "branch", staffId: "driver", date: "2026-09-13", role: "driver", throwOnError: true };
beforeEach(() => {
  state.calls = []; state.errors = {};
  state.rows = [{ id: "booking", booking_date: args.date, start_time: "10:00", end_time: "11:00", status: "confirmed", booking_progress_status: "not_started", driver_id: "driver", staff_id: "provider", payment_status: "paid", metadata: { dispatch: { eta_minutes: 7 }, home_service_address: { lat: 999, lng: 121, full_address: "Test destination" } }, customers: { full_name: "Test customer" }, services: { name: "Test service" } }];
});
describe("Assigned Driver dispatch query", () => {
  it("scopes by driver, branch and operational delivery, never sales type", async () => {
    await getDispatchData(args);
    const booking = state.calls.find(row => row.table === "bookings");
    expect(booking.filters).toEqual(expect.arrayContaining([["eq", "branch_id", "branch"], ["eq", "driver_id", "driver"], ["eq", "delivery_type", "home_service"], ["eq", "booking_date", args.date]]));
    expect(booking.filters.some((row: any[]) => row[0] === "or")).toBe(false);
    expect(booking.limit).toBe(100);
  });
  it("batches and bounds snapshots with staff/branch filters", async () => {
    state.rows.push({ ...state.rows[0], id: "booking-2" });
    await getDispatchData(args);
    const snapshots = state.calls.filter(row => row.table === "staff_location_snapshots");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].filters).toEqual(expect.arrayContaining([["eq", "staff_id", "driver"], ["eq", "branch_id", "branch"]]));
    expect(snapshots[0].limit).toBe(500);
  });
  it("fails closed when assignment scope is missing", async () => {
    await expect(getDispatchData({ ...args, staffId: undefined })).rejects.toThrow("Staff assignment");
    expect(state.calls).toHaveLength(0);
  });
  it.each(["bookings", "staff", "staff_location_snapshots"])("keeps %s database errors truthful", async table => {
    state.errors[table] = new Error("Database unavailable");
    await expect(getDispatchData(args)).rejects.toThrow("Database unavailable");
  });
  it("preserves a legitimate empty queue", async () => {
    state.rows = [];
    expect(await getDispatchData(args)).toMatchObject({ items: [], stats: { totalToday: 0 } });
  });
  it("omits unreleased scheduled jobs", async () => {
    state.rows[0].metadata.dispatch.status = "scheduled";
    expect((await getDispatchData(args)).items).toEqual([]);
  });
  it("does not fabricate coordinates, payment or ETA", async () => {
    state.rows[0].payment_status = null;
    const { items } = await getDispatchData(args);
    expect(items[0]).toMatchObject({ lat: null, etaMinutes: null, paymentStatus: "unknown" });
    const model = buildDriverRoutePageViewModel(items, { detailsBasePath: "/staff/driver/trips" });
    expect(model.etaLabel).toBe("ETA unavailable");
    expect(model.distanceLabel).toBe("Road distance unavailable");
    expect(model.liveLocationLabel).toBe("Location unavailable");
    expect(model.nextStop?.detailsHref).toBe("/staff/driver/trips/booking");
  });
});
