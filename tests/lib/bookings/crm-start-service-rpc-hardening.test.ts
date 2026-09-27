import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  logError: vi.fn(),
  revalidateServiceSurfaces: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
}));

vi.mock("@/lib/bookings/service-session", () => ({
  revalidateServiceSurfaces: mocks.revalidateServiceSurfaces,
}));

import { startCrmBookingService, type CrmActionContext } from "@/lib/bookings/crm-booking-operations";

const BOOKING_1 = "1ea3ce31-6ead-49e0-9ff4-43501d5cf20d";
const BOOKING_2 = "2ea3ce31-6ead-49e0-9ff4-43501d5cf20e";
const BRANCH_ID = "3ea3ce31-6ead-49e0-9ff4-43501d5cf20f";
const STAFF_ID = "4ea3ce31-6ead-49e0-9ff4-43501d5cf210";
const RESOURCE_ID = "5ea3ce31-6ead-49e0-9ff4-43501d5cf211";

describe("CRM Start Service RPC hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeCtx = (bookingId: string): CrmActionContext => ({
    authUserId: "user-1",
    me: {
      id: STAFF_ID,
      branch_id: BRANCH_ID,
      system_role: "csr",
    },
    homeServiceOnly: false,
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: bookingId,
                branch_id: BRANCH_ID,
                status: "confirmed",
                booking_progress_status: "checked_in",
                customer_id: "cust-1",
              },
              error: null,
            }),
          })),
        })),
      })) as unknown,
    } as CrmActionContext["supabase"],
  });

  it("explicitly supplies p_resource_id when booking has an assigned resource", async () => {
    const ctx = makeCtx(BOOKING_1);

    // Mock admin client details query
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: BOOKING_1,
                branch_id: BRANCH_ID,
                customer_id: "cust-1",
                service_id: "srv-1",
                booking_date: "2026-09-13",
                start_time: "10:00:00",
                end_time: "11:00:00",
                type: "walkin",
                delivery_type: "in_spa",
                staff_id: STAFF_ID,
                driver_id: null,
                status: "confirmed",
                payment_status: "paid",
                booking_progress_status: "checked_in",
                checked_in_at: "2026-09-13T10:00:00Z",
                session_started_at: null,
                resource_id: RESOURCE_ID,
                metadata: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    mocks.rpc.mockResolvedValue({ data: { started_at: "2026-09-13T10:05:00Z" }, error: null });

    const result = await startCrmBookingService(ctx, { bookingId: BOOKING_1 });

    expect(result).toEqual({ success: true });
    expect(mocks.rpc).toHaveBeenCalledWith("start_booking_service_session", {
      p_booking_id: BOOKING_1,
      p_source: "crm",
      p_actor_staff_id: STAFF_ID,
      p_resource_id: RESOURCE_ID,
    });
  });

  it("explicitly supplies null for p_resource_id when booking has no assigned resource", async () => {
    const ctx = makeCtx(BOOKING_2);

    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: BOOKING_2,
                branch_id: BRANCH_ID,
                customer_id: "cust-1",
                service_id: "srv-1",
                booking_date: "2026-09-13",
                start_time: "10:00:00",
                end_time: "11:00:00",
                type: "walkin",
                delivery_type: "in_spa",
                staff_id: STAFF_ID,
                driver_id: null,
                status: "confirmed",
                payment_status: "paid",
                booking_progress_status: "checked_in",
                checked_in_at: "2026-09-13T10:00:00Z",
                session_started_at: null,
                resource_id: null,
                metadata: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    mocks.rpc.mockResolvedValue({ data: { started_at: "2026-09-13T10:05:00Z" }, error: null });

    const result = await startCrmBookingService(ctx, { bookingId: BOOKING_2 });

    expect(result).toEqual({ success: true });
    expect(mocks.rpc).toHaveBeenCalledWith("start_booking_service_session", {
      p_booking_id: BOOKING_2,
      p_source: "crm",
      p_actor_staff_id: STAFF_ID,
      p_resource_id: null,
    });
  });
});
