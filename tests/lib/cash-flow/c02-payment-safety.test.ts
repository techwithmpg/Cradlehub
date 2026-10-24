import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateBookingSurfaces: vi.fn(),
  rpc: vi.fn(),
  recordOrderPayment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/bookings/revalidate-booking-surfaces", () => ({
  revalidateOperationalBookingSurfaces: mocks.revalidateBookingSurfaces,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/cash-flow/payment-writer", () => ({
  recordOrderPayment: mocks.recordOrderPayment,
}));

import {
  recordOrderPaymentAction,
  recordLegacyBookingPaymentAction,
} from "@/lib/cash-flow/cash-flow-actions";
import { isBookingClosedForCrm } from "@/lib/bookings/crm-booking-status";

describe("C-02: Payment Safety & Closed Booking Protection", () => {
  const branchId = "22222222-2222-4222-8222-222222222222";
  const otherBranchId = "99999999-9999-4999-8999-999999999999";
  const orderId = "33333333-3333-4333-8333-333333333333";
  const bookingId = "44444444-4444-4444-8444-444444444444";
  const cashAccountId = "55555555-5555-4555-8555-555555555555";

  function createMockSupabase(
    bookingsData: unknown,
    staffData: Record<string, unknown> | null = {
      id: "staff-1",
      branch_id: branchId,
      system_role: "crm",
      is_active: true,
    }
  ) {
    return {
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
      from: (table: string) => {
        if (table === "staff") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: staffData,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          const makeEqResult = (data: unknown) => {
            const resolvedValue = {
              data: Array.isArray(data)
                ? data.map((b) => (typeof b === "object" && b !== null && !("branch_id" in b) ? { ...b, branch_id: branchId } : b))
                : data,
              error: null,
            };
            return {
              then: (onfulfilled: (v: unknown) => unknown) =>
                Promise.resolve(resolvedValue).then(onfulfilled),
              maybeSingle: async () => ({
                data: Array.isArray(data) ? data[0] : data,
                error: null,
              }),
            };
          };

          const q = {
            select: () => q,
            eq: () => makeEqResult(bookingsData),
            maybeSingle: async () => ({
              data: Array.isArray(bookingsData) ? bookingsData[0] : bookingsData,
              error: null,
            }),
          };
          return q;
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authoritative Booking Status Contract", () => {
    it("identifies cancelled, no_show, and expired as closed and ineligible for payment", () => {
      expect(isBookingClosedForCrm("cancelled")).toBe(true);
      expect(isBookingClosedForCrm("no_show")).toBe(true);
      expect(isBookingClosedForCrm("expired")).toBe(true);
    });

    it("identifies active operational statuses as open/eligible for payment", () => {
      expect(isBookingClosedForCrm("confirmed")).toBe(false);
      expect(isBookingClosedForCrm("in_progress")).toBe(false);
      expect(isBookingClosedForCrm("pending")).toBe(false);
      expect(isBookingClosedForCrm("pending_payment")).toBe(false);
      expect(isBookingClosedForCrm("completed")).toBe(false);
    });
  });

  describe("Server-Side Order Payment Guard (recordOrderPaymentAction)", () => {
    it("rejects payment when staff profile is missing or inactive", async () => {
      mocks.createClient.mockResolvedValue(createMockSupabase([], null));

      const result = await recordOrderPaymentAction({
        orderId,
        idempotencyKey: "test-idem-no-staff",
        payments: [{ amount: 1200, paymentMethod: "cash", financialAccountId: cashAccountId }],
        businessDate: "2026-10-03",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("STAFF_INACTIVE");
      }
    });

    it("rejects payment when staff role is not authorized to confirm payments", async () => {
      mocks.createClient.mockResolvedValue(
        createMockSupabase([], {
          id: "staff-1",
          branch_id: branchId,
          system_role: "therapist",
          is_active: true,
        })
      );

      const result = await recordOrderPaymentAction({
        orderId,
        idempotencyKey: "test-idem-unauth",
        payments: [{ amount: 1200, paymentMethod: "cash", financialAccountId: cashAccountId }],
        businessDate: "2026-10-03",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("FORBIDDEN");
      }
    });

    it("rejects payment when non-owner staff attempts to pay for another branch", async () => {
      mocks.createClient.mockResolvedValue(
        createMockSupabase(
          [{ id: bookingId, status: "confirmed", branch_id: otherBranchId }],
          {
            id: "staff-1",
            branch_id: branchId,
            system_role: "crm",
            is_active: true,
          }
        )
      );

      const result = await recordOrderPaymentAction({
        orderId,
        idempotencyKey: "test-idem-cross-branch",
        payments: [{ amount: 1200, paymentMethod: "cash", financialAccountId: cashAccountId }],
        businessDate: "2026-10-03",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BRANCH_MISMATCH");
      }
    });

    it("rejects payment when all child bookings for an order are CANCELLED", async () => {
      mocks.createClient.mockResolvedValue(
        createMockSupabase([{ id: bookingId, status: "cancelled", branch_id: branchId }])
      );

      const result = await recordOrderPaymentAction({
        orderId,
        idempotencyKey: "test-idem-cancelled",
        payments: [{ amount: 1200, paymentMethod: "cash", financialAccountId: cashAccountId }],
        businessDate: "2026-10-03",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORDER_NOT_PAYABLE");
        expect(result.error).toContain("closed");
      }
      expect(mocks.recordOrderPayment).not.toHaveBeenCalled();
    });

    it("rejects payment when child bookings for an order are NO_SHOW or EXPIRED", async () => {
      mocks.createClient.mockResolvedValue(
        createMockSupabase([
          { id: "b1", status: "no_show", branch_id: branchId },
          { id: "b2", status: "expired", branch_id: branchId },
        ])
      );

      const result = await recordOrderPaymentAction({
        orderId,
        idempotencyKey: "test-idem-noshow",
        payments: [{ amount: 800, paymentMethod: "cash", financialAccountId: cashAccountId }],
        businessDate: "2026-10-03",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ORDER_NOT_PAYABLE");
      }
      expect(mocks.recordOrderPayment).not.toHaveBeenCalled();
    });

    it.each([
      ["cancelled", "confirmed"],
      ["expired", "confirmed"],
      ["confirmed", "expired"],
    ])(
      "allows payment when at least one child booking for an order is active/confirmed (%s + %s)",
      async (firstStatus, secondStatus) => {
        mocks.createClient.mockResolvedValue(
          createMockSupabase([
            { id: "b1", status: firstStatus, branch_id: branchId },
            { id: "b2", status: secondStatus, branch_id: branchId },
          ])
        );

        mocks.recordOrderPayment.mockResolvedValue({
          ok: true,
          data: {
            success: true,
            isIdempotentReplay: false,
            transactionId: "tx-1",
            orderId,
            branchId,
            businessDate: "2026-10-03",
            totalPaid: 1200,
            totalPayable: 1200,
            netAllocated: 1200,
            remainingBalance: 0,
            paymentState: "paid",
            movements: [],
            allocations: [],
          },
        });

        const result = await recordOrderPaymentAction({
          orderId,
          idempotencyKey: "test-idem-valid",
          payments: [{ amount: 1200, paymentMethod: "cash", financialAccountId: cashAccountId }],
          businessDate: "2026-10-03",
        });

        expect(result.ok).toBe(true);
        expect(mocks.recordOrderPayment).toHaveBeenCalled();
      }
    );
  });

  describe("Server-Side Legacy Booking Payment Guard (recordLegacyBookingPaymentAction)", () => {
    it("rejects legacy payment for CANCELLED booking", async () => {
      mocks.createClient.mockResolvedValue(
        createMockSupabase({
          id: bookingId,
          branch_id: branchId,
          order_id: null,
          status: "cancelled",
          amount_paid: 0,
          payment_status: "pending",
          metadata: { price_paid: 1200 },
        })
      );

      const result = await recordLegacyBookingPaymentAction({
        bookingId,
        branchId,
        expectedAmountPaid: 0,
        idempotencyKey: "test-legacy-cancelled",
        payments: [{ amount: 1200, paymentMethod: "cash", financialAccountId: cashAccountId }],
        businessDate: "2026-10-03",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BOOKING_NOT_PAYABLE");
      }
    });

    it("rejects legacy payment for EXPIRED booking", async () => {
      mocks.createClient.mockResolvedValue(
        createMockSupabase({
          id: bookingId,
          branch_id: branchId,
          order_id: null,
          status: "expired",
          amount_paid: 0,
          payment_status: "pending",
          metadata: { price_paid: 1200 },
        })
      );

      const result = await recordLegacyBookingPaymentAction({
        bookingId,
        branchId,
        expectedAmountPaid: 0,
        idempotencyKey: "test-legacy-expired",
        payments: [{ amount: 1200, paymentMethod: "cash", financialAccountId: cashAccountId }],
        businessDate: "2026-10-03",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BOOKING_NOT_PAYABLE");
      }
    });

    it("rejects legacy payment for NO_SHOW booking", async () => {
      mocks.createClient.mockResolvedValue(
        createMockSupabase({
          id: bookingId,
          branch_id: branchId,
          order_id: null,
          status: "no_show",
          amount_paid: 0,
          payment_status: "pending",
          metadata: { price_paid: 1200 },
        })
      );

      const result = await recordLegacyBookingPaymentAction({
        bookingId,
        branchId,
        expectedAmountPaid: 0,
        idempotencyKey: "test-legacy-noshow",
        payments: [{ amount: 1200, paymentMethod: "cash", financialAccountId: cashAccountId }],
        businessDate: "2026-10-03",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("BOOKING_NOT_PAYABLE");
      }
    });
  });
});
