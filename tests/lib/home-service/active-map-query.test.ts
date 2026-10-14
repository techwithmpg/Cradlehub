import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  booking_progress_status: string | null;
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
                    return !["completed", "no_show"].includes(row.booking_progress_status ?? "");
                  if (method === "or" && String(column).startsWith("booking_date.gte.")) {
                    const filter =
                      /^booking_date\.gte\.(\d{4}-\d{2}-\d{2}),booking_progress_status\.in\.\(([^)]+)\),status\.eq\.([a-z_]+)$/.exec(
                        String(column)
                      );
                    if (!filter) throw new Error(`Unexpected active-map filter: ${column}`);
                    const [, date, progressStatuses, status] = filter;
                    if (!date || !progressStatuses || !status) {
                      throw new Error(`Incomplete active-map filter: ${column}`);
                    }
                    return (
                      row.booking_date >= date ||
                      progressStatuses.split(",").includes(row.booking_progress_status ?? "") ||
                      row.status === status
                    );
                  }
                  return true;
                })
              )
            : [];
        const range = call.filters.filter(([method]) => method === "range").at(-1);
        const data = range ? filtered.slice(Number(range[1]), Number(range[2]) + 1) : filtered;
        return Promise.resolve({ data, error: null }).then(resolve);
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T03:00:00Z"));
  state.calls = [];
  state.rows = [
    row("stale-confirmed", "2026-10-12"),
    row("stale-payment", "2026-10-12", { status: "pending_payment" }),
    row("travel", "2026-10-12", { booking_progress_status: "travel_started" }),
    row("arrived", "2026-10-12", { booking_progress_status: "arrived" }),
    row("session", "2026-10-12", { booking_progress_status: "session_started" }),
    row("in-progress-past", "2026-10-12", { status: "in_progress" }),
    row("today", "2026-10-14"),
    row("future", "2026-10-16"),
    row("distant-future", "2027-01-01"),
    row("pending", "2026-10-16", { status: "pending" }),
    row("pending-payment", "2026-10-16", { status: "pending_payment" }),
    row("pending-crm", "2026-10-16", { status: "pending_crm_confirmation" }),
    row("in-progress", "2026-10-16", { status: "in_progress" }),
    row("completed", "2026-10-14", { status: "completed" }),
    row("cancelled", "2026-10-14", { status: "cancelled" }),
    row("no-show", "2026-10-14", { status: "no_show" }),
    row("expired", "2026-10-14", { status: "expired" }),
    row("progress-completed", "2026-10-14", { booking_progress_status: "completed" }),
    row("progress-no-show", "2026-10-14", { booking_progress_status: "no_show" }),
    row("other-branch", "2026-10-16", { branch_id: "other" }),
  ];
});
afterEach(() => vi.useRealTimers());

describe("active Home Service map query", () => {
  it("returns due, future, and active overdue branch bookings without driver GPS", async () => {
    const result = await getDispatchData({
      branchId: "main",
      date: "2026-10-13",
      scope: "active_map",
    });
    expect(result.items.map((item) => item.id)).toEqual([
      "travel",
      "arrived",
      "session",
      "in-progress-past",
      "today",
      "future",
      "distant-future",
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
    expect(bookingCall.filters).toContainEqual([
      "or",
      "booking_date.gte.2026-10-14,booking_progress_status.in.(travel_started,arrived,session_started),status.eq.in_progress",
    ]);
    expect(result.today).toBe("2026-10-14");
    expect(
      bookingCall.filters.some(([method, column]) => method === "eq" && column === "booking_date")
    ).toBe(false);
  });

  it("applies relevance before paging so all qualifying destinations remain visible", async () => {
    state.rows = [
      ...Array.from({ length: 600 }, (_, index) => row(`stale-${index}`, "2026-07-22")),
      ...Array.from({ length: 501 }, (_, index) => row(`future-${index}`, "2026-10-16")),
    ];
    const result = await getDispatchData({
      branchId: "main",
      date: "2026-10-13",
      scope: "active_map",
    });
    expect(result.items).toHaveLength(501);
    expect(result.items[0]?.id).toBe("future-0");
    expect(result.items.at(-1)?.id).toBe("future-500");
    expect(state.calls.find((call) => call.table === "bookings")?.filters).toContainEqual([
      "range",
      500,
      999,
    ]);
  });

  it("keeps the default Today query date scoped", async () => {
    const result = await getDispatchData({ branchId: "main", date: "2026-10-14" });
    expect(result.items.map((item) => item.id)).toContain("today");
    expect(result.items.map((item) => item.id)).not.toContain("future");
    expect(state.calls.find((call) => call.table === "bookings")?.filters).toContainEqual([
      "eq",
      "booking_date",
      "2026-10-14",
    ]);
  });

  it("keeps the existing Upcoming query future scoped", async () => {
    const result = await getDispatchData({
      branchId: "main",
      date: "2026-10-14",
      dateFrom: "2026-10-14",
      dateTo: "2026-10-20",
    });
    expect(result.items.map((item) => item.id)).toContain("future");
    expect(result.items.map((item) => item.id)).not.toContain("today");
    const filters = state.calls.find((call) => call.table === "bookings")?.filters;
    expect(filters).toContainEqual(["gte", "booking_date", "2026-10-14"]);
    expect(filters).toContainEqual(["lte", "booking_date", "2026-10-20"]);
  });
});
