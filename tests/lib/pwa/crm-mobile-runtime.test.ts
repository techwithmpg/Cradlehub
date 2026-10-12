import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  context: vi.fn(),
  calls: [] as { table: string; filters: unknown[][] }[],
  rows: [] as Record<string, unknown>[],
  error: null as { message: string } | null,
}));
vi.mock("@/lib/staff-pwa/staff-context", () => ({ getStaffPwaContext: state.context }));
vi.mock("@/lib/staff-pwa/provider-date", () => ({
  getProviderBusinessDate: async () => "2026-10-12",
}));

import { getCrmMobileRuntime } from "@/lib/staff-pwa/crm-runtime";
import {
  crmBookingCounts,
  filterCrmBookings,
  crmBookingStatusLabel,
} from "@/lib/staff-pwa/crm-model";

const staff = { id: "crm-a", branch_id: "branch-a", system_role: "crm", staff_type: "csr" };
const db = {
  from(table: string) {
    const call = { table, filters: [] as unknown[][] };
    state.calls.push(call);
    const query = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") {
            return (
              resolve: (value: {
                data: Record<string, unknown>[];
                error: { message: string } | null;
              }) => unknown
            ) => resolve({ data: state.rows, error: state.error });
          }
          return (...args: unknown[]) => {
            call.filters.push([property, ...args]);
            return query;
          };
        },
      }
    );
    return query;
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  state.calls = [];
  state.rows = [];
  state.error = null;
  state.context.mockResolvedValue({ db, staff, group: "crm_general" });
});

describe("CRM mobile booking read boundary", () => {
  it("uses the authenticated branch and a bounded date/status query", async () => {
    state.rows = [
      {
        id: "a",
        branch_id: "branch-a",
        booking_date: "2026-10-12",
        start_time: "10:00:00",
        status: "confirmed",
        booking_progress_status: "checked_in",
        delivery_type: "in_spa",
        customers: { full_name: "Maria" },
        services: { name: "Massage" },
      },
      {
        id: "b",
        branch_id: "branch-b",
        booking_date: "2026-10-12",
        start_time: "11:00:00",
        status: "confirmed",
        booking_progress_status: "not_started",
        delivery_type: "in_spa",
        customers: { full_name: "Wrong branch" },
        services: { name: "Massage" },
      },
    ];
    const result = await getCrmMobileRuntime();
    expect(result.bookings.map((row) => row.customerName)).toEqual(["Maria"]);
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]!.table).toBe("bookings");
    expect(state.calls[0]!.filters).toContainEqual(["eq", "branch_id", "branch-a"]);
    expect(state.calls[0]!.filters).toContainEqual(["gte", "booking_date", "2026-10-12"]);
    expect(state.calls[0]!.filters).toContainEqual(["limit", 121]);
    expect(
      state.calls[0]!.filters.every(
        ([method]) => !["update", "insert", "delete"].includes(String(method))
      )
    ).toBe(true);
  });

  it("does not fetch booking details for generic staff or a different operational group", async () => {
    state.context.mockResolvedValue({
      db,
      staff: { ...staff, system_role: "staff" },
      group: "crm_general",
    });
    expect((await getCrmMobileRuntime()).canViewBookings).toBe(false);
    expect(state.calls).toHaveLength(0);
    state.context.mockResolvedValue({ db, staff, group: "driver" });
    await expect(getCrmMobileRuntime()).rejects.toThrow("CRM mobile access denied.");
    expect(state.calls).toHaveLength(0);
  });

  it("separates failed reads from a genuinely empty schedule", async () => {
    expect(await getCrmMobileRuntime()).toMatchObject({ bookings: [], bookingError: null });
    state.error = { message: "offline" };
    expect(await getCrmMobileRuntime()).toMatchObject({
      bookings: [],
      bookingError: expect.any(String),
    });
  });
});

describe("CRM mobile status presentation", () => {
  const bookings = [
    {
      id: "a",
      branchId: "branch-a",
      date: "2026-10-12",
      time: "10:00:00",
      status: "confirmed",
      progress: "checked_in",
      deliveryType: "in_spa",
      customerName: "Maria",
      serviceName: "Massage",
    },
    {
      id: "b",
      branchId: "branch-a",
      date: "2026-10-12",
      time: "11:00:00",
      status: "pending_crm_confirmation",
      progress: "not_started",
      deliveryType: "in_spa",
      customerName: "Ana",
      serviceName: "Facial",
    },
    {
      id: "c",
      branchId: "branch-a",
      date: "2026-10-13",
      time: "12:00:00",
      status: "confirmed",
      progress: "not_started",
      deliveryType: "home_service",
      customerName: "Liza",
      serviceName: "Home Service",
    },
  ];
  it("counts only today's known states and keeps upcoming separate", () => {
    expect(crmBookingCounts(bookings, "2026-10-12")).toEqual({
      today: 2,
      arrived: 1,
      inService: 0,
      attention: 1,
    });
    expect(filterCrmBookings(bookings, "2026-10-12", "today")).toHaveLength(2);
    expect(filterCrmBookings(bookings, "2026-10-12", "upcoming")).toHaveLength(1);
    expect(crmBookingStatusLabel(bookings[1]!)).toBe("Needs review");
  });
});
