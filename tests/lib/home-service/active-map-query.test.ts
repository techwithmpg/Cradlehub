import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/home-service/distance-service", () => ({
  getHomeServiceBranchRouteOrigin: async () => null,
}));

type BookingRow = {
  id: string;
  branch_id: string;
  delivery_type: string;
  booking_date: string;
  status: string;
  booking_progress_status: string;
  start_time: string;
  end_time: string;
  driver_id: null;
  staff_id: string;
  payment_status: string;
  metadata: object;
  customers: { full_name: string };
  services: { name: string };
};
const state = vi.hoisted(() => ({
  rows: [] as BookingRow[],
  calls: [] as { table: string; filters: [string, ...unknown[]][] }[],
}));

const db = {
  from(table: string) {
    const call = { table, filters: [] as [string, ...unknown[]][] };
    state.calls.push(call);
    const query = {
      select: (...args: unknown[]) => {
        call.filters.push(["select", ...args]);
        return query;
      },
      order: (...args: unknown[]) => {
        call.filters.push(["order", ...args]);
        return query;
      },
      eq: (...args: unknown[]) => {
        call.filters.push(["eq", ...args]);
        return query;
      },
      neq: (...args: unknown[]) => {
        call.filters.push(["neq", ...args]);
        return query;
      },
      gt: (...args: unknown[]) => {
        call.filters.push(["gt", ...args]);
        return query;
      },
      not: (...args: unknown[]) => {
        call.filters.push(["not", ...args]);
        return query;
      },
      or: (...args: unknown[]) => {
        call.filters.push(["or", ...args]);
        return query;
      },
      in: (...args: unknown[]) => {
        call.filters.push(["in", ...args]);
        return query;
      },
      gte: (...args: unknown[]) => {
        call.filters.push(["gte", ...args]);
        return query;
      },
      lte: (...args: unknown[]) => {
        call.filters.push(["lte", ...args]);
        return query;
      },
      range: (...args: unknown[]) => {
        call.filters.push(["range", ...args]);
        return query;
      },
      limit: (...args: unknown[]) => {
        call.filters.push(["limit", ...args]);
        return query;
      },
      then(resolve: (value: { data: BookingRow[]; error: null }) => void) {
        const filtered =
          table === "bookings"
            ? state.rows.filter((row) =>
                call.filters.every(([method, column, value]) => {
                  if (method === "eq") return row[column as keyof BookingRow] === value;
                  if (method === "neq" && column === "booking_date")
                    return row.booking_date !== value;
                  if (method === "gte" && column === "booking_date")
                    return row.booking_date >= String(value);
                  if (method === "gt" && column === "booking_date")
                    return row.booking_date > String(value);
                  if (method === "lte" && column === "booking_date")
                    return row.booking_date <= String(value);
                  if (method === "in" && column === "status")
                    return (value as string[]).includes(row.status);
                  if (
                    method === "or" &&
                    column ===
                      "booking_progress_status.is.null,booking_progress_status.not.in.(completed,no_show)"
                  )
                    return !["completed", "no_show"].includes(row.booking_progress_status);
                  return true;
                })
              )
            : [];
        return Promise.resolve({ data: filtered, error: null }).then(resolve);
      },
    };
    return query;
  },
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db }));

import { getDispatchData } from "@/lib/queries/dispatch-queries";

const row = (
  id: string,
  booking_date: string,
  overrides: Partial<BookingRow> = {}
): BookingRow => ({
  id,
  branch_id: "main",
  delivery_type: "home_service",
  booking_date,
  status: "confirmed",
  booking_progress_status: "not_started",
  start_time: "10:00",
  end_time: "11:00",
  driver_id: null,
  staff_id: "provider",
  payment_status: "pending",
  metadata: { home_service_address: { full_address: "Sample destination", lat: 14.6, lng: 121 } },
  customers: { full_name: "Sample" },
  services: { name: "Service" },
  ...overrides,
});

beforeEach(() => {
  state.calls = [];
  state.rows = [
    row("overdue", "2026-10-12"),
    row("today", "2026-10-13"),
    row("future", "2026-10-16"),
    row("pending", "2026-10-16", { status: "pending" }),
    row("pending-payment", "2026-10-16", { status: "pending_payment" }),
    row("pending-crm", "2026-10-16", { status: "pending_crm_confirmation" }),
    row("in-progress", "2026-10-16", { status: "in_progress" }),
    row("completed", "2026-10-13", { status: "completed" }),
    row("cancelled", "2026-10-13", { status: "cancelled" }),
    row("no-show", "2026-10-13", { status: "no_show" }),
    row("expired", "2026-10-13", { status: "expired" }),
    row("progress-completed", "2026-10-13", { booking_progress_status: "completed" }),
    row("progress-no-show", "2026-10-13", { booking_progress_status: "no_show" }),
    row("other-branch", "2026-10-16", { branch_id: "other" }),
  ];
});

describe("active Home Service map query", () => {
  it("returns overdue, today, and future open branch bookings without driver GPS", async () => {
    const result = await getDispatchData({
      branchId: "main",
      date: "2026-10-13",
      scope: "active_map",
    });
    expect(result.items.map((item) => item.id)).toEqual([
      "overdue",
      "today",
      "future",
      "pending",
      "pending-payment",
      "pending-crm",
      "in-progress",
    ]);
    expect(result.items.find((item) => item.id === "future")).toMatchObject({
      lat: 14.6,
      lng: 121,
      currentLocation: null,
    });
    const bookingCall = state.calls.find((call) => call.table === "bookings")!;
    expect(bookingCall.filters).toContainEqual(["eq", "branch_id", "main"]);
    expect(bookingCall.filters).toContainEqual([
      "in",
      "status",
      ["pending", "pending_payment", "pending_crm_confirmation", "confirmed", "in_progress"],
    ]);
    expect(
      bookingCall.filters.some(([method, column]) => method === "eq" && column === "booking_date")
    ).toBe(false);
  });

  it("keeps the default Today query date scoped", async () => {
    const result = await getDispatchData({ branchId: "main", date: "2026-10-13" });
    expect(result.items.map((item) => item.id)).toContain("today");
    expect(result.items.map((item) => item.id)).not.toContain("future");
    expect(state.calls.find((call) => call.table === "bookings")?.filters).toContainEqual([
      "eq",
      "booking_date",
      "2026-10-13",
    ]);
  });

  it("keeps the existing Upcoming query future scoped", async () => {
    const result = await getDispatchData({
      branchId: "main",
      date: "2026-10-13",
      dateFrom: "2026-10-13",
      dateTo: "2026-10-20",
    });
    expect(result.items.map((item) => item.id)).toContain("future");
    expect(result.items.map((item) => item.id)).not.toContain("today");
    const filters = state.calls.find((call) => call.table === "bookings")?.filters;
    expect(filters).toContainEqual(["gte", "booking_date", "2026-10-13"]);
    expect(filters).toContainEqual(["lte", "booking_date", "2026-10-20"]);
  });
});
